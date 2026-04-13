/**
 * 将 Notion `Source` 原始值规范为站内统一展示键（与 Select 选项对齐）。
 * 未知值原样保留（trim），供 UI 回退展示。
 */
export function canonicalAINewsSource(raw: string): string {
  const t = raw.trim();
  if (!t) return "Unknown";
  const n = t.toLowerCase().replace(/\s+/g, " ");
  if (n === "x" || n === "twitter") return "X";
  if (n === "youtube" || n === "yt") return "YouTube";
  if (n === "polymarket" || n === "poly market") return "Polymarket";
  if (n === "hacker news" || n === "hackernews" || n === "hn") return "Hacker News";
  if (n === "reddit") return "Reddit";
  return t;
}

/** 筛选器里固定顺序展示的来源（含全部已知平台） */
export const AI_NEWS_SOURCE_FILTER_ORDER = [
  "X",
  "YouTube",
  "Polymarket",
  "Hacker News",
  "Reddit",
] as const;
