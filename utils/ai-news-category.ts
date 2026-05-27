import type { AINews } from "@/utils/notion";

/** 与 aihot / 日报一致的 5 个板块（顺序固定） */
export const AI_NEWS_CATEGORY_SECTIONS = [
  {
    slug: "ai-models",
    label: "模型发布/更新",
    icon: "🧠",
    accent: "from-cyan-400/90 to-emerald-500/70",
    badge: "border-cyan-400/35 bg-cyan-500/10 text-cyan-200",
  },
  {
    slug: "ai-products",
    label: "产品发布/更新",
    icon: "🚀",
    accent: "from-violet-400/90 to-fuchsia-500/70",
    badge: "border-violet-400/35 bg-violet-500/10 text-violet-200",
  },
  {
    slug: "industry",
    label: "行业动态",
    icon: "📡",
    accent: "from-blue-400/90 to-indigo-500/70",
    badge: "border-blue-400/35 bg-blue-500/10 text-blue-200",
  },
  {
    slug: "paper",
    label: "论文研究",
    icon: "📄",
    accent: "from-amber-400/90 to-orange-500/70",
    badge: "border-amber-400/35 bg-amber-500/10 text-amber-200",
  },
  {
    slug: "tip",
    label: "技巧与观点",
    icon: "💡",
    accent: "from-emerald-400/90 to-teal-500/70",
    badge: "border-emerald-400/35 bg-emerald-500/10 text-emerald-200",
  },
] as const;

export type AiNewsCategorySlug = (typeof AI_NEWS_CATEGORY_SECTIONS)[number]["slug"];

const LABEL_TO_SLUG: Record<string, AiNewsCategorySlug> = {
  "模型发布/更新": "ai-models",
  "产品发布/更新": "ai-products",
  "行业动态": "industry",
  "论文研究": "paper",
  "技巧与观点": "tip",
  "ai-models": "ai-models",
  "ai-products": "ai-products",
  industry: "industry",
  paper: "paper",
  tip: "tip",
  model: "ai-models",
  product: "ai-products",
};

/** 将 Notion / API 原始 category 规范为 5 类 slug；未知归入行业动态 */
export function normalizeNewsCategorySlug(raw?: string | null): AiNewsCategorySlug {
  const t = String(raw ?? "").trim();
  if (!t) return "industry";
  const key = LABEL_TO_SLUG[t] ?? LABEL_TO_SLUG[t.toLowerCase()];
  return key ?? "industry";
}

export function getCategorySection(slug: AiNewsCategorySlug) {
  return AI_NEWS_CATEGORY_SECTIONS.find((s) => s.slug === slug)!;
}

export function getCategoryLabel(slug: AiNewsCategorySlug): string {
  return getCategorySection(slug).label;
}

/** 按 5 板块分组；仅返回非空板块（顺序固定） */
export function groupNewsByCategory(
  items: AINews[],
): Array<{ section: (typeof AI_NEWS_CATEGORY_SECTIONS)[number]; items: AINews[] }> {
  const buckets = new Map<AiNewsCategorySlug, AINews[]>();
  for (const slug of AI_NEWS_CATEGORY_SECTIONS.map((s) => s.slug)) {
    buckets.set(slug, []);
  }
  for (const item of items) {
    const slug = normalizeNewsCategorySlug(item.category);
    buckets.get(slug)!.push(item);
  }
  return AI_NEWS_CATEGORY_SECTIONS.map((section) => ({
    section,
    items: buckets.get(section.slug) ?? [],
  })).filter((g) => g.items.length > 0);
}

export type NumberedNewsItem = AINews & { globalIndex: number };

/** 日报式：板块内保持输入顺序，全局编号 1…N 贯穿各板块 */
export function buildDailyNumberedFeed(items: AINews[]): {
  groups: Array<{
    section: (typeof AI_NEWS_CATEGORY_SECTIONS)[number];
    items: NumberedNewsItem[];
  }>;
  total: number;
} {
  const groups = groupNewsByCategory(items);
  let n = 0;
  const withIndex = groups.map((g) => ({
    section: g.section,
    items: g.items.map((item) => {
      n += 1;
      return { ...item, globalIndex: n };
    }),
  }));
  return { groups: withIndex, total: n };
}

/** 全部动态：单列表 + 全局编号（按发布时间新→旧） */
export function buildTimelineNumberedFeed(items: AINews[]): NumberedNewsItem[] {
  const sorted = [...items].sort(
    (a, b) => getNewsSortMs(b) - getNewsSortMs(a),
  );
  return sorted.map((item, i) => ({ ...item, globalIndex: i + 1 }));
}

export function getNewsSortMs(item: AINews): number {
  if (item.publishedAt) {
    const ms = Date.parse(item.publishedAt);
    if (Number.isFinite(ms)) return ms;
  }
  const d = item.date?.trim();
  if (d && d.length >= 10) {
    const ms = Date.parse(`${d.slice(0, 10)}T12:00:00+08:00`);
    if (Number.isFinite(ms)) return ms;
  }
  return 0;
}

export function getNewsSummary(item: AINews): string {
  const s = (item.summary ?? item.originalText ?? "").trim();
  if (!s || s === "无摘要") return "";
  return s;
}
