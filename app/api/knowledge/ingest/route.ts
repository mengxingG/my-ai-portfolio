import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";
import { fixMermaidMindmapIndentInMarkdown } from "@/lib/fixMermaidMindmapIndent";
import {
  NOTEBOOK_META_END,
  normalizeNotebookKeywords,
  splitNotebookMetaBlock,
} from "@/lib/knowledgeNotebookMeta";
import { mdToNotionBlocks } from "@/lib/mdToNotionBlocks";
import { createNotionClient } from "@/lib/notion-client";
import { repairOutlineMarkdownSourceTraces, validateRedLineSourceTraces } from "@/lib/outlineSourceTrace";
import type { Part } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import mammoth from "mammoth";
import { PDFDocument } from "pdf-lib";
import PDFParser from "pdf2json";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { ProxyAgent, fetch as undiciFetch } from "undici";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** 与 Dashboard「资料类型」筛选一致 */
const INGEST_MATERIAL_TYPES = new Set([
  "小红书",
  "B站",
  "YouTube",
  "PDF",
  "视频链接",
  "网页文章",
  "图片截图",
  "PRD",
  "未分类",
]);

/** 仅注入 @ai-sdk/google / GoogleAIFileManager；勿劫持 global fetch，避免与 Notion 客户端的 `agent` 冲突。 */
let customFetch: ((url: unknown, init?: unknown) => Promise<unknown>) | undefined;
if (process.env.NODE_ENV === "development") {
  const dispatcher = new ProxyAgent({
    uri: "http://127.0.0.1:7897",
    connectTimeout: 300000, // 5分钟
    headersTimeout: 300000,
    bodyTimeout: 300000,
    keepAliveTimeout: 30_000,
    keepAliveMaxTimeout: 120_000,
  });
  customFetch = (url: unknown, init?: unknown) =>
    undiciFetch(url as never, { ...((init as Record<string, unknown>) ?? {}), dispatcher } as never);
}

function createIngestGoogleProvider(apiKey: string) {
  if (process.env.NODE_ENV === "development" && customFetch) {
    return createGoogleGenerativeAI({
      apiKey,
      fetch: customFetch as typeof fetch,
    });
  }
  return createGoogleGenerativeAI({ apiKey });
}

const extractTextFromPDF = (buffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    // 参数 1 表示只提取纯文本
    const pdfParser = new (PDFParser as unknown as { new (a: unknown, b: number): PDFParser })(null, 1);

    pdfParser.on("pdfParser_dataError", (errMsg: unknown) => {
      const anyMsg = errMsg as { parserError?: unknown };
      reject(anyMsg?.parserError ?? errMsg);
    });
    pdfParser.on("pdfParser_dataReady", () => {
      try {
        const rawText = (pdfParser as unknown as { getRawTextContent: () => string }).getRawTextContent();
        resolve(String(rawText || "").trim());
      } catch (e) {
        reject(e);
      }
    });

    (pdfParser as unknown as { parseBuffer: (buf: Buffer) => void }).parseBuffer(buffer);
  });
};

async function getPdfPageCount(buffer: Buffer): Promise<number> {
  const doc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  return doc.getPageCount();
}

/** 超长 PDF：pdf-parse（Branch B），禁用 worker 以降低 Next 服务端问题 */
async function extractLongPdfTextWithPdfParse(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({
    data: buffer,
    disableWorker: true,
    useWorkerFetch: false,
  } as unknown as ConstructorParameters<typeof PDFParse>[0]);
  try {
    const textResult = await parser.getText();
    return String(textResult.text ?? "").trim();
  } finally {
    try {
      await parser.destroy();
    } catch {
      /* ignore */
    }
  }
}

type GeminiUploadCleanup = {
  fileManager: GoogleAIFileManager;
  fileId: string;
  tmpPath: string;
};

async function disposeGeminiUpload(c: GeminiUploadCleanup | null) {
  if (!c) return;
  try {
    await c.fileManager.deleteFile(c.fileId);
  } catch {
    /* ignore */
  }
  try {
    await unlink(c.tmpPath);
  } catch {
    /* ignore */
  }
}

/**
 * 删除「整行只有复制残留符号」的行（Monica 等 JSON/Markdown 碎片），并压缩空行。
 * 多轮执行：删行后可能形成新的连续空行，需再压一遍。
 */
