import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";
import { getHvNotionAuthToken } from "@/lib/hv-analysis/notion-save";
import type { HvQaItem, HvQaResult } from "@/lib/hv-analysis/qa-types";

type NotionPage = {
  id?: string;
  object?: string;
  created_time?: string;
  properties?: Record<string, unknown>;
};

type NotionBlock = Record<string, unknown> & {
  id?: string;
  type?: string;
  has_children?: boolean;
};

export type HvHistoryListItem = {
  id: string;
  title: string;
  target: string;
  createdAt: string;
  /** 从 QA_Data JSON 解析的质检综合分（0–100），无数据时不返回 */
  overallScore?: number;
};

const HV_TITLE_SUFFIX = /\s*·\s*横纵分析\s*$/;

function titlePlain(prop: unknown): string {
  const p = prop as { title?: Array<{ plain_text?: string }> } | undefined;
  const t = p?.title;
  if (!Array.isArray(t) || t.length === 0) return "";
  return t.map((x) => x?.plain_text ?? "").join("").trim();
}

function getQaDataPropertyKey(): string {
  return process.env.NOTION_HV_PROP_QA_DATA?.trim() || "QA_Data";
}

function richTextAllPlain(prop: unknown): string {
  const p = prop as { rich_text?: Array<{ plain_text?: string; text?: { content?: string } }> };
  const rt = p?.rich_text;
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt
    .map((x) => x?.plain_text ?? x?.text?.content ?? "")
    .join("")
    .trim();
}

function normalizeStoredQaData(parsed: unknown): HvQaResult | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const itemsRaw = Array.isArray(o.items) ? o.items : [];
  if (itemsRaw.length === 0) return null;

  const items: HvQaItem[] = itemsRaw
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "").trim();
      if (!id) return null;
      return {
        id,
        title: String(r.title ?? id).trim() || id,
        pass: r.pass === true,
        reason: String(r.reason ?? "").trim() || "（无说明）",
      };
    })
    .filter((x): x is HvQaItem => x !== null);

  if (items.length === 0) return null;

  const score = Number(o.overallScore);
  const overallScore = Number.isFinite(score)
    ? Math.max(0, Math.min(100, Math.round(score)))
    : Math.round((items.filter((i) => i.pass).length / items.length) * 100);

  const metaRaw = o.meta;
  const meta =
    metaRaw && typeof metaRaw === "object"
      ? (metaRaw as HvQaResult["meta"])
      : undefined;

  return { overallScore, items, ...(meta ? { meta } : {}) };
}

