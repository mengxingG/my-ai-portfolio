import { NextResponse } from "next/server";
import { fixMermaidMindmapIndentInMarkdown } from "@/lib/fixMermaidMindmapIndent";
import {
  NOTEBOOK_META_END,
  NOTEBOOK_META_START,
  normalizeNotebookKeywords,
  splitNotebookMetaBlock,
} from "@/lib/knowledgeNotebookMeta";
import { mdToNotionBlocks } from "@/lib/mdToNotionBlocks";
import { createNotionClient } from "@/lib/notion-client";
import { repairOutlineMarkdownSourceTraces, validateRedLineSourceTraces } from "@/lib/outlineSourceTrace";
import type { Client as NotionClient } from "@notionhq/client";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export const dynamic = "force-dynamic";
/** 生成 + 可能批量删除/写入较多 Notion 块 */
export const maxDuration = 120;

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/** 仅注入 Google SDK；勿替换 global fetch，否则 Notion 客户端自带的 `agent` 与 undici dispatcher 混用易触发 `fetch failed`。 */
let customFetch: ((url: unknown, init?: unknown) => Promise<unknown>) | undefined;
if (process.env.NODE_ENV === "development") {
  const dispatcher = new ProxyAgent({
    uri: "http://127.0.0.1:7897",
    connectTimeout: 300_000,
    headersTimeout: 300_000,
    bodyTimeout: 300_000,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 120_000,
  });
  customFetch = (url: unknown, init?: unknown) =>
    undiciFetch(url as never, { ...((init as Record<string, unknown>) ?? {}), dispatcher } as never);
}

function createRefineGoogleProvider(apiKey: string) {
  const baseURL = process.env.GOOGLE_GEMINI_BASE_URL?.trim() || undefined;
  if (process.env.NODE_ENV === "development" && customFetch) {
    return createGoogleGenerativeAI({
      apiKey,
      baseURL,
      fetch: customFetch as typeof fetch,
    });
  }
  return createGoogleGenerativeAI({ apiKey, baseURL });
}

type GeminiNotebookLMOutput = {
  title: string;
  outline: string; // markdown
  keywords: string[];
  difficulty: "入门" | "进阶" | "高级";
  estimatedMinutes: number;
};

type GeminiNotebookLMResult = {
  model: string;
  data: GeminiNotebookLMOutput;
};

type NotionBlock = Record<string, unknown> & {
  id?: string;
  type?: string;
  has_children?: boolean;
};

function safeTrim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function clampInt(n: unknown, min: number, max: number) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function pickDifficulty(x: unknown): "入门" | "进阶" | "高级" {
  const v = safeTrim(x);
  if (v === "入门" || v === "进阶" || v === "高级") return v;
  if (v.includes("入门")) return "入门";
  if (v.includes("高级")) return "高级";
  return "进阶";
}

function splitRefineMarkdownOutput(full: string): {
  markdown: string;
  meta: Record<string, string>;
} {
  const { body, meta } = splitNotebookMetaBlock(full);
  return { markdown: body, meta };
}

function extractFirstHeading1(md: string): string {
  const m = String(md || "").match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}

function blockRichTextToPlain(block: NotionBlock): string {
  const type = String(block.type ?? "");
  if (!type) return "";
  const typed = (block[type] as Record<string, unknown> | undefined) ?? {};
  const rt =
    (typed.rich_text as Array<{ plain_text?: string }> | undefined) ?? [];
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt.map((x) => x?.plain_text ?? "").join("").trim();
}

async function listDirectBlockChildren(notion: NotionClient, parentId: string): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const resp = (await notion.blocks.children.list({
      block_id: parentId,
      page_size: 100,
      start_cursor: cursor,
    })) as {
      results?: NotionBlock[];
      next_cursor?: string | null;
      has_more?: boolean;
    };
    for (const b of resp.results ?? []) out.push(b);
    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

/** 与 lib/notion.ts fetchPageBodySplit 中进入 AI 区块的标题规则一致 */
function isAISummarySectionHeading(block: NotionBlock): boolean {
  const t = String(block.type ?? "");
  if (t !== "heading_1" && t !== "heading_2" && t !== "heading_3") return false;
  const title = blockRichTextToPlain(block).replace(/\s+/g, " ").trim();
  const lower = title.toLowerCase();
  return (
    title.includes("AI 提炼大纲") ||
    title.startsWith("AI 提炼（") ||
    lower.includes("aisummary") ||
    title.includes("AI Markdown")
  );
}

