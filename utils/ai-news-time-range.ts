import type { AINews } from "@/utils/notion";

/** Tab keys：今日 / 本周 / 本月（仅依赖 `Date` YYYY-MM-DD；时区固定 Asia/Shanghai） */
export type AiNewsTimeRangeTab = "today" | "week" | "month";

/** 全站情报 Tab 的日历与日界均按上海时区解释 */
export const AI_NEWS_TIMEZONE = "Asia/Shanghai";

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_48H = 48 * 60 * 60 * 1000;
/** 中国标准时间常年 UTC+8（无夏令时） */
const SHANGHAI_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * 将上海日历日 y年 mo月 d日 的 00:00:00（Asia/Shanghai）转为 UTC 时间戳（毫秒）。
 * 等价于 `Date.UTC(y, mo-1, d, 0, 0, 0, 0) - 8h`。
 */
function shanghaiDayStartUtcMs(y: number, mo: number, d: number): number {
  return Date.UTC(y, mo - 1, d, 0, 0, 0, 0) - SHANGHAI_UTC_OFFSET_MS;
}

function getShanghaiCalendarParts(now: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: AI_NEWS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return { y: 1970, m: 1, d: 1 };
  }
  return { y, m, d };
}

function startOfTodayShanghaiMs(now: Date): number {
  const { y, m, d } = getShanghaiCalendarParts(now);
  return shanghaiDayStartUtcMs(y, m, d);
}

/**
 * 将 Notion `Date`（YYYY-MM-DD）解析为「该日历日在 Asia/Shanghai 当日 00:00:00」对应的 `Date`（UTC 瞬时点）。
 */
export function parseNewsDateShanghaiStart(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const s = dateStr.trim();
  if (s.length < 10) return null;
  const y = Number(s.slice(0, 4));
  const mo = Number(s.slice(5, 7));
  const d = Number(s.slice(8, 10));
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const ms = shanghaiDayStartUtcMs(y, mo, d);
  const dt = new Date(ms);
  if (Number.isNaN(dt.getTime())) return null;
  return dt;
}

/** @deprecated 使用 `parseNewsDateShanghaiStart`（现为固定上海时区） */
export const parseNewsDateLocalStart = parseNewsDateShanghaiStart;

function itemDayStartMs(dateStr: string): number | null {
  const dt = parseNewsDateShanghaiStart(dateStr);
  return dt ? dt.getTime() : null;
}

/** 今日热门：以该条 `Date` 在上海当日的 0 点为锚点，`now` 与其间隔 ∈ [0, 48h] */
function matchesTodayHot(dateStr: string, now: Date): boolean {
  const startMs = itemDayStartMs(dateStr);
  if (startMs === null) return false;
  const nowMs = now.getTime();
  const ageMs = nowMs - startMs;
  return ageMs >= 0 && ageMs <= MS_48H;
}

/** 本周精选：上海日历上从今天往回共 7 天（含今天） */
function matchesThisWeek(dateStr: string, now: Date): boolean {
  const startMs = itemDayStartMs(dateStr);
  if (startMs === null) return false;
  const todayStartMs = startOfTodayShanghaiMs(now);
  if (startMs > todayStartMs + MS_PER_DAY - 1) return false;
  const weekCutoffMs = todayStartMs - 6 * MS_PER_DAY;
  return startMs >= weekCutoffMs && startMs <= todayStartMs;
}

/** 月度回顾：上海日历上从今天往回共 30 天（含今天） */
function matchesThisMonth(dateStr: string, now: Date): boolean {
  const startMs = itemDayStartMs(dateStr);
  if (startMs === null) return false;
  const todayStartMs = startOfTodayShanghaiMs(now);
  if (startMs > todayStartMs + MS_PER_DAY - 1) return false;
  const monthCutoffMs = todayStartMs - 29 * MS_PER_DAY;
  return startMs >= monthCutoffMs && startMs <= todayStartMs;
}

/** 将 UTC 毫秒格式化为 Asia/Shanghai 日历的 YYYY-MM-DD */
function formatYmdInShanghai(utcMs: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AI_NEWS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(utcMs));
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const mo = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${mo}-${d}`;
}

/**
 * 按当前 Tab 在上海时区下枚举「从今日往回」的连续日历日（YYYY-MM-DD），**新 → 旧**。
 * - 今日热门：2 天（今、昨）
 * - 本周精选：7 天
 * - 月度回顾：30 天
 */
export function enumerateShanghaiDaysForTab(
  tab: AiNewsTimeRangeTab,
  now: Date = new Date()
): string[] {
  const todayStartMs = startOfTodayShanghaiMs(now);
  const n = tab === "today" ? 2 : tab === "week" ? 7 : 30;
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    out.push(formatYmdInShanghai(todayStartMs - i * MS_PER_DAY));
  }
  return out;
}

/**
 * 按 Tab 用 `item.date`（YYYY-MM-DD）在 **Asia/Shanghai** 下过滤，并按该日上海 0 点时刻降序排序。
 * @param now 可选，便于测试；默认 `new Date()`（UTC 瞬时点，与上海日历对照时用 Intl）
 */
export function filterAINewsByDateTab(
  items: AINews[],
  tab: AiNewsTimeRangeTab,
  now: Date = new Date()
): AINews[] {
  const filtered = items.filter((item) => {
    const d = item.date ?? "";
    switch (tab) {
      case "today":
        return matchesTodayHot(d, now);
      case "week":
        return matchesThisWeek(d, now);
      case "month":
        return matchesThisMonth(d, now);
      default:
        return false;
    }
  });

  return filtered.sort((a, b) => {
    const ta = itemDayStartMs(a.date ?? "") ?? 0;
    const tb = itemDayStartMs(b.date ?? "") ?? 0;
    return tb - ta;
  });
}

/** @deprecated 请使用 `filterAINewsByDateTab` */
export const filterAINewsByTimeTab = filterAINewsByDateTab;
