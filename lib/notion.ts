import { unstable_noStore as noStore } from "next/cache";
import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";

type NotionJson = Record<string, unknown>;

export type KnowledgeItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  difficulty: string;
  durationMinutes: number | null;
  /** Notion「核心关键词」等，供 Dashboard 筛选 */
  keywords: string[];
};

export type KnowledgeDetail = KnowledgeItem & {
  /** 原文纯文本（从页面 blocks 提取） */
  rawText: string;
  /** AI 提炼大纲（优先从页面 blocks 提取；兼容旧数据时回退到 properties） */
  outlineMarkdown: string;
  /** 相关视频链接（从 properties 提取，可能为空） */
  videoLinks: string[];
  /** 核心关键词（用于生成视频搜索卡片） */
  coreKeywords: string[];
};

function richTextPlain(prop: unknown): string {
  const p = prop as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  const rt = p?.rich_text;
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt[0]?.plain_text ?? "";
}

function urlPlain(prop: unknown): string {
  const p = prop as { url?: string } | undefined;
  return typeof p?.url === "string" ? p.url : "";
}

function richTextAllPlain(prop: unknown): string {
  const p = prop as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  const rt = p?.rich_text;
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt.map((x) => x?.plain_text ?? "").join("").trim();
}

function multiSelectNames(prop: unknown): string[] {
  const p = prop as { multi_select?: Array<{ name?: string }> } | undefined;
  const ms = p?.multi_select;
  if (!Array.isArray(ms) || ms.length === 0) return [];
  return ms
    .map((x) => (x?.name ?? "").trim())
    .filter((x) => x.length > 0);
}

function titlePlain(prop: unknown): string {
  const p = prop as { title?: Array<{ plain_text?: string }> } | undefined;
  const t = p?.title;
  if (!Array.isArray(t) || t.length === 0) return "";
  return t[0]?.plain_text ?? "";
}

function selectPlain(prop: unknown): string {
  const p = prop as { select?: { name?: string }; status?: { name?: string } } | undefined;
  return p?.select?.name ?? p?.status?.name ?? "";
}

function numberValue(prop: unknown): number | null {
  const p = prop as { number?: number | null } | undefined;
  if (typeof p?.number === "number") return p.number;
  return null;
}

function firstByKeys<T>(properties: NotionJson, keys: string[], getter: (prop: unknown) => T): T | null {
  for (const key of keys) {
    if (!(key in properties)) continue;
    const out = getter(properties[key]);
    if (typeof out === "string") {
      if (out.trim().length > 0) return out as T;
      continue;
    }
    if (out !== null && out !== undefined) return out;
  }
  return null;
}

/** Notion DB 中 title 列名因库而异：优先找 type===title，再回退常见中英键名 */
function findTitlePropertyKey(properties: NotionJson): string | null {
  for (const [key, val] of Object.entries(properties)) {
    if ((val as { type?: string })?.type === "title") return key;
  }
  for (const k of ["资料名称", "Name", "Title"]) {
    if (k in properties) return k;
  }
  return null;
}

const KNOWLEDGE_TITLE_MAX_LEN = 2000;

/**
 * 更新知识库页面标题（写入 Notion title 属性）
 */
export async function updateKnowledgeItemTitleInNotion(pageId: string, rawTitle: string): Promise<string> {
  noStore();

  const notionToken = process.env.NOTION_API_KEY;
  if (!notionToken) throw new Error("Missing NOTION_API_KEY");
  if (!pageId) throw new Error("Missing pageId");

  const title = String(rawTitle ?? "")
    .replace(/\r/g, "")
    .trim()
    .slice(0, KNOWLEDGE_TITLE_MAX_LEN);
  if (!title) throw new Error("标题不能为空");

  const notion = createNotionClient(notionToken);
  const page = (await notion.pages.retrieve({ page_id: pageId })) as NotionJson & {
    properties?: NotionJson;
  };
  const props = (page.properties as NotionJson | undefined) ?? {};
  const key = findTitlePropertyKey(props);
  if (!key) throw new Error("页面没有可写入的标题属性");

  await notion.pages.update({
    page_id: pageId,
    properties: {
      [key]: { title: [{ text: { content: title } }] },
    } as unknown as Parameters<Client["pages"]["update"]>[0]["properties"],
  });

  return title;
}

/**
 * 从知识库中移除条目：在 Notion 将页面标记为 archived（进入回收站，与侧栏「删除」一致）。
 */
export async function archiveKnowledgePageInNotion(pageId: string): Promise<void> {
  noStore();

  const notionToken = process.env.NOTION_API_KEY;
  if (!notionToken) throw new Error("Missing NOTION_API_KEY");
  if (!pageId) throw new Error("Missing pageId");

  const notion = createNotionClient(notionToken);
  await notion.pages.update({
    page_id: pageId,
    archived: true,
  });
}