/** 删除页面正文里从首个 AI 大纲标题起到末尾的顶层块，避免多次「重新提炼」只 append 导致内容重复 */
async function deleteExistingAISummaryBlocks(notion: NotionClient, pageId: string): Promise<void> {
  const top = await listDirectBlockChildren(notion, pageId);
  let start = -1;
  for (let i = 0; i < top.length; i++) {
    if (isAISummarySectionHeading(top[i])) {
      start = i;
      break;
    }
  }
  if (start < 0) return;

  const victims = top.slice(start).filter((b) => b.id);
  for (let i = victims.length - 1; i >= 0; i--) {
    const id = String(victims[i].id ?? "");
    if (!id) continue;
    await notion.blocks.delete({ block_id: id });
    await delay(400);
  }
}

async function fetchAllBlockChildrenPlain(
  notion: NotionClient,
  blockId: string
): Promise<string> {
  const lines: string[] = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: blockId, depth: 0 }];
  const maxDepth = 20;

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.depth > maxDepth) continue;

    let cursor: string | undefined;
    do {
      const resp = (await notion.blocks.children.list({
        block_id: cur.id,
        page_size: 100,
        start_cursor: cursor,
      })) as unknown as {
        results?: NotionBlock[];
        next_cursor?: string | null;
        has_more?: boolean;
      };

      const results = (resp.results ?? []) as NotionBlock[];
      for (const b of results) {
        const text = blockRichTextToPlain(b);
        if (text) lines.push(text);
        if (b.has_children) {
          const id = String(b.id ?? "");
          if (id) queue.push({ id, depth: cur.depth + 1 });
        }
      }
      cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
    } while (cursor);
  }

  return lines.join("\n").trim();
}