function stripPluginArtifactLines(text: string): string {
  let t = String(text || "").replace(/\r\n?/g, "\n");
  if (!t.trim()) return "";
  const orphanLine =
    /^\s*[\}\]\)｝］】〕〉»"'」』]\s*$/gm;
  const orphanOpenLine =
    /^\s*[\{\[\(｛［【〔«"'「『]\s*$/gm;
  const junkOnlyLine = /^\s*[,，;；、]+\s*$/gm;
  for (let pass = 0; pass < 6; pass++) {
    const next = t
      .replace(orphanLine, "")
      .replace(orphanOpenLine, "")
      .replace(junkOnlyLine, "")
      .replace(/(\n\s*){3,}/g, "\n\n");
    if (next === t) break;
    t = next;
  }
  return t.trim();
}

/** PDF/提取文本入库与喂给模型前：去汉字间幽灵空格、压水平空白、启发式恢复段落与列表、收敛异常大空行 */
function sanitizeIngestRawText(rawText: string): string {
  let cleanText = String(rawText || "");
  cleanText = cleanText.replace(/\r\n?/g, "\n");
  cleanText = cleanText.replace(/(?<=[\u4e00-\u9fa5])\s+(?=[\u4e00-\u9fa5])/g, "");
  // 仅合并连续空格/制表符，避免 \s{2,} 把换行打成空格
  cleanText = cleanText.replace(/[ \t]{2,}/g, " ");
  // 启发式排版恢复（句号/列表前打断，便于前端 whitespace-pre-wrap 呈现段落）
  cleanText = cleanText.replace(/([。！？；])\s*/g, "$1\n\n");
  cleanText = cleanText.replace(/(\n|^)(\d+\.|•|-)\s/g, "\n\n$2 ");
  // 连续 3 段以上「换行 + 中间夹杂空格/空白」压成双换行，消灭 PDF 抽文本带来的大块空行
  cleanText = cleanText.replace(/(\n\s*){3,}/g, "\n\n");
  cleanText = stripPluginArtifactLines(cleanText);
  return cleanText.trim();
}

const RATE_LIMIT_MESSAGE =
  "AI 思考过于频繁或文档过长导致额度超限，请稍后再试。";

function ingestJsonErrorResponse(status: number, error: string) {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function isLikelyRateLimitMessage(msg: string) {
  const m = msg.toLowerCase();
  return (
    m.includes("429") ||
    m.includes("resource exhausted") ||
    m.includes("resource_exhausted") ||
    m.includes("too many requests") ||
    (m.includes("quota") && m.includes("exceed"))
  );
}

/** 在仍返回 200 流时写入 [[ERROR]] 的简短文案 */
function errorMessageForStream(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (isLikelyRateLimitMessage(msg)) return RATE_LIMIT_MESSAGE;
  return msg || "Unknown error";
}

/**
 * Gemini / 网络错误 → 标准 JSON Response（在尚未发送 200 流之前使用）
 */
function mapAiSdkErrorToIngestResponse(e: unknown): Response {
  const msg = e instanceof Error ? e.message : String(e);
  if (isLikelyRateLimitMessage(msg)) {
    return ingestJsonErrorResponse(429, RATE_LIMIT_MESSAGE);
  }
  // 尽量从错误对象里解析出 HTTP status（Google SDK 的错误结构在不同版本可能不同）
  const anyErr = e as {
    status?: unknown;
    statusCode?: unknown;
    response?: { status?: unknown };
    error?: { code?: unknown; message?: unknown };
    message?: unknown;
  };
  const statusCandidate =
    (typeof anyErr?.statusCode === "number" && anyErr.statusCode) ||
    (typeof anyErr?.status === "number" && anyErr.status) ||
    (typeof anyErr?.response?.status === "number" && anyErr.response.status) ||
    (typeof anyErr?.error?.code === "number" && anyErr.error.code) ||
    null;
  const status =
    typeof statusCandidate === "number" && statusCandidate >= 400 && statusCandidate < 600
      ? statusCandidate
      : 500;
  return ingestJsonErrorResponse(status, msg || "服务器错误");
}

function safeTrim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** 清洗外部插件（如 Monica）粘贴的正文：时间戳链接、孤立括号行、过多空行（先于与 PDF 合并） */
function sanitizeIngestPastedText(pastedText: string): string {
  let sanitizedPastedText = pastedText ? pastedText : "";
  if (!sanitizedPastedText) return "";
  sanitizedPastedText = sanitizedPastedText
    .replace(/\r\n?/g, "\n")
    // [04:09](https://...) → 只保留 [04:09]
    .replace(/\[(\d{2}:\d{2}(:\d{2})?)\]\([^)]+\)/g, "[$1]")
    .trim();
  sanitizedPastedText = stripPluginArtifactLines(sanitizedPastedText);
  return sanitizedPastedText;
}

function clampInt(n: unknown, min: number, max: number) {
  const x = Math.floor(Number(n));
  if (!Number.isFinite(x)) return min;
  return Math.min(max, Math.max(min, x));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function textToNotionParagraphBlocks(text: string): Array<Record<string, unknown>> {
  const t = (text || "").replace(/\r\n/g, "\n").trim();
  if (!t) return [];
  const paras = t.split(/\n{2,}/g).map((x) => x.trim()).filter(Boolean);
  const blocks: Array<Record<string, unknown>> = [];
  const chunk = 1900;
  for (const p of paras) {
    const richTexts: Array<Record<string, unknown>> = [];
    for (let i = 0; i < p.length; i += chunk) {
      richTexts.push({ type: "text", text: { content: p.slice(i, i + chunk) } });
    }
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: richTexts },
    } as Record<string, unknown>);
  }
  return blocks;
}


function extractTldr(aiSummary: string): string {
  const t = String(aiSummary || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
  if (!t) return "";
  const m = t.match(/TL;DR[\s\S]*?(?:\n{2,}|$)/i);
  const block = (m?.[0] ?? "").trim();
  const firstLine = block
    ? block
        .split("\n")
        .map((x) => x.replace(/^[-*]\s+/, "").trim())
        .filter(Boolean)[0] ?? ""
    : "";
  const fallback = t.split("\n").map((x) => x.trim()).filter(Boolean)[0] ?? "";
  const out = (firstLine || fallback).replace(/^#+\s+/, "").trim();
  return out.slice(0, 100);
}

async function fileToText(file: File): Promise<{ name: string; text: string }> {
  const name = file.name || "untitled";
  const type = (file.type || "").toLowerCase();
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const buf = Buffer.from(await file.arrayBuffer());

  try {
    if (
      type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      ext === "docx"
    ) {
      const out = await mammoth.extractRawText({ buffer: buf });
      return { name, text: String(out.value ?? "").trim() };
    }
    if (type === "text/plain" || ext === "txt") {
      return { name, text: buf.toString("utf8").trim() };
    }
  } catch (e) {
    const err = e as { message?: string };
    throw new Error(`Failed to parse ${name}: ${err?.message ?? "unknown parse error"}`);
  }

  throw new Error(`Unsupported file type: ${name} (${type || ext || "unknown"})`);
}

function isPdfFile(file: File) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();
  return type === "application/pdf" || name.endsWith(".pdf");
}

async function uploadPdfToGemini(file: File) {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    if (!apiKey) {
      throw new Error(
        "Server misconfiguration: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not set."
      );
    }

  const buf = Buffer.from(await file.arrayBuffer());
  const tmpDir = "/tmp";
  const safeBase = (file.name || "upload.pdf").replace(/[^\w.\-]+/g, "_");
  const tmpPath = path.join(tmpDir, `${Date.now()}-${safeBase}`);

  // 修复 FileManager 的代理传参：只有在 customFetch 存在时才注入，避免生产环境传入 undefined
  const fileManagerOptions = (customFetch
    ? { timeout: 300000, customFetch }
    : { timeout: 300000 }) as unknown as ConstructorParameters<typeof GoogleAIFileManager>[1];
  const fileManager = new GoogleAIFileManager(apiKey, fileManagerOptions);
  let fileId: string | null = null;
  let fileUri: string | null = null;
  let mimeType: string | null = null;

  try {
    // 按要求：先落盘到 /tmp（Next.js 运行环境可用）
    await writeFile(tmpPath, buf);

    // 再上传到 Google 文件服务，拿到 uri & mimeType
    const uploadResp = await fileManager.uploadFile(buf, {
      mimeType: "application/pdf",
      displayName: file.name || "uploaded.pdf",
    });
    fileId = uploadResp.file.name;
    fileUri = uploadResp.file.uri;
    mimeType = uploadResp.file.mimeType;
    if (!fileId || !fileUri || !mimeType) {
      throw new Error("Gemini file upload returned incomplete metadata.");
    }

    // 上传后可能是 PROCESSING，需等待 ACTIVE
    const start = Date.now();
    while (true) {
      const meta = await fileManager.getFile(fileId, { timeout: 300_000 });
      if (meta.state === "ACTIVE") break;
      if (meta.state === "FAILED") {
        throw new Error(`Gemini file processing failed: ${meta.error?.message ?? "unknown"}`);
      }
      if (Date.now() - start > 300_000) {
        throw new Error("Gemini file processing timeout.");
      }
      await new Promise((r) => setTimeout(r, 1200));
    }

    return { fileManager, fileId, fileUri, mimeType, tmpPath };
  } catch (e) {
    // 出错也要尽力清理
    try {
      if (fileId) await fileManager.deleteFile(fileId);
    } catch {}
    try {
      await unlink(tmpPath);
    } catch {}
    throw e;
  }
}

/** 视频字幕抓取能力已废弃：前端改为用户手动粘贴外部总结文本（pastedText）。 */

function buildNotebookLMMarkdownPrompt(args: {
  inputText?: string;
  isPdfMultimodal: boolean;
  fragment?: {
    index: number;
    total: number;
    pageRangeLabel: string;
  };
}) {
  const fragNote =
    args.fragment && args.fragment.total > 1
      ? [
          `【片段模式】这是整份 PDF 的第 ${args.fragment.index + 1}/${args.fragment.total} 个片段，仅覆盖第 ${args.fragment.pageRangeLabel} 页。`,
          "请只输出本片段的 Markdown 解析结果（不要输出 JSON / 代码块包裹的 JSON / 其他多余说明）。",
          "",
        ].join("\n")
      : "";

  const base = [
    fragNote,
    args.isPdfMultimodal
      ? "你正在阅读原版 PDF（可能含图表与排版），请结合多模态信息理解全篇结构与要点。"
      : "你正在阅读长文本资料，请完整理解结构与要点。",
    "",
    "你是『费曼式全篇复盘』专家。只输出 Markdown，禁止 JSON，禁止寒暄与自我评价。",
    "",
    "## 【覆盖与溯源 — 违反任一条即视为失败】",
    "",
    "你必须完整阅读并提炼全篇，**绝对不能遗漏任何一个核心章节**；不要为省字数跳过主体段落。若原文有十个大章，输出中应能对应到这些结构（标题可略作概括，但骨架要齐）。",
    "",
    "对于**每一个**章节（每个 `## 章节标题`），必须包含：",
    "",
    "1) **大白话翻译 (TL;DR)**：单独一段，用生活中最通俗的例子（如买菜、考试、过安检、交水电费等）解释该章概念，让完全外行的人也能秒懂。专业术语若不可避免，须用生活化比喻先兜底说明。",
    "2) **核心逻辑与红线**：**学术尾注（Footnote）**——**每章 3～5 条** `- ` 要点，句末带 `[1]` `[2]`…（章内连续）；**禁止**在要点下直接附原文；**全章要点列完后**空行 + `🔍 本章溯源档案：` + 空行 + **单一**引用块（多行 `> [n] \"摘录\"`）。规则与本轮 **System** 中【二】完全一致。",
    "",
    "【强制输出格式示例（结构必须一致，内容随资料变化）】",
    "",
    "## 章节原标题",
    "",
    "💡 大白话翻译 (TL;DR)：这里是用生活化比喻的通俗解释。",
    "",
    "🔴 核心逻辑与红线：",
    "",
    "- Override机制：当AI报黄灯时，交易员可点击强制解锁并输入理由，留下审计线索 [1]。",
    "- 复核队列与审查：这些记录自动进入复核队列，合规专家每周审查对错 [2]。",
    "",
    "🔍 本章溯源档案：",
    "",
    "> [1] \"触发: AI报黄灯/红灯 -> Trader点击Override(强制解锁)并输入理由。\"",
    "> [2] \"收集: 这些Override记录自动进入Review Queue。复核: 合规专家每周审查。\"",
    "",
    "内容须详实、层次分明；允许删除完全重复的废话，但不得把整章压成一句话敷衍了事。",
    "",
    "## 【输出结构（严格按序）】",
    "1) **先**按原文顺序写若干 `## 章节标题`，每章含：TL;DR + 角标要点列表 + 「本章溯源档案」引用块。",
    "2) **全部章节结束以后**，在整篇回答**最末尾**输出**唯一**一个 \\`\\`\\`mermaid 围栏；**彻底废弃 mindmap 语法**；围栏内**必须**使用商业架构图标准的 **flowchart LR**（从左到右）。",
    "",
    "## 【全景架构树（flowchart LR）— 违反任一条即视为失败】",
    "在输出完文字大纲后，你必须使用 \\`\\`\\`mermaid 代码块，生成一张高度结构化的全景树状图。",
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
    "全文只允许 **一个** mermaid 围栏，且**只能**出现在**所有章节之后**（不得放在正文开头）。",
    "",
    "## 【核心元数据（必写，置于全文最末）】",
    "在 mermaid 代码块的**最后一行** ``` 结束之后，**必须**另起**新行**输出以下**纯文本**围栏（不要使用 `##` 标题、不要把这些行包进任何 \\`\\`\\` 代码块）：",
    "",
    "---NOTION_META---",
    "title: 概括资料主题的精炼标题（建议 8～30 字，勿加书名号《》）",
    "keywords: 关键词1, 关键词2, 关键词3, 关键词4",
    "---END_NOTION_META---",
    "",
    "要求：`title:` 单行概括核心主题，用于数据库「资料名称」；`keywords:` 后为 **4～8** 个核心检索词（中文名词或专业短语），用**英文半角逗号**分隔；须覆盖资料主题、方法论或业务主线；禁止使用「分析」「总结」「概述」「视频」「内容」等空泛词。`---END_NOTION_META---` 必须是全文最后一行。",
    "",
    "## 排版",
    "- 所有 `#` / `##` 标题后必须有空行再接正文",
    "- 章与章之间空一行",
    "- 不要表格、不要大块代码（除 mermaid 外）",
  ];

  if (args.inputText) {
    base.push("", "【资料正文（供提炼，不要复述）】：", args.inputText.slice(0, 180_000));
  }
  return base.join("\n");
}

/** Notion 对 select / title 等有长度上限，过长会导致整次写入失败 */
function notionSafeTitle(s: string) {
  return String(s).replace(/\r/g, "").slice(0, 2000);
}
function notionSafeSelectName(s: string) {
  return String(s).replace(/\r/g, "").slice(0, 100);
}

/** 从大纲正文取首个实质章节标题（跳过说明性 ##） */
function extractIngestTitleFromOutline(md: string): string {
  const t = String(md || "");
  const h1 = t.match(/^#\s+(.+)$/m);
  if (h1?.[1]) return safeTrim(h1[1]).slice(0, 200);
  for (const line of t.split("\n")) {
    const m = line.match(/^##\s+(.+)$/);
    if (!m?.[1]) continue;
    const h = safeTrim(m[1]);
    if (!h) continue;
    if (/^【/.test(h)) continue;
    if (/输出结构|全景架构|核心关键词|核心元数据|^排版$/i.test(h)) continue;
    return h.slice(0, 200);
  }
  return "";
}

function resolveIngestPageTitle(args: {
  explicitFromForm: string;
  metaTitle: string;
  outlineMd: string;
  pdfFile: File | null;
  firstNonPdfName: string | null;
  hasPastedText: boolean;
}): string {
  if (args.explicitFromForm) return notionSafeTitle(args.explicitFromForm);
  const fromMeta = safeTrim(args.metaTitle).replace(/^《\s*/, "").replace(/\s*》$/, "");
  if (fromMeta) return notionSafeTitle(fromMeta);
  const fromHeading = extractIngestTitleFromOutline(args.outlineMd);
  if (fromHeading) return notionSafeTitle(fromHeading);
  if (args.pdfFile?.name) {
    return notionSafeTitle(args.pdfFile.name.replace(/\.[^.]+$/, ""));
  }
  if (args.firstNonPdfName) {
    return notionSafeTitle(args.firstNonPdfName.replace(/\.[^.]+$/, ""));
  }
  if (args.hasPastedText) return "视频文稿";
  return "新资料";
}

function fallbackIngestKeywords(outlineMd: string, title: string): string[] {
  const t = notionSafeTitle(title).replace(/\.[^.]+$/, "").trim();
  const fromTitle = normalizeNotebookKeywords(
    t.split(/[\s\u3000/、,，;；|]+/).filter(Boolean)
  );
  if (fromTitle.length >= 2) return fromTitle.slice(0, 8);
  const m = outlineMd.match(/^##\s+(.+)$/m);
  if (m?.[1]) {
    const fromHeading = normalizeNotebookKeywords(m[1].split(/[｜|/]/)[0]!);
    if (fromHeading.length) return fromHeading;
  }
  return ["资料学习"];
}

async function createNotionPageFromMarkdown(args: {
  title: string;
  docType: string;
  sourceUrl: string | null;
  extendedMediaUrl: string | null;
  rawText: string;
  aiSummary: string;
  coreKeywords?: string[];
}) {
  try {
    const notionKey = process.env.NOTION_API_KEY;
    const databaseId = process.env.NOTION_DATABASE_ID_KNOWLEDGE;
    if (!notionKey || !databaseId) {
      throw new Error("Missing NOTION_API_KEY or NOTION_DATABASE_ID_KNOWLEDGE");
    }

    const notion = createNotionClient(notionKey);

    const titleSafe = notionSafeTitle(args.title || "未命名资料");
    const tldr = extractTldr(args.aiSummary);

    // 按 Notion 数据库中文列名 1:1 精准映射（字段类型严格对应）
    const properties = {
      "资料名称": {
        title: [{ text: { content: titleSafe } }],
      },
      "核心知识提炼": {
        rich_text: [{ text: { content: notionSafeTitle(tldr).slice(0, 100) || "（AI TL;DR）" } }],
      },
      "资料类型": {
        select: { name: notionSafeSelectName(args.docType || "未分类") },
      },
      "资料来源": {
        url: args.sourceUrl || null,
      },
      "扩展阅读流媒体": {
        url: args.extendedMediaUrl || null,
      },
    } as Record<string, unknown>;

    const kwList = (args.coreKeywords ?? [])
      .map((k) => notionSafeSelectName(k))
      .filter(Boolean)
      .slice(0, 8);
    if (kwList.length) {
      properties["核心关键词"] = {
        multi_select: kwList.map((name) => ({ name })),
      };
    }

    const notionProperties = properties as unknown as Parameters<
      typeof notion.pages.create
    >[0]["properties"];

    const rawBlocks = textToNotionParagraphBlocks(args.rawText);
    const aiBlocks = mdToNotionBlocks(args.aiSummary);

    const allChildren = [
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: "资料原文（rawText）" } }] },
      },
      { object: "block", type: "divider", divider: {} },
      ...rawBlocks,
      { object: "block", type: "divider", divider: {} },
      {
        object: "block",
        type: "heading_2",
        heading_2: { rich_text: [{ type: "text", text: { content: "AI 提炼大纲（aiSummary）" } }] },
      },
      { object: "block", type: "divider", divider: {} },
      ...aiBlocks,
    ] as Array<Record<string, unknown>>;

    console.log("Notion Payload 组装完成，正在尝试写入...");
    const childrenArr = allChildren as unknown as Array<
      Parameters<typeof notion.blocks.children.append>[0]["children"][number]
    >;
    const chunks = chunkArray(childrenArr, 100);

    const firstChunk = chunks[0] ?? [];
    const page = await notion.pages.create({
      parent: { database_id: databaseId },
      properties: notionProperties,
      children: firstChunk as unknown as Parameters<typeof notion.pages.create>[0]["children"],
    });

    const newPageId = String((page as { id?: unknown } | null)?.id ?? "");
    if (!newPageId) {
      throw new Error("Notion pages.create succeeded but returned empty page id");
    }

    for (const chunk of chunks.slice(1)) {
      if (!chunk.length) continue;
      await notion.blocks.children.append({
        block_id: newPageId,
        children: chunk,
      });
    }

    return page as unknown;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[createNotionPage] failed:", msg);
    throw new Error(`Notion 写入失败：${msg}`);
  }
}

