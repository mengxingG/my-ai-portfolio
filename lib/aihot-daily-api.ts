/** AI HOT 公开 API — 日报端点（与 aihot Skill / OpenAPI 一致） */

import { AIHOT_USER_AGENT } from "@/lib/cron-fetch-news";

export const AIHOT_BASE_URL = "https://aihot.virxact.com";

/** 固定拉取最近 30 期日报归档 */
export const AIHOT_DAILY_ARCHIVE_TAKE = 30;

export type AihotDailyArchiveItem = {
  date: string;
  generatedAt?: string;
  leadTitle?: string | null;
  leadParagraph?: string | null;
};

export type AihotDailySectionItem = {
  title: string;
  summary?: string | null;
  sourceUrl: string;
  sourceName: string;
};

export type AihotDailySection = {
  label: string;
  items: AihotDailySectionItem[];
};

export type AihotDailyFlash = {
  title: string;
  sourceName?: string;
  sourceUrl?: string;
  publishedAt?: string;
};

export type AihotDailyReport = {
  date: string;
  generatedAt?: string;
  windowStart?: string;
  windowEnd?: string;
  lead?: { title?: string; leadParagraph?: string } | null;
  sections: AihotDailySection[];
  flashes?: AihotDailyFlash[];
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidAihotDailyDate(date: string): boolean {
  return DATE_RE.test(date);
}

async function fetchAihotJson<T>(path: string): Promise<T> {
  const res = await fetch(`${AIHOT_BASE_URL}${path}`, {
    method: "GET",
    headers: {
      "User-Agent": AIHOT_USER_AGENT,
      Accept: "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `AI HOT 请求失败 ${path}: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`,
    );
  }

  return res.json() as Promise<T>;
}

/** GET /api/public/dailies?take=30 — 日报归档索引（日期 + 头条标题） */
export async function fetchAihotDailiesArchive(
  take: number = AIHOT_DAILY_ARCHIVE_TAKE,
): Promise<AihotDailyArchiveItem[]> {
  const clamped = Math.min(180, Math.max(1, take));
  const data = await fetchAihotJson<{ items?: AihotDailyArchiveItem[] }>(
    `/api/public/dailies?take=${clamped}`,
  );
  if (!data?.items || !Array.isArray(data.items)) {
    throw new Error("AI HOT dailies 返回格式异常：缺少 items");
  }
  return data.items.filter((i) => i?.date && isValidAihotDailyDate(i.date));
}

/** GET /api/public/daily/{YYYY-MM-DD} — 指定日期完整日报 */
export async function fetchAihotDailyByDate(date: string): Promise<AihotDailyReport> {
  if (!isValidAihotDailyDate(date)) {
    throw new Error(`无效日期格式: ${date}`);
  }
  const data = await fetchAihotJson<AihotDailyReport>(`/api/public/daily/${date}`);
  if (!data?.date) {
    throw new Error(`AI HOT daily/${date} 返回格式异常`);
  }
  return {
    ...data,
    sections: Array.isArray(data.sections) ? data.sections : [],
    flashes: Array.isArray(data.flashes) ? data.flashes : [],
  };
}

/** GET /api/public/daily — 最新一期日报 */
export async function fetchAihotLatestDaily(): Promise<AihotDailyReport> {
  return fetchAihotJson<AihotDailyReport>("/api/public/daily");
}
