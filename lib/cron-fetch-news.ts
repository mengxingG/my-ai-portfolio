import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";

/** 供 AI HOT 日报 API 复用（与 Engine A 采集无关） */
export const AIHOT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

export const AI_NEWS_UPDATE_API_URL =
  process.env.AI_NEWS_UPDATE_API_URL?.trim() || "http://127.0.0.1:8000";

export const AI_NEWS_UPDATE_TOPIC =
  process.env.AI_NEWS_UPDATE_TOPIC?.trim() || "AI";

export const AI_NEWS_UPDATE_DAYS = Math.min(
  366,
  Math.max(1, Number(process.env.AI_NEWS_UPDATE_DAYS ?? "1") || 1),
);

const FETCH_TIMEOUT_MS = Number(process.env.AI_NEWS_UPDATE_TIMEOUT_MS ?? "180000");
const BEIJING_TZ = "Asia/Shanghai";
const ENGINE_A_AUTHOR_PREFIX = "Engine A";
const NOTION_RICH_TEXT_MAX = 2000;

export type AiNewsUpdateRow = {
  Title?: string;
  Source?: string;
  Author?: string;
  URL?: string;
  OriginalText?: string;
  Date?: string;
  TimeRange?: string;
};

export type NormalizedNewsItem = {
  title?: string;
  summary?: string | null;
  source?: string;
  author?: string;
  url: string;
  dateYmd: string;
  publishedAt: string;
};

export type CronFetchNewsResult = {
  fetched: number;
  filtered: number;
  created: number;
  skippedDup: number;
  failed: number;
};

export function toBeijingYmd(input: string | Date): string | null {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: BEIJING_TZ });
}

export function getBeijingTodayAndYesterday(): { today: string; yesterday: string } {
  const today = toBeijingYmd(new Date())!;
  const yesterday = toBeijingYmd(new Date(Date.now() - 86_400_000))!;
  return { today, yesterday };
}

function richTextChunks(text: string) {
  const t = String(text ?? "").trim() || "无摘要";
  const chunks: Array<{ type: "text"; text: { content: string } }> = [];
  for (let i = 0; i < t.length; i += NOTION_RICH_TEXT_MAX) {
    chunks.push({
      type: "text",
      text: { content: t.slice(i, i + NOTION_RICH_TEXT_MAX) },
    });
  }
  return chunks;
}

function truncateTitle(text?: string): string {
  const t = String(text ?? "").trim() || "未命名";
  return t.length > 2000 ? t.slice(0, 2000) : t;
}

function formatAuthor(rawAuthor?: string): string {
  const author = String(rawAuthor ?? "").trim();
  if (!author || author === "Unknown") return ENGINE_A_AUTHOR_PREFIX;
  if (author.startsWith(ENGINE_A_AUTHOR_PREFIX)) return author;
  return `${ENGINE_A_AUTHOR_PREFIX} · ${author}`;
}

export function formatCronFetchError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function buildNotionNewsProperties(item: NormalizedNewsItem) {
  const originalText =
    item.summary != null && String(item.summary).trim()
      ? String(item.summary).trim()
      : "无摘要";
  const sourceName = String(item.source ?? "").trim() || "Unknown";

  return {
    Title: {
      title: [{ type: "text" as const, text: { content: truncateTitle(item.title) } }],
    },
    OriginalText: {
      rich_text: richTextChunks(originalText),
    },
    Source: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: sourceName.slice(0, NOTION_RICH_TEXT_MAX) },
        },
      ],
    },
    URL: {
      url: item.url,
    },
    Date: {
      date: { start: item.publishedAt || `${item.dateYmd}T12:00:00+08:00` },
    },
    Author: {
      rich_text: [
        {
          type: "text" as const,
          text: { content: formatAuthor(item.author).slice(0, NOTION_RICH_TEXT_MAX) },
        },
      ],
    },
  };
}