async function appendFragmentToNotionPage(args: {
  pageId: string;
  fragmentLabel: string;
  rawText: string;
  aiSummary: string;
}) {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) {
    throw new Error("Missing NOTION_API_KEY");
  }

  const notion = createNotionClient(notionKey);
  const rawBlocks = textToNotionParagraphBlocks(args.rawText);
  const aiBlocks = mdToNotionBlocks(args.aiSummary);

  const label = notionSafeTitle(args.fragmentLabel || "后续片段");
  const children = [
    { object: "block", type: "divider", divider: {} },
    {
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: label } }],
      },
    },
    ...rawBlocks,
    { object: "block", type: "divider", divider: {} },
    ...aiBlocks,
  ] as Array<Record<string, unknown>>;

  const childrenArr = children as unknown as Array<
    Parameters<typeof notion.blocks.children.append>[0]["children"][number]
  >;
  const chunks = chunkArray(childrenArr, 100);
  for (const chunk of chunks) {
    if (!chunk.length) continue;
    await notion.blocks.children.append({
      block_id: args.pageId,
      children: chunk,
    });
  }
}

export async function POST(req: Request) {
  // 纯文本直读引擎：不再依赖 Google File API 上传，因此无需 cleanup

  try {
    const apiKey =
      process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    if (!apiKey) {
      return new Response(
        JSON.stringify({
          error:
            "Server misconfiguration: GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY is not set.",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const form = await req.formData();
    // 前端已改为用户手动粘贴的外部总结/字幕文本。
    // 兼容旧字段：若没有 pastedText，则退回尝试读取 videoUrl（避免历史版本客户端直接报错）。
    const pastedText = safeTrim(form.get("pastedText") ?? form.get("videoUrl"));
    const sanitizedPastedText = sanitizeIngestPastedText(pastedText);
    const sourceUrlForm = safeTrim(form.get("sourceUrl"));
    const materialTypeRaw = safeTrim(form.get("materialType"));
    const modelIdRaw = safeTrim(form.get("modelId") ?? form.get("model"));
    const files = form.getAll("files").filter((x) => x instanceof File) as File[];

    const allowedModelIds = new Set([
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-2.5-pro",
      "gemini-2.0-flash-001",
      "gemini-2.0-flash-lite-001",
      "gemini-2.0-flash-lite",
      "gemini-2.5-flash-lite",
    ]);
    const modelId = allowedModelIds.has(modelIdRaw) ? modelIdRaw : "gemini-2.5-flash";

    const fragmentIndexRaw = safeTrim(form.get("fragmentIndex"));
    const totalFragmentsRaw = safeTrim(form.get("totalFragments"));
    const fragmentIndex =
      fragmentIndexRaw === "" ? 0 : clampInt(Number(fragmentIndexRaw), 0, 10_000);
    const totalFragments =
      totalFragmentsRaw === "" ? 1 : Math.max(1, clampInt(Number(totalFragmentsRaw), 1, 10_000));
    const parentPageId = safeTrim(form.get("parentPageId"));
    const pageRangeLabel = safeTrim(form.get("pageRangeLabel")) || String(fragmentIndex + 1);

    if (fragmentIndex > 0 && !parentPageId) {
      return ingestJsonErrorResponse(400, "后续片段需要 parentPageId。");
    }

    if (!files.length && !sanitizedPastedText) {
      return new Response(
        JSON.stringify({ error: "请至少上传 1 个文件，或粘贴外部总结文本。" }),
        {
        status: 400,
        headers: { "Content-Type": "application/json" },
        }
      );
    }

    const pdfFile = files.find((f) => isPdfFile(f)) ?? null;
    const nonPdfFiles = files.filter((f) => !isPdfFile(f));

    if (fragmentIndex > 0 && !pdfFile) {
      return ingestJsonErrorResponse(400, "后续片段需要上传 PDF 切片文件。");
    }

    const parsed =
      fragmentIndex === 0
        ? await Promise.all(nonPdfFiles.map((f) => fileToText(f)))
        : [];
    const fileText = parsed
      .map((p) => `【文件】${p.name}\n${p.text}`)
      .join("\n\n")
      .trim();

    const pastedForThisFragment = fragmentIndex === 0 ? sanitizedPastedText : "";
    // 先把“来自文件的文本（pdf/word/截图提取等）”与“用户粘贴的外部总结/字幕”拼起来，
    // 后续如遇 PDF 视觉/纯文本模式，会继续把原始 PDF 文本补齐进同一条 rawText。
    const mergedText = [fileText, pastedForThisFragment].filter(Boolean).join("\n\n").trim();

    if (!pdfFile && files.length && fileText.length < 20) {
      return new Response(JSON.stringify({ error: "文件解析结果过短，可能是扫描版 PDF 或空文件。" }), {
        status: 422,
        headers: { "Content-Type": "application/json" },
      });
    }

    /** 双引擎路由：≤3 页走 FileManager 多模态；>3 页走 pdf-parse 纯文本（不上传文件） */
    const VISUAL_PAGE_MAX = 3;
    let rawText = mergedText;
    let geminiFileCleanup: GeminiUploadCleanup | null = null;
    let useVisualPdf = false;
    let visualFilePart: Part | null = null;

    if (pdfFile) {
      const pdfBuf = Buffer.from(await pdfFile.arrayBuffer());
      const totalPages = await getPdfPageCount(pdfBuf);
      useVisualPdf = totalPages > 0 && totalPages <= VISUAL_PAGE_MAX;

      if (useVisualPdf) {
        let pdfLayerText = "";
        try {
          pdfLayerText = await extractTextFromPDF(pdfBuf);
        } catch {
          pdfLayerText = "";
        }
        if (!pdfLayerText.trim()) {
          pdfLayerText =
            "（该 PDF 无文本层或无法提取纯文本，已使用视觉多模态引擎解析版面与图表。）";
        }
        // 按要求：PDF 文本先于用户粘贴的 sanitizedPastedText，并把非 PDF 文件文本作为附加输入。
        rawText = [pdfLayerText, pastedForThisFragment, fileText].filter(Boolean).join("\n\n").trim();
        const pdfFileForUpload = new File([new Uint8Array(pdfBuf)], pdfFile.name || "upload.pdf", {
          type: "application/pdf",
        });
        try {
          const up = await uploadPdfToGemini(pdfFileForUpload);
          geminiFileCleanup = {
            fileManager: up.fileManager,
            fileId: up.fileId,
            tmpPath: up.tmpPath,
          };
          visualFilePart = {
            fileData: { fileUri: up.fileUri, mimeType: up.mimeType },
          };
        } catch (e) {
          await disposeGeminiUpload(geminiFileCleanup);
          return mapAiSdkErrorToIngestResponse(e);
        }
      } else {
        const pdfPlain = await extractLongPdfTextWithPdfParse(pdfBuf);
        rawText = [pdfPlain, pastedForThisFragment, fileText].filter(Boolean).join("\n\n").trim();
        if (!rawText) {
          return ingestJsonErrorResponse(
            422,
            "PDF 纯文本提取为空（可能是扫描版或受保护 PDF），超长文档无法使用纯文本引擎处理。"
          );
        }
      }
    }

    if (fragmentIndex === 0 && sourceUrlForm) {
      rawText = `资料来源：${sourceUrlForm}\n\n${rawText}`.trim();
    }

    rawText = sanitizeIngestRawText(rawText);

    // 严格按需求：把 PDF 解析文本（如有）与用户粘贴（已净化）合并后喂给模型。
    const promptSupplement = rawText.trim() || undefined;

    const prompt = buildNotebookLMMarkdownPrompt({
      inputText: promptSupplement,
      isPdfMultimodal: Boolean(pdfFile && useVisualPdf),
      fragment:
        totalFragments > 1
          ? {
              index: fragmentIndex,
              total: totalFragments,
              pageRangeLabel,
            }
          : undefined,
    });

    // ✅ 多模态仍用 File API 取 file.uri；生成走 @ai-sdk/google + streamText，开发环境显式传入代理 fetch
    const googleProvider = createIngestGoogleProvider(apiKey);
    const systemPrompt =
      "你是一名极其严谨的金融合规 AI 分析师。为了确保长文档 100% 核心覆盖且零幻觉，你必须遵守以下铁律（仅输出 Markdown，禁止 JSON）。\n\n" +
      "【一、防漏检扫描】在心里通读全文，列出所有核心章节；必须从开篇覆盖到收尾，禁止跳过中间章节。\n\n" +
      "【二、溯源式提炼 · 学术尾注（Footnote）—— 提炼与原文必须物理隔离】\n" +
      "为保证阅读流不被打断：**核心逻辑展示**与**独立溯源档案**分层输出，禁止穿插。\n\n" +
      "**（1）核心逻辑展示**：在 `## 章节标题`、💡 **大白话翻译 (TL;DR)** 之后，输出 🔴 **核心逻辑与红线：**（可加一空行）下挂 **3～5 条** `- ` 无序列表。**每条要点句末**必须紧跟数字角标 `[1]`、`[2]`…（**章内从 [1] 连续编号**）。要点中可用 `**加粗**` 突出判断；**要点行及列表区域内禁止**出现长段原文、`> ` 引用、`🔍 原文溯源` 段落、或 `_(来源溯源…)_` 等任何「边写边引」。\n\n" +
      "**（2）独立溯源档案**：当该章**全部**要点列表结束后 → **空一行** → 单独一行标题 **`🔍 本章溯源档案：`** → **再空一行** → 使用 **一个完整的 Markdown 引用块**：其中**每一行**以 `> ` 开头，格式 **`[n] \"资料正文中逐字复制的精简摘录\"`**，与上文角标 **一一对应**。摘录尽量短，禁止改写或捏造；无依据则删除该要点及其 `[n]` 条目。\n\n" +
      "【三、反例（绝对禁止）】在每条 `- ` 要点**正下方**立刻写 `> …` 或粘贴原文；或在要点与要点之间夹入溯源段——**一律禁止**。\n\n" +
      "【四、强制格式示例（章节骨架须一致）】\n" +
      "## 章节原标题\n\n" +
      "💡 大白话翻译 (TL;DR)：这里是用生活化比喻的通俗解释。\n\n" +
      "🔴 核心逻辑与红线：\n\n" +
      "- Override机制：当AI报黄灯时，交易员可点击强制解锁并输入理由，留下审计线索 [1]。\n" +
      "- 复核队列与审查：这些记录自动进入复核队列，合规专家每周审查对错 [2]。\n\n" +
      "🔍 本章溯源档案：\n\n" +
      "> [1] \"触发: AI报黄灯/红灯 -> Trader点击Override(强制解锁)并输入理由。\"\n" +
      "> [2] \"收集: 这些Override记录自动进入Review Queue。复核: 合规专家每周审查。\"\n\n" +
      "【五、致命约束】全文须涵盖**所有**核心章节；凡正文出现角标 `[n]`，**必须**在该章「本章溯源档案」引用块内出现对应 `[n]` 原文摘录，且编号连续、无遗漏。";

    // 末尾强制输出思维导图 Mermaid 代码块（front-end 拆分展示）
    const systemPromptWithDiagram =
      `${systemPrompt}\n\n` +
      "【六、全景架构树（文末唯一 Mermaid）】\n" +
      "在输出完所有章节的文字大纲后，你必须在整篇回答的最末尾使用 Markdown 的 ```mermaid 代码块，生成一张高度结构化的全景树状图。彻底废弃 mindmap，必须使用 flowchart LR。\n\n" +
      "【强制语法要求】\n" +
      "· 必须使用 flowchart LR；第一行仅写 flowchart LR，独占一行。禁止 mindmap、graph TD/TB 等。\n" +
      "· 绝对不能画成一条单向直线：以文档主题为根，向右多子模块，再向右发散细节；一对多分支，不要整图单链 A→B→C→D。\n" +
      "· 极简文字：节点内最好不超过 8 个字，去掉冗余修饰词。\n" +
      "· 安全包裹：所有节点显示文本使用 节点ID[\"文本\"] 形式，防止特殊符号解析崩溃。\n" +
      "· 至少 3～4 层深度；全文仅此一处 mermaid 围栏，且必须在全部章节之后。\n\n" +
      "【正确的、绝对不重叠的树状图示例】\n" +
      "flowchart LR\n" +
      "  Root[\"Pre-trade合规AI\"] --> M1[\"模块一：规则采集\"]\n" +
      "  Root --> M2[\"模块二：智能审查\"]\n" +
      "  Root --> M3[\"异常与兜底处理\"]\n" +
      "  M1 --> M1A[\"多源实时采集\"]\n" +
      "  M1 --> M1B[\"多模态视觉解析\"]\n" +
      "  M2 --> M2A[\"上下文数据聚合\"]\n" +
      "  M2 --> M2B[\"混合检索(RAG)\"]\n" +
      "  M2 --> M2C[\"AI语义决策(L1)\"]\n" +
      "  M3 --> M3A[\"知识盲区(黄灯)\"]\n" +
      "  M3 --> M3B[\"系统宕机(Fail-Open)\"]\n" +
      "  M3 --> M3C[\"专家复核(Review)\"]\n\n" +
      "请遵循这种一对多分支语法，基于文档画出从左到右、层级分明、排版清爽的架构树。\n\n" +
      "【七、文末元数据】在 mermaid 围栏闭合 ``` 之后，按 User 要求输出 ---NOTION_META---，须含 `title:` 与 `keywords:` 两行键值，再 ---END_NOTION_META---；仅此一处允许纯键值元数据，禁止其他任何 JSON。";

    type UserPart =
      | { type: "text"; text: string }
      | { type: "file"; data: URL; mediaType: string };
    const userContent: UserPart[] = [{ type: "text", text: prompt }];
    if (visualFilePart?.fileData?.fileUri && visualFilePart.fileData.mimeType) {
      userContent.push({
        type: "file",
        data: new URL(visualFilePart.fileData.fileUri),
        mediaType: visualFilePart.fileData.mimeType,
      });
    }

    let streamResult: ReturnType<typeof streamText>;
    try {
      streamResult = streamText({
        model: googleProvider(modelId as Parameters<ReturnType<typeof createGoogleGenerativeAI>>[0]),
        system: systemPromptWithDiagram,
        messages: [{ role: "user", content: userContent }],
        temperature: 0.15,
        maxOutputTokens: 8192,
      });
    } catch (e) {
      await disposeGeminiUpload(geminiFileCleanup);
      return mapAiSdkErrorToIngestResponse(e);
    }

    /** 先拉取首包：若此处 429/网络失败，仍可返回 JSON 而非已开始的 text/plain 流 */
    const respIter = streamResult.textStream[Symbol.asyncIterator]();
    let firstDelta: string | undefined;
    try {
      const first = await respIter.next();
      if (!first.done) {
        firstDelta = first.value;
      }
    } catch (e) {
      await disposeGeminiUpload(geminiFileCleanup);
      return mapAiSdkErrorToIngestResponse(e);
    }

    const encoder = new TextEncoder();
    let accumulated = firstDelta ?? "";
    let full = accumulated;

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          // SSE: 先发 rawText（按块切分避免超大单帧）
          const send = (event: string, data: unknown) => {
            controller.enqueue(
              encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
            );
          };

          const rawChunks = chunkArray(Array.from(rawText), 8000).map((arr) => arr.join(""));
          for (const c of rawChunks) {
            send("rawTextChunk", { text: c });
          }

          if (firstDelta !== undefined && firstDelta !== "") {
            send("aiDelta", { delta: firstDelta });
          }
          while (true) {
            const n = await respIter.next();
            if (n.done) break;
            const delta = n.value;
            if (delta) {
              accumulated += delta;
              full = accumulated;
              send("aiDelta", { delta });
            }
          }

        let markdown = String(full || "").replace(/\r\n/g, "\n").replace(/\\n/g, "\n").trim();
        if (!markdown) throw new Error("模型输出为空（未返回 Markdown 内容）。");

          try {
            const repaired = await repairOutlineMarkdownSourceTraces(
              googleProvider(modelId as Parameters<ReturnType<typeof createGoogleGenerativeAI>>[0]),
              markdown,
              rawText,
              2
            );
            markdown = repaired.markdown;
            if (repaired.repairPasses > 0) {
              send("aiFull", { text: markdown });
            }
            if (!repaired.ok) {
              const { violations } = validateRedLineSourceTraces(markdown);
              send("traceWarn", {
                message: `红线尾注/本章溯源档案格式未完全通过自动校验（仍有 ${violations.length} 处待核对），请人工核对。`,
              });
            }
          } catch (traceErr) {
            console.warn("[knowledge/ingest] outline trace repair failed:", traceErr);
            send("traceWarn", { message: "溯源格式自动修正失败，已保留模型原文，请人工核对。" });
          }

          markdown = fixMermaidMindmapIndentInMarkdown(markdown);

          const hadMetaFence = markdown.includes(NOTEBOOK_META_END);
          const splitMeta = splitNotebookMetaBlock(markdown);
          let outlineBody = splitMeta.body.trim();

          const title = resolveIngestPageTitle({
            explicitFromForm: safeTrim(form.get("title")),
            metaTitle: splitMeta.meta.title ?? "",
            outlineMd: outlineBody,
            pdfFile,
            firstNonPdfName: parsed[0]?.name ?? null,
            hasPastedText: Boolean(sanitizedPastedText),
          });
          let coreKeywords = normalizeNotebookKeywords(splitMeta.meta.keywords);
          if (!coreKeywords.length) {
            coreKeywords = fallbackIngestKeywords(outlineBody, title);
          }
          markdown = outlineBody;
          if (hadMetaFence) {
            send("aiFull", { text: outlineBody });
          }
          const materialTypeClean =
            materialTypeRaw && INGEST_MATERIAL_TYPES.has(materialTypeRaw) ? materialTypeRaw : "";
          const docType = materialTypeClean
            ? materialTypeClean
            : pdfFile
              ? "PDF"
              : sanitizedPastedText
                ? "视频链接"
                : "未分类";
          const notionSourceUrl =
            sourceUrlForm && /^https?:\/\//i.test(sourceUrlForm) ? sourceUrlForm : null;
          const extendedMediaUrl = null;

          let notionPageId = "";
          try {
            if (fragmentIndex === 0) {
              const page = await createNotionPageFromMarkdown({
                title,
                docType,
                sourceUrl: notionSourceUrl,
                extendedMediaUrl,
                rawText,
                aiSummary: markdown,
                coreKeywords,
              });
              notionPageId = String((page as { id?: unknown } | null)?.id ?? "");
            } else {
              await appendFragmentToNotionPage({
                pageId: parentPageId,
                fragmentLabel: `片段 ${fragmentIndex + 1}/${totalFragments} · 第 ${pageRangeLabel} 页`,
                rawText,
                aiSummary: markdown,
              });
              notionPageId = parentPageId;
            }
          } catch (notionErr) {
            throw new Error(
              notionErr instanceof Error ? notionErr.message : "Notion 写入失败"
            );
          }

          if (!notionPageId) {
            throw new Error("Notion 未返回有效页面 ID");
          }

          // 在流尾部追加一个不会影响正文展示的标记（前端可用它触发跳转/刷新）
          send("done", { pageId: notionPageId, title });
          controller.close();
        } catch (e) {
          const msg = errorMessageForStream(e);
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ message: msg })}\n\n`));
          controller.close();
        } finally {
          await disposeGeminiUpload(geminiFileCleanup);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    return mapAiSdkErrorToIngestResponse(err);
  }
}

