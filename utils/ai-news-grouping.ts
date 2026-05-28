import type { AINews } from "@/utils/notion";
import { AI_NEWS_TIMEZONE } from "@/utils/ai-news-time-range";
import { getNewsSortMs, normalizeNewsCategorySlug, type AiNewsCategorySlug } from "@/utils/ai-news-category";
import { buildTimelineNumberedFeed } from "@/utils/ai-news-category";

export type CategoryFilter = "all" | AiNewsCategorySlug;

export const CATEGORY_FILTER_PILLS: Array<{ id: CategoryFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "ai-models", label: "模型" },
  { id: "ai-products", label: "产品" },
  { id: "industry", label: "行业" },
  { id: "paper", label: "论文" },
  { id: "tip", label: "技巧" },
];

export type SourceTypeFilter = "all" | "direct" | "news" | "tweet";

export const SOURCE_TYPE_PILLS: Array<{ id: SourceTypeFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "direct", label: "一手信源" },
  { id: "news", label: "资讯" },
  { id: "tweet", label: "推文" },
];

export function filterByCategory(items: AINews[], cat: CategoryFilter): AINews[] {
  if (cat === "all") return items;
  return items.filter((i) => normalizeNewsCategorySlug(i.category) === cat);
}

export function inferSourceType(item: AINews): SourceTypeFilter {
  const s = `${item.source} ${item.url}`.toLowerCase();
  if (s.includes("x.com") || s.includes("twitter") || s === "x" || s.includes("推文")) {
    return "tweet";
  }
  if (s.includes("rss") || s.includes("之家") || s.includes("news") || s.includes("资讯")) {
    return "news";
  }
  return "direct";
}

export function filterBySourceType(items: AINews[], type: SourceTypeFilter): AINews[] {
  if (type === "all") return items;
  return items.filter((i) => inferSourceType(i) === type);
}

export function sortNewsNewestFirst(items: AINews[]): AINews[] {
  return [...items].sort((a, b) => getNewsSortMs(b) - getNewsSortMs(a));
}

/** YYYY-MM-DD */
export function itemYmd(item: AINews): string {
  if (item.publishedAt) {
    const d = new Date(item.publishedAt);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString("en-CA", { timeZone: AI_NEWS_TIMEZONE });
    }
  }
  return item.date?.slice(0, 10) ?? "";
}

/** 5月27日 */
export function formatShanghaiDateLabel(ymd: string): string {
  if (ymd.length < 10) return ymd;
  const mo = Number(ymd.slice(5, 7));
  const d = Number(ymd.slice(8, 10));
  return `${mo}月${d}日`;
}

export type DateGroupedItems = {
  ymd: string;
  label: string;
  items: AINews[];
};

export function groupItemsByShanghaiDate(items: AINews[]): DateGroupedItems[] {
  const sorted = sortNewsNewestFirst(items);
  const map = new Map<string, AINews[]>();
  for (const item of sorted) {
    const ymd = itemYmd(item);
    if (!ymd) continue;
    const arr = map.get(ymd) ?? [];
    arr.push(item);
    map.set(ymd, arr);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ymd, groupItems]) => ({
      ymd,
      label: formatShanghaiDateLabel(ymd),
      items: groupItems,
    }));
}

export function getCuratedSelectedItems(items: AINews[]): AINews[] {
  const curated = items.filter(
    (i) => i.starred || i.author?.includes("AI HOT") || Boolean(i.summary?.trim() && i.summary !== "无摘要"),
  );
  if (curated.length > 0) return sortNewsNewestFirst(curated);
  return sortNewsNewestFirst(items).slice(0, Math.min(20, items.length));
}