export async function fetchEngineAItems(): Promise<AiNewsUpdateRow[]> {
  const base = AI_NEWS_UPDATE_API_URL.replace(/\/$/, "");
  const url = `${base}/api/news?topic=${encodeURIComponent(AI_NEWS_UPDATE_TOPIC)}&days=${AI_NEWS_UPDATE_DAYS}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Engine A API 请求失败: HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
      );
    }

    const data = (await res.json()) as unknown;
    if (!Array.isArray(data)) {
      throw new Error("Engine A API 返回格式异常：期望 JSON 数组");
    }
    return data as AiNewsUpdateRow[];
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Engine A API 请求超时（${FETCH_TIMEOUT_MS}ms）: ${url}`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function filterEngineAItemsByBeijingTodayYesterday(
  items: AiNewsUpdateRow[],
): NormalizedNewsItem[] {
  const { today, yesterday } = getBeijingTodayAndYesterday();
  const filtered: NormalizedNewsItem[] = [];

  for (const raw of items) {
    try {
      const url = typeof raw.URL === "string" ? raw.URL.trim() : "";
      if (!url) continue;

      const dateYmd = raw.Date?.slice(0, 10) ?? "";
      if (!dateYmd || (dateYmd !== today && dateYmd !== yesterday)) continue;

      filtered.push({
        title: raw.Title,
        summary: raw.OriginalText,
        source: raw.Source,
        author: raw.Author,
        url,
        dateYmd,
        publishedAt: `${dateYmd}T12:00:00+08:00`,
      });
    } catch (err) {
      console.warn(
        `[cron-fetch-news] 单条清洗异常: ${formatCronFetchError(err)}`,
      );
    }
  }

  return filtered;
}

/**
 * 拉取 ai-news-update Engine A → 今/昨过滤 → 按 URL 去重写入 Notion。
 * @throws 环境变量缺失、API 拉取失败等致命错误
 */
export async function runCronFetchNews(): Promise<CronFetchNewsResult> {
  const notionApiKey = process.env.NOTION_API_KEY?.trim();
  const databaseId = process.env.NOTION_AI_NEWS_DB_ID?.trim();

  if (!notionApiKey) {
    throw new Error("缺少环境变量 NOTION_API_KEY");
  }
  if (!databaseId) {
    throw new Error("缺少环境变量 NOTION_AI_NEWS_DB_ID");
  }

  const notion = createNotionClient(notionApiKey);
  const rawItems = await fetchEngineAItems();
  const filtered = filterEngineAItemsByBeijingTodayYesterday(rawItems);

  let created = 0;
  let skippedDup = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const item of filtered) {
    try {
      const exists = await notionPageExistsByUrl(notion, databaseId, item.url);
      if (exists) {
        skippedDup += 1;
        continue;
      }

      await notion.pages.create({
        parent: { database_id: databaseId },
        properties: buildNotionNewsProperties(item),
      });
      created += 1;
    } catch (err) {
      failed += 1;
      errors.push(`${item.title ?? item.url}: ${formatCronFetchError(err)}`);
      console.error(`[cron-fetch-news] 写入失败: ${errors[errors.length - 1]}`);
    }
  }

  if (failed > 0) {
    throw new Error(
      `Notion 写入失败 ${failed} 条${errors[0] ? `（首条: ${errors[0]}）` : ""}`,
    );
  }

  return {
    fetched: rawItems.length,
    filtered: filtered.length,
    created,
    skippedDup,
    failed,
  };
}

let _cachedDataSourceId: string | null = null;

async function getDataSourceId(notion: Client, databaseId: string): Promise<string | null> {
  if (_cachedDataSourceId) return _cachedDataSourceId;
  try {
    const db = await notion.databases.retrieve({ database_id: databaseId });
    const ds = (db as any).data_sources?.[0];
    _cachedDataSourceId = ds?.id ?? null;
    return _cachedDataSourceId;
  } catch {
    return null;
  }
}

export async function notionPageExistsByUrl(
  notion: Client,
  databaseId: string,
  url: string,
): Promise<boolean> {
  try {
    const dataSourceId = await getDataSourceId(notion, databaseId);
    if (!dataSourceId) {
      console.warn("[cron-fetch-news] 数据库没有关联的数据源，跳过去重");
      return false;
    }

    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "URL",
        url: { equals: url },
      },
      page_size: 1,
    });
    return (res.results?.length ?? 0) > 0;
  } catch (err) {
    console.warn(
      `[cron-fetch-news] URL 去重查询失败，将继续尝试写入: ${formatCronFetchError(err)}`,
    );
    return false;
  }
}