function normalizeUrlList(input: string): string[] {
  const text = (input || "").trim();
  if (!text) return [];
  const parts = text
    .split(/\s+|[\n\r]+|,|，|;|；/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (!/^https?:\/\//i.test(p)) continue;
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 8);
}

function normalizeKeywordList(input: string): string[] {
  const text = (input || "").trim();
  if (!text) return [];
  const parts = text
    .split(/\s+|[\n\r]+|,|，|;|；|\||、/g)
    .map((s) => s.trim())
    .filter(Boolean);
  const out: string[] = [];
  for (const p of parts) {
    if (!out.includes(p)) out.push(p);
  }
  return out.slice(0, 8);
}

function blockRichTextToPlain(block: NotionJson): string {
  const type = String(block.type ?? "");
  const typed = (block[type] as NotionJson | undefined) ?? {};
  const rt = (typed.rich_text as Array<{ plain_text?: string }> | undefined) ?? [];
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt.map((x) => x?.plain_text ?? "").join("").trim();
}

/**
 * 从 Notion block 还原 Markdown 片段。
 * 页面写入若使用 heading_* / list_item，此处必须与之一致，否则读回会丢失 ##、- 等标记，前端无法解析。
 */
function notionBlockToMarkdownFragment(block: NotionJson): string | null {
  const type = String(block.type ?? "");
  if (
    type === "divider" ||
    type === "table_of_contents" ||
    type === "breadcrumb" ||
    type === "column_list" ||
    type === "column" ||
    type === "synced_block"
  ) {
    return null;
  }

  const text = blockRichTextToPlain(block);

  switch (type) {
    case "heading_1":
      return text ? `# ${text}` : null;
    case "heading_2":
      return text ? `## ${text}` : null;
    case "heading_3":
      return text ? `### ${text}` : null;
    case "bulleted_list_item":
      return text ? `- ${text}` : null;
    case "numbered_list_item":
      return text ? `1. ${text}` : null;
    case "to_do": {
      const td = (block.to_do as NotionJson | undefined) ?? {};
      const checked = Boolean(td.checked);
      const mark = checked ? "[x]" : "[ ]";
      return text ? `- ${mark} ${text}` : null;
    }
    case "quote":
      if (!text) return null;
      return text
        .split("\n")
        .map((line) => `> ${line}`.trimEnd())
        .join("\n");
    case "code": {
      if (!text) return null;
      const typedCode = (block.code as NotionJson | undefined) ?? {};
      const lang = String(typedCode.language ?? "").trim();
      const t = text.trim();
      // mdToNotionBlocks 将 mermaid 存为 plain text code；读回时须恢复 ```mermaid 供前端解析
      const isMermaid =
        /^mindmap\s*(?:\n|$)/m.test(t) ||
        /^graph\s+/m.test(t) ||
        /^flowchart\s+/m.test(t) ||
        /^sequenceDiagram\b/m.test(t);
      const fenceLang = isMermaid ? "mermaid" : lang && lang.toLowerCase() !== "plain text" ? lang : "";
      return ["```" + (fenceLang || "text"), text, "```"].join("\n");
    }
    case "paragraph":
      return text || null;
    default:
      return text || null;
  }
}

async function fetchAllBlockChildrenPlain(notion: Client, blockId: string): Promise<string> {
  const lines: string[] = [];
  const queue: Array<{ id: string; depth: number }> = [{ id: blockId, depth: 0 }];
  const maxDepth = 20;

  while (queue.length) {
    const cur = queue.shift()!;
    if (cur.depth > maxDepth) continue;

    let cursor: string | undefined;
    // Iterate pagination for children
    do {
      const resp = (await notion.blocks.children.list({
        block_id: cur.id,
        page_size: 100,
        start_cursor: cursor,
      })) as { results?: NotionJson[]; next_cursor?: string | null; has_more?: boolean };

      const results = (resp.results ?? []) as NotionJson[];
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

async function fetchAllBlockChildrenOrdered(
  notion: Client,
  blockId: string,
  depth = 0,
  maxDepth = 20
): Promise<NotionJson[]> {
  if (depth > maxDepth) return [];
  const out: NotionJson[] = [];
  let cursor: string | undefined;
  do {
    const resp = (await notion.blocks.children.list({
      block_id: blockId,
      page_size: 100,
      start_cursor: cursor,
    })) as { results?: NotionJson[]; next_cursor?: string | null; has_more?: boolean };
    const results = (resp.results ?? []) as NotionJson[];
    for (const b of results) {
      out.push(b);
      if (b.has_children) {
        const id = String(b.id ?? "");
        if (id) {
          // eslint-disable-next-line no-await-in-loop
          const children = await fetchAllBlockChildrenOrdered(notion, id, depth + 1, maxDepth);
          out.push(...children);
        }
      }
    }
    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

async function fetchPageBodySplit(notion: Client, pageId: string): Promise<{ rawText: string; aiSummary: string }> {
  const blocks = await fetchAllBlockChildrenOrdered(notion, pageId);
  let section: "raw" | "ai" | null = null;
  const rawParts: string[] = [];
  const aiParts: string[] = [];

  for (const b of blocks) {
    const type = String(b.type ?? "");
    const text = blockRichTextToPlain(b);
    if (type === "heading_2" || type === "heading_1" || type === "heading_3") {
      const title = text.replace(/\s+/g, " ").trim();
      if (title.includes("资料原文") || title.toLowerCase().includes("rawtext")) {
        section = "raw";
        continue;
      }
      if (
        title.includes("AI 提炼大纲") ||
        title.startsWith("AI 提炼（") ||
        title.toLowerCase().includes("aisummary") ||
        title.includes("AI Markdown")
      ) {
        section = "ai";
        continue;
      }
    }
    const fragment = notionBlockToMarkdownFragment(b);
    if (!fragment) continue;
    if (section === "raw") rawParts.push(fragment);
    else if (section === "ai") aiParts.push(fragment);
  }

  return {
    rawText: rawParts.join("\n\n").trim(),
    aiSummary: aiParts.join("\n\n").trim(),
  };
}

export async function fetchKnowledgeFromNotion(): Promise<KnowledgeItem[]> {
  noStore();

  const notionToken = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID_KNOWLEDGE;
  if (!notionToken || !databaseId) {
    throw new Error("Missing NOTION_API_KEY or NOTION_DATABASE_ID_KNOWLEDGE");
  }

  const notion = createNotionClient(notionToken);
  try {
    const database = (await notion.databases.retrieve({
      database_id: databaseId,
    })) as { data_sources?: Array<{ id: string }> };

    const dataSourceId = database?.data_sources?.[0]?.id;
    if (!dataSourceId) {
      throw new Error("Notion database has no data_sources");
    }

    const result = await notion.dataSources.query({
      data_source_id: dataSourceId,
      sorts: [{ timestamp: "created_time", direction: "descending" }],
    });

    const rows = (result.results ?? []) as NotionJson[];

    // Debug: print Notion raw properties keys + one sample page shape.
    const first = rows.find((r) => r?.object === "page") as NotionJson | undefined;
    const firstProps = (first?.properties as NotionJson | undefined) ?? {};
    // eslint-disable-next-line no-console
    console.log("[fetchKnowledgeFromNotion] raw:", {
      resultsCount: rows.length,
      firstPageId: String(first?.id ?? ""),
      propertyKeys: Object.keys(firstProps),
      // Keep payload small but still useful to verify Chinese keys + types.
      propertiesPreview: firstProps,
    });

    return rows
      .filter((r) => r?.object === "page")
      .map((page) => {
        const props = (page.properties as NotionJson | undefined) ?? {};
        const title =
          firstByKeys<string>(props, ["资料名称", "Name", "Title"], titlePlain) ??
          firstByKeys<string>(props, ["资料名称", "Name", "Title"], richTextPlain) ??
          "未命名资料";
        const type =
          firstByKeys<string>(props, ["资料类型", "Type", "Tag", "标签"], selectPlain) ??
          firstByKeys<string>(props, ["资料类型", "Type", "Tag", "标签"], richTextPlain) ??
          "未分类";
        const status =
          firstByKeys<string>(props, ["学习状态", "Status", "状态"], selectPlain) ??
          firstByKeys<string>(props, ["学习状态", "Status", "状态"], richTextPlain) ??
          "未设置";
        const difficulty =
          firstByKeys<string>(props, ["难度星级", "Difficulty", "难度"], selectPlain) ??
          firstByKeys<string>(props, ["难度星级", "Difficulty", "难度"], richTextPlain) ??
          "未设置";
        const duration =
          firstByKeys<number | null>(
            props,
            [
              "建议学习时长",
              "建议学习时长(分钟)",
              "建议学习时长",
              "建议时长",
              "Duration",
            ],
            numberValue
          ) ?? null;

        const keywordMulti =
          firstByKeys<string[]>(
            props,
            ["核心关键词", "关键词", "KeyWords", "Keywords", "Tags", "标签"],
            multiSelectNames
          ) ?? [];
        const keywordText =
          firstByKeys<string>(
            props,
            ["核心关键词", "关键词", "KeyWords", "Keywords", "Tags", "标签"],
            richTextAllPlain
          ) ?? "";
        const keywords = (
          keywordMulti.length ? keywordMulti : normalizeKeywordList(keywordText)
        ).slice(0, 12);

        return {
          id: String(page.id ?? ""),
          title,
          type,
          status,
          difficulty,
          durationMinutes: duration,
          keywords,
        };
      });
  } catch (error) {
    // Make Notion SDK errors more visible in terminal.
    const e = error as { status?: number; code?: string; message?: string };
    // eslint-disable-next-line no-console
    console.error("[fetchKnowledgeFromNotion] Notion error:", {
      status: e?.status,
      code: e?.code,
      message: e?.message,
      error,
    });
    throw error;
  }
}

export async function fetchKnowledgeDetailFromNotion(pageId: string): Promise<KnowledgeDetail> {
  noStore();

  const notionToken = process.env.NOTION_API_KEY;
  const databaseId = process.env.NOTION_DATABASE_ID_KNOWLEDGE;
  if (!notionToken || !databaseId) {
    throw new Error("Missing NOTION_API_KEY or NOTION_DATABASE_ID_KNOWLEDGE");
  }
  if (!pageId) throw new Error("Missing pageId");

  const notion = createNotionClient(notionToken);

  try {
    // Verify access to database (gives clearer 404/401 context early).
    await notion.databases.retrieve({ database_id: databaseId });

    const page = (await notion.pages.retrieve({ page_id: pageId })) as NotionJson & {
      id?: string;
      properties?: NotionJson;
    };
    const props = (page.properties as NotionJson | undefined) ?? {};

    // eslint-disable-next-line no-console
    console.log("[fetchKnowledgeDetailFromNotion] raw properties:", {
      pageId,
      propertyKeys: Object.keys(props),
      propertiesPreview: props,
    });

    const title =
      firstByKeys<string>(props, ["资料名称", "Name", "Title"], titlePlain) ??
      firstByKeys<string>(props, ["资料名称", "Name", "Title"], richTextPlain) ??
      "未命名资料";
    const type =
      firstByKeys<string>(props, ["资料类型", "Type", "Tag", "标签"], selectPlain) ??
      firstByKeys<string>(props, ["资料类型", "Type", "Tag", "标签"], richTextPlain) ??
      "未分类";
    const status =
      firstByKeys<string>(props, ["学习状态", "Status", "状态"], selectPlain) ??
      firstByKeys<string>(props, ["学习状态", "Status", "状态"], richTextPlain) ??
      "未设置";
    const difficulty =
      firstByKeys<string>(props, ["难度星级", "Difficulty", "难度"], selectPlain) ??
      firstByKeys<string>(props, ["难度星级", "Difficulty", "难度"], richTextPlain) ??
      "未设置";
    const duration =
      firstByKeys<number | null>(
        props,
        [
          "建议学习时长",
          "建议学习时长(分钟)",
          "建议学习时长",
          "建议时长",
          "Duration",
        ],
        numberValue
      ) ?? null;

    const videoRaw =
      firstByKeys<string>(
        props,
        ["相关视频推荐", "相关视频", "视频链接", "学习视频链接", "Video", "Videos"],
        richTextAllPlain
      ) ??
      firstByKeys<string>(
        props,
        ["相关视频推荐", "相关视频", "视频链接", "学习视频链接", "Video", "Videos"],
        urlPlain
      ) ??
      "";
    const videoLinks = normalizeUrlList(videoRaw);

    const keywordMulti =
      firstByKeys<string[]>(props, ["核心关键词", "关键词", "KeyWords", "Keywords", "Tags", "标签"], multiSelectNames) ??
      [];
    const keywordText =
      firstByKeys<string>(props, ["核心关键词", "关键词", "KeyWords", "Keywords", "Tags", "标签"], richTextAllPlain) ??
      "";
    const coreKeywords = (keywordMulti.length ? keywordMulti : normalizeKeywordList(keywordText)).slice(0, 6);

    const outlineFromProps =
      firstByKeys<string>(
        props,
        ["核心知识提炼", "核心知识大纲", "AI提炼大纲", "AI 提炼大纲", "outline", "Outline"],
        richTextAllPlain
      ) ?? "";

    const split = await fetchPageBodySplit(notion, pageId);
    const rawText = split.rawText || (await fetchAllBlockChildrenPlain(notion, pageId));
    const outlineMarkdown = split.aiSummary || outlineFromProps;

    return {
      id: String(page.id ?? pageId),
      title,
      type,
      status,
      difficulty,
      durationMinutes: duration,
      keywords: coreKeywords,
      rawText,
      outlineMarkdown,
      videoLinks,
      coreKeywords,
    };
  } catch (error) {
    const e = error as { status?: number; code?: string; message?: string };
    // eslint-disable-next-line no-console
    console.error("[fetchKnowledgeDetailFromNotion] Notion error:", {
      pageId,
      status: e?.status,
      code: e?.code,
      message: e?.message,
      error,
    });
    throw error;
  }
}

