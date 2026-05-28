import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";

export const AIHOT_NEWS_URL =
  "https://aihot.virxact.com/api/public/items?mode=selected&take=30";

export const AIHOT_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const BEIJING_TZ = "Asia/Shanghai";
const AUTHOR_FIXED = "AI HOT 精选";
const NOTION_RICH_TEXT_MAX = 2000;

export type AihotRawItem = {
  id?: string;
  title?: string;
  url?: string;
  source?: string;
  publishedAt?: string;
  summary?: string | null;
  category?: string | null;
};

export type NormalizedNewsItem = {
  id?: string;
  title?: string;
  summary?: string | null;
  source?: string;
  url: string;
  dateYmd: string;
  publishedAt: string;
  category?: string | null;
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

export function formatCronFetchError(err: unknown): string {
  if (err instanceof Error) return err.message;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

async function notionPageExistsByUrl(
  notion: Client,
  databaseId: string,
  url: string,
): Promise<boolean> {
  try {
    const res = await notion.dataSources.query({
      data_source_id: databaseId,
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
      rich_text: [{ type: "text" as const, text: { content: AUTHOR_FIXED } }],
    },
  };
}

export async function fetchAihotItems(): Promise<AihotRawItem[]> {
  const res = await fetch(AIHOT_NEWS_URL, {
    method: "GET",
    headers: {
      "User-Agent": AIHOT_USER_AGENT,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `AI HOT API 请求失败: HTTP ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 300)}` : ""}`,
    );
  }

  const data = (await res.json()) as { items?: AihotRawItem[] };
  if (!data?.items || !Array.isArray(data.items)) {
    throw new Error("AI HOT API 返回格式异常：缺少 items 数组");
  }
  return data.items;
}

export function filterAihotItemsByBeijingTodayYesterday(
  items: AihotRawItem[],
): NormalizedNewsItem[] {
  const { today, yesterday } = getBeijingTodayAndYesterday();
  const filtered: NormalizedNewsItem[] = [];

  for (const raw of items) {
    try {
      const publishedAt = raw.publishedAt;
      if (!publishedAt) continue;

      const dateYmd = toBeijingYmd(publishedAt);
      if (!dateYmd) continue;
      if (dateYmd !== today && dateYmd !== yesterday) continue;

      const url = typeof raw.url === "string" ? raw.url.trim() : "";
      if (!url) continue;

      filtered.push({
        id: raw.id,
        title: raw.title,
        summary: raw.summary,
        source: raw.source,
        url,
        dateYmd,
        publishedAt: String(publishedAt),
        category: raw.category,
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
 * 拉取 AI HOT → 今/昨过滤 → 按 URL 去重写入 Notion。
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
  const rawItems = await fetchAihotItems();
  const filtered = filterAihotItemsByBeijingTodayYesterday(rawItems);

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