/** 从 Notion QA_Data 富文本列拼接 JSON 并解析完整质检对象 */
export function parseQaDataFromProperties(
  properties: Record<string, unknown>,
): HvQaResult | null {
  const key = getQaDataPropertyKey();
  const raw = richTextAllPlain(properties[key]);
  if (!raw) return null;

  try {
    return normalizeStoredQaData(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** 从 Notion QA_Data 富文本列拼接 JSON 并解析 overallScore */
export function parseOverallScoreFromQaDataProperty(
  properties: Record<string, unknown>,
): number | undefined {
  return parseQaDataFromProperties(properties)?.overallScore;
}

export type HvHistoryDetail = {
  markdown: string;
  qaData: HvQaResult | null;
};

function findTitlePropertyKey(properties: Record<string, unknown>): string | null {
  const configured = process.env.NOTION_HV_PROP_TITLE?.trim();
  if (configured && configured in properties) return configured;
  for (const [key, val] of Object.entries(properties)) {
    if ((val as { type?: string })?.type === "title") return key;
  }
  for (const k of ["研究对象", "Name", "Title", "资料名称"]) {
    if (k in properties) return k;
  }
  return null;
}

export function parseHvTargetFromPageTitle(pageTitle: string): string {
  const t = pageTitle.trim();
  if (!t) return "未命名";
  const stripped = t.replace(HV_TITLE_SUFFIX, "").trim();
  return stripped || t;
}

export function getHvAnalysisDatabaseId(): string | null {
  return process.env.NOTION_DATABASE_ID_HV_ANALYSIS?.trim() || null;
}

export async function resolveHvDataSourceId(
  notion: Client,
  databaseId: string,
): Promise<string> {
  const db = (await withNotionRetryOnce(() =>
    notion.databases.retrieve({ database_id: databaseId }),
  )) as { data_sources?: Array<{ id: string }> };
  const dataSourceId = String(db?.data_sources?.[0]?.id ?? "").trim();
  if (!dataSourceId) {
    throw new Error("Notion HV database has no data_sources");
  }
  return dataSourceId;
}

function mapPageToListItem(page: NotionPage): HvHistoryListItem | null {
  if (page?.object !== "page") return null;
  const id = String(page.id ?? "").trim();
  if (!id) return null;

  const props = (page.properties ?? {}) as Record<string, unknown>;
  const titleKey = findTitlePropertyKey(props);
  const title = titleKey ? titlePlain(props[titleKey]) : "";
  const fullTitle = title || "未命名报告";

  const overallScore = parseOverallScoreFromQaDataProperty(props);

  return {
    id,
    title: fullTitle,
    target: parseHvTargetFromPageTitle(fullTitle),
    createdAt: String(page.created_time ?? "").trim() || new Date(0).toISOString(),
    ...(overallScore !== undefined ? { overallScore } : {}),
  };
}

export async function fetchHvHistoryList(
  pageSize = 50,
): Promise<HvHistoryListItem[]> {
  const token = getHvNotionAuthToken();
  const databaseId = getHvAnalysisDatabaseId();
  if (!token || !databaseId) {
    throw new Error("Missing NOTION_TOKEN/NOTION_API_KEY or NOTION_DATABASE_ID_HV_ANALYSIS");
  }

  const notion = createNotionClient(token);
  const dataSourceId = await resolveHvDataSourceId(notion, databaseId);

  const items: HvHistoryListItem[] = [];
  let cursor: string | undefined;

  do {
    const result = await withNotionRetryOnce(() =>
      notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: Math.min(100, Math.max(1, pageSize)),
        start_cursor: cursor,
        sorts: [{ timestamp: "created_time", direction: "descending" }],
      }),
    );

    for (const row of (result.results ?? []) as NotionPage[]) {
      const item = mapPageToListItem(row);
      if (item) items.push(item);
    }

    cursor = result.has_more ? (result.next_cursor ?? undefined) : undefined;
    if (items.length >= pageSize) break;
  } while (cursor);

  return items.slice(0, pageSize);
}

function blockRichTextPlain(block: NotionBlock): string {
  const type = String(block.type ?? "");
  if (!type) return "";
  const typed = (block[type] as { rich_text?: Array<{ plain_text?: string }> } | undefined) ?? {};
  const rt = typed.rich_text;
  if (!Array.isArray(rt)) return "";
  return rt.map((x) => x?.plain_text ?? "").join("");
}

const BODY_SECTION_HEADING = "完整报告正文";

function isBodySectionHeading(block: NotionBlock): boolean {
  if (String(block.type) !== "heading_2") return false;
  const text = blockRichTextPlain(block).replace(/\s+/g, " ").trim();
  return text.includes(BODY_SECTION_HEADING);
}

function blockToMarkdownLine(block: NotionBlock): string | null {
  const type = String(block.type ?? "");
  const text = blockRichTextPlain(block);

  switch (type) {
    case "paragraph":
      return text;
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
    case "quote":
      return text
        ? text
            .split("\n")
            .map((line) => `> ${line}`)
            .join("\n")
        : null;
    case "code": {
      if (!text) return null;
      const lang = String(
        ((block.code as { language?: string } | undefined)?.language ?? "").trim(),
      );
      return ["```" + (lang || ""), text, "```"].join("\n");
    }
    case "divider":
      return "---";
    default:
      return text || null;
  }
}

export async function listAllPageBlocks(
  notion: Client,
  pageId: string,
): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;

  do {
    const resp = await withNotionRetryOnce(() =>
      notion.blocks.children.list({
        block_id: pageId,
        page_size: 100,
        start_cursor: cursor,
      }),
    );
    for (const b of (resp.results ?? []) as NotionBlock[]) {
      out.push(b);
    }
    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return out;
}

/**
 * 将 HV 报告页 blocks 拼回 Markdown（跳过「完整报告正文」分区标题）。
 */
export function blocksToHvReportMarkdown(blocks: NotionBlock[]): string {
  let inBody = false;
  const parts: string[] = [];

  for (const block of blocks) {
    if (isBodySectionHeading(block)) {
      inBody = true;
      continue;
    }
    if (!inBody) continue;

    const type = String(block.type ?? "");
    if (type === "divider") continue;

    const line = blockToMarkdownLine(block);
    if (line !== null && line !== "") {
      parts.push(line);
    }
  }

  if (parts.length === 0) {
    for (const block of blocks) {
      if (isBodySectionHeading(block)) continue;
      const line = blockToMarkdownLine(block);
      if (line !== null && line !== "") parts.push(line);
    }
  }

  return parts.join("\n\n").replace(/\n{3,}/g, "\n\n").trim();
}

export async function fetchHvReportMarkdownByPageId(pageId: string): Promise<string> {
  const detail = await fetchHvReportDetailByPageId(pageId);
  return detail.markdown;
}

/** 并行拉取页面属性（QA_Data）与 blocks（Markdown 正文） */
export async function fetchHvReportDetailByPageId(
  pageId: string,
): Promise<HvHistoryDetail> {
  const token = getHvNotionAuthToken();
  if (!token) {
    throw new Error("Missing NOTION_TOKEN or NOTION_API_KEY");
  }

  const notion = createNotionClient(token);

  const [page, blocks] = await Promise.all([
    withNotionRetryOnce(() => notion.pages.retrieve({ page_id: pageId })),
    listAllPageBlocks(notion, pageId),
  ]);

  const props = ((page as NotionPage).properties ?? {}) as Record<string, unknown>;

  return {
    markdown: blocksToHvReportMarkdown(blocks),
    qaData: parseQaDataFromProperties(props),
  };
}
