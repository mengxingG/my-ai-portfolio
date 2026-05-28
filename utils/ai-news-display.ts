import type { AINews } from "@/utils/notion";
import { getNewsSummary, normalizeNewsCategorySlug } from "@/utils/ai-news-category";

/** 精选卡片上的短分类 Tag */
export function getCategoryShortTag(item: AINews): string {
  const slug = normalizeNewsCategorySlug(item.category);
  const map: Record<string, string> = {
    "ai-models": "模型",
    "ai-products": "产品",
    industry: "行业",
    paper: "论文",
    tip: "技巧",
  };
  return map[slug] ?? "动态";
}

/** 推荐理由：优先专用字段，否则用摘要，再无则默认文案 */
export function getRecommendReason(item: AINews): string {
  const explicit = item.recommendReason?.trim();
  if (explicit) return explicit;
  const summary = getNewsSummary(item);
  if (summary) return summary;
  if (item.author?.includes("AI HOT")) {
    return "AI HOT 编辑精选：来自今日行业高关注度动态。";
  }
  return "编辑精选：该条资讯与当前 AI 产品、模型或行业趋势高度相关，建议优先阅读。";
}