async function callGeminiNotebookLM(inputText: string): Promise<GeminiNotebookLMResult> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? "";
  if (!apiKey) {
    throw new Error(
      "Server misconfiguration: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not set."
    );
  }

  const googleProvider = createRefineGoogleProvider(apiKey);
  const tryModels = ["gemini-2.5-pro", "gemini-3-flash-preview", "gemini-2.5-flash-lite"] as const;

  const prompt = [
    "你是顶级知识架构师（金融合规向：零幻觉、可核验）。请完整阅读下列资料全文，**绝对不能遗漏任何一个核心章节**。",
    "",
    "【输出格式】只输出 Markdown 正文。**禁止 JSON**、禁止用代码块包裹整篇回答。",
    "",
    "正文结构（严格顺序）：",
    "1) 按原文顺序，为**每个主要章节**写 `## 章节标题`，各章必须包含：",
    "   - **大白话翻译 (TL;DR)**：单独一段，用买菜、考试、过安检等生活例子讲清概念，让外行秒懂。",
    "   - **核心逻辑与红线**（学术尾注）：**每章 3～5 条** `- …要点… [n]`（句末角标 [1][2]…，章内连续；**禁止**要点下直接写 `> ` 摘录）。**全部**要点后空一行 → `🔍 本章溯源档案：` → 空行 → **一个**引用块：`> [n] \"资料逐字摘录\"`，与角标一一对应；禁止 `> 🔍 原文溯源` 旧体例。找不到依据则不要写该条。",
    "2) **全部章节写完之后**，在**元数据块（NOTION_META）之前**，输出**唯一**一个 \\`\\`\\`mermaid 围栏；**彻底废弃 mindmap 语法**；围栏内**必须**使用商业架构图标准的 **flowchart LR**（从左到右）。全文只许这一处 mermaid，**禁止**放在正文开头。",
    "",
    "## 【全景架构树（flowchart LR）— 违反任一条即视为失败】",
    "在输出完文字大纲后，你必须使用该 mermaid 围栏，生成一张高度结构化的全景树状图。",
    "",
    "**【强制语法要求】**",
    "- **必须使用 flowchart LR 语法**（第一行仅写 `flowchart LR`，小写 flowchart，独占一行）。**绝对禁止** mindmap、graph TD、graph TB 等与「从左到右全景树」无关的图类型。",
    "- **绝对不能画成一条单向直线**：必须以文档主题为根节点，向右发散出多个子模块，再由子模块发散出具体细节，形成树状分支结构。",
    "- **极简文字**：为了防止图表臃肿，节点内的文字必须极度精简（最好不超过 8 个字），去掉所有冗余的修饰词。",
    "- **安全包裹**：所有节点的显示文本必须用 `[\"节点文本\"]` 形式（写作 `节点ID[\"节点文本\"]`），防止括号等特殊符号导致解析崩溃。",
    "- 至少 **3～4 层**分支深度，覆盖核心模块、挑战与对策等；用 **一对多** 的 `A --> B`、`A --> C` 表达分叉，不要写成单链 `A --> B --> C --> D` 贯穿全图。",
    "",
    "**【正确的、绝对不重叠的树状图示例】**（骨架须一致，Root/模块/细节须换成本文真实内容）：",
    "flowchart LR",
    "  Root[\"Pre-trade合规AI\"] --> M1[\"模块一：规则采集\"]",
    "  Root --> M2[\"模块二：智能审查\"]",
    "  Root --> M3[\"异常与兜底处理\"]",
    "  M1 --> M1A[\"多源实时采集\"]",
    "  M1 --> M1B[\"多模态视觉解析\"]",
    "  M2 --> M2A[\"上下文数据聚合\"]",
    "  M2 --> M2B[\"混合检索(RAG)\"]",
    "  M2 --> M2C[\"AI语义决策(L1)\"]",
    "  M3 --> M3A[\"知识盲区(黄灯)\"]",
    "  M3 --> M3B[\"系统宕机(Fail-Open)\"]",
    "  M3 --> M3C[\"专家复核(Review)\"]",
    "",
    "请遵循这种『一对多』的分支语法，基于文档详实内容，画出一张从左到右、层级分明、排版清爽的架构树！",
    "",
    "内容须详实、结构清晰，不要为了简短而省略章节。",
    "",
    "【元数据】在全文最后**另起一行**，原样使用下面两行标记，中间四行只改冒号后的值（title 单行；keywords 用 ` | ` 分隔 3～5 个词）：",
    NOTEBOOK_META_START,
    "title: 资料的精炼标题",
    "keywords: 词1 | 词2 | 词3",
    "difficulty: 入门 或 进阶 或 高级",
    "estimatedMinutes: 45",
    NOTEBOOK_META_END,
    "",
    "资料正文：",
    inputText.slice(0, 180_000),
  ].join("\n");

  const system =
    "严格遵守：Markdown 正文 = 每章核心红线为尾标列表 `- … [n]` + 章末 `🔍 本章溯源档案：` + 引用块 `> [n] \"…\"`（禁止要点与摘录穿插；禁止 _(来源溯源…)_）+ **全部章节之后、NOTION_META 之前**唯一 ` ```mermaid `：**彻底废弃 mindmap**；**必须 flowchart LR**；根节点向右一对多分支；节点文案极度精简（约 8 字内）；全部节点用 `节点ID[\"文本\"]` 安全包裹；禁止单链 A→B→C→D 贯穿全图；禁止 graph TD/TB/mindmap。最后输出 NOTION_META。绝对不要输出 JSON。";

  let lastErr: Error | null = null;
  for (const modelName of tryModels) {
    try {
      const result = await generateText({
        model: googleProvider(modelName),
        system,
        prompt,
        temperature: 0.2,
        maxOutputTokens: 16_384,
      });

      const raw = safeTrim(result.text);
      if (!raw) throw new Error("Gemini returned empty text.");

      const { markdown, meta } = splitRefineMarkdownOutput(raw);
      let outline = markdown;
      if (!outline) throw new Error("Gemini output missing outline markdown.");

      try {
        const traceFixed = await repairOutlineMarkdownSourceTraces(
          googleProvider(modelName),
          outline,
          inputText,
          2
        );
        outline = traceFixed.markdown;
        if (!traceFixed.ok) {
          const n = validateRedLineSourceTraces(outline).violations.length;
          console.warn(
            "[/api/knowledge/:id/refine] outline source-trace validation incomplete after repair:",
            n
          );
        }
      } catch (e) {
        console.warn("[/api/knowledge/:id/refine] outline trace repair error:", e);
      }

      let title = safeTrim(meta.title) || extractFirstHeading1(outline) || "未命名资料";
      let keywords = normalizeNotebookKeywords(meta.keywords);
      if (!keywords.length) {
        keywords = title
          .split(/[\s\u3000\/、,，;；|]+/)
          .map((x) => x.trim())
          .filter(Boolean);
      }
      if (!keywords.length) keywords = ["资料提炼"];

      const difficulty = pickDifficulty(meta.difficulty);
      const minutesRaw = meta.estimatedMinutes;
      const estimatedMinutes =
        minutesRaw !== undefined && String(minutesRaw).trim() !== ""
          ? clampInt(minutesRaw, 5, 600)
          : 30;

      return {
        model: modelName,
        data: {
          title,
          outline,
          keywords: keywords.slice(0, 8),
          difficulty,
          estimatedMinutes,
        },
      };
    } catch (e) {
      const err = e as Error;
      lastErr = err;
      console.warn("[/api/knowledge/:id/refine] Gemini model failed, retrying:", modelName, err.message);
    }
  }

  throw new Error(
    `Gemini generation failed after retries: ${lastErr?.message ?? "unknown error"}`
  );
}

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const pageId = String(id || "").trim();
    if (!pageId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });

    const notion = createNotionClient(notionKey);

    const rawText = await fetchAllBlockChildrenPlain(notion, pageId);
    if (!rawText) {
      return NextResponse.json(
        { error: "该页面未提取到资料原文（blocks 为空或暂不支持的内容类型）。" },
        { status: 422 }
      );
    }

    const refined = await callGeminiNotebookLM(rawText);
    const out = {
      ...refined.data,
      outline: fixMermaidMindmapIndentInMarkdown(refined.data.outline),
    };
    const modelName = refined.model;
    const refinedAt = new Date().toISOString();

    const properties = {
      "资料名称": { title: [{ text: { content: out.title } }] },
      "核心知识提炼": {
        rich_text: [{ text: { content: out.outline.slice(0, 1800) } }],
      },
      "难度星级": {
        select: { name: String(out.difficulty) },
      },
      "核心关键词": {
        multi_select: out.keywords.map((k) => ({ name: String(k) })),
      },
      "建议学习时长": {
        number: Number(out.estimatedMinutes),
      },
    } as unknown as Parameters<typeof notion.pages.update>[0]["properties"];

    console.log("Notion Payload 组装完成，正在尝试写入...");
    await notion.pages.update({
      page_id: pageId,
      properties,
    });

    await deleteExistingAISummaryBlocks(notion, pageId);

    // 在清空旧 AI 正文块后写入新一节（避免与历史提炼内容叠加重复）
    const header = [
      {
        object: "block",
        type: "heading_2",
        heading_2: {
          rich_text: [
            {
              type: "text",
              text: { content: `AI 提炼（${modelName} · ${refinedAt}）` },
            },
          ],
        },
      },
      { object: "block", type: "divider", divider: {} },
    ] as unknown as Parameters<typeof notion.blocks.children.append>[0]["children"];

    await notion.blocks.children.append({
      block_id: pageId,
      children: header,
    });

    const blocks = mdToNotionBlocks(out.outline) as unknown as Parameters<
      typeof notion.blocks.children.append
    >[0]["children"];

    // Notion API: children 数量上限（单次 append body.children.length <= 100）
    const MAX_BLOCKS_PER_REQUEST = 100;
    for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
      const chunk = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
      if (!chunk.length) continue;
      await notion.blocks.children.append({
        block_id: pageId,
        children: chunk,
      });
      // Notion Rate Limit：<= 3 次/秒，保守节流
      await delay(500);
    }

    return NextResponse.json({
      ok: true,
      model: modelName,
      refinedAt,
      data: out,
    });
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      cause?: unknown;
      response?: { data?: unknown; status?: number };
    };
    const message = e?.message ?? "Unknown error";
    const status = e?.status ?? e?.response?.status ?? 500;
    const details = e?.response?.data ?? null;
    const cause =
      e?.cause instanceof Error
        ? { message: e.cause.message, name: e.cause.name }
        : e?.cause !== undefined
          ? String(e.cause)
          : null;
    console.error("[/api/knowledge/:id/refine] failed", { message, status, cause, details });
    return NextResponse.json(
      { error: message, status, details, cause },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}

