"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Newspaper, Radio, Sparkles } from "lucide-react";
import type { AINews } from "@/utils/notion";
import {
  getCategoryLabel,
  getNewsSummary,
  normalizeNewsCategorySlug,
} from "@/utils/ai-news-category";
import { formatHumanNewsTime } from "@/utils/ai-news-human-time";
import {
  getCategoryShortTag,
  getRecommendReason,
} from "@/utils/ai-news-display";
import {
  CATEGORY_FILTER_PILLS,
  filterByCategory,
  filterBySourceType,
  filterByStarred,
  getCuratedSelectedItems,
  SOURCE_TYPE_PILLS,
  sortNewsNewestFirst,
  type CategoryFilter,
  type SourceTypeFilter,
} from "@/utils/ai-news-grouping";
import { AINewsStarButton } from "@/app/components/ai-news/AINewsStarButton";
import {
  AiNewsHubSidebar,
  CATEGORY_PILL_ACTIVE,
  CATEGORY_PILL_IDLE,
  FilterPillRow,
  RecommendReasonBar,
  SourceRow,
  StarredOnlyFilterButton,
} from "@/app/components/ai-news/AiNewsHubChrome";
import { AiNewsDailyPanel } from "@/app/components/ai-news/AiNewsDailyPanel";
import { AiNewsTimelineFeed } from "@/app/components/ai-news/AiNewsTimelineFeed";
import { AiNewsViewPageHeader } from "@/app/components/ai-news/AiNewsViewPageHeader";

import type { AiNewsHubTab } from "@/app/components/ai-news/types";

export type { AiNewsHubTab };

type Props = {
  items: AINews[];
  onToggleStar?: (pageId: string, next: boolean) => void;
  /** 首页嵌入：无左侧栏，顶部 Tab */
  layout?: "full" | "embedded";
};

function NewsFeedCard({
  item,
  children,
  onToggleStar,
}: {
  item: AINews;
  children?: ReactNode;
  onToggleStar?: Props["onToggleStar"];
}) {
  const summary = getNewsSummary(item);
  const catLabel = getCategoryLabel(normalizeNewsCategorySlug(item.category));

  return (
    <article className="rounded-xl border border-white/[0.08] bg-slate-900/50 p-4 backdrop-blur-sm transition hover:border-white/12 sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <SourceRow source={item.source} author={item.author} />
        {onToggleStar ? (
          <AINewsStarButton
            compact
            starred={item.starred}
            onToggle={() => onToggleStar(item.id, !item.starred)}
          />
        ) : null}
      </div>

      <a
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 block text-base font-semibold leading-snug text-slate-50 transition hover:text-cyan-300"
      >
        {item.title}
      </a>

      {summary ? (
        <p className="mt-2 text-sm leading-relaxed text-slate-400">{summary}</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-500">
          {catLabel}
        </span>
        <span className="rounded-md border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-[11px] text-slate-600">
          {getCategoryShortTag(item)}
        </span>
      </div>

      {children}
    </article>
  );
}

/** 精选：时间轴 + 卡片 + 底部绿色推荐理由 */
function SelectedPanel({
  items,
  onToggleStar,
  showBackToHome,
}: {
  items: AINews[];
  onToggleStar?: Props["onToggleStar"];
  showBackToHome?: boolean;
}) {
  const [cat, setCat] = useState<CategoryFilter>("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const starredCount = useMemo(() => items.filter((i) => i.starred).length, [items]);
  const base = useMemo(() => getCuratedSelectedItems(items), [items]);
  const filtered = useMemo(() => {
    let list = filterByCategory(base, cat);
    list = filterByStarred(list, starredOnly);
    return list;
  }, [base, cat, starredOnly]);

  return (
    <>
      <AiNewsViewPageHeader
        title="精选"
        subtitle="AI 自动挑选的最佳价值内容"
        showBackToHome={showBackToHome}
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StarredOnlyFilterButton
          active={starredOnly}
          onChange={setStarredOnly}
          count={starredCount}
        />
        <FilterPillRow items={CATEGORY_FILTER_PILLS} value={cat} onChange={setCat} />
      </div>
      <AiNewsTimelineFeed
        items={filtered}
        emptyMessage={starredOnly ? "暂无标星资讯，点击卡片右上角星标即可加入个人清单" : undefined}
        renderCard={(item) => (
          <NewsFeedCard item={item} onToggleStar={onToggleStar}>
            <RecommendReasonBar reason={getRecommendReason(item)} />
          </NewsFeedCard>
        )}
      />
    </>
  );
}

/** 全部 AI 动态：双行筛选 + 时间轴紧凑流 */
function AllPanel({
  items,
  onToggleStar,
  showBackToHome,
}: {
  items: AINews[];
  onToggleStar?: Props["onToggleStar"];
  showBackToHome?: boolean;
}) {
  const [sourceType, setSourceType] = useState<SourceTypeFilter>("all");
  const [cat, setCat] = useState<CategoryFilter>("all");
  const [starredOnly, setStarredOnly] = useState(false);
  const starredCount = useMemo(() => items.filter((i) => i.starred).length, [items]);

  const filtered = useMemo(() => {
    let list = sortNewsNewestFirst(items);
    list = filterBySourceType(list, sourceType);
    list = filterByCategory(list, cat);
    list = filterByStarred(list, starredOnly);
    return list;
  }, [items, sourceType, cat, starredOnly]);

  return (
    <>
      <AiNewsViewPageHeader
        title="全部 AI 动态"
        subtitle="AI 相关资讯全量信息流"
        showBackToHome={showBackToHome}
      />
      <div className="mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <StarredOnlyFilterButton
            active={starredOnly}
            onChange={setStarredOnly}
            count={starredCount}
          />
        </div>
        <FilterPillRow items={SOURCE_TYPE_PILLS} value={sourceType} onChange={setSourceType} />
        <FilterPillRow items={CATEGORY_FILTER_PILLS} value={cat} onChange={setCat} />
      </div>
      <AiNewsTimelineFeed
        items={filtered}
        emptyMessage={starredOnly ? "暂无标星资讯，点击卡片右上角星标即可加入个人清单" : undefined}
        renderCard={(item) => <NewsFeedCard item={item} onToggleStar={onToggleStar} />}
      />
    </>
  );
}

/**
 * AI HOT 风格资讯中枢：左侧导航 + 精选 / 全部 / 日报 三视图
 */
const EMBEDDED_TABS: Array<{ id: AiNewsHubTab; label: string; icon: typeof Sparkles }> = [
  { id: "selected", label: "精选", icon: Sparkles },
  { id: "all", label: "全部", icon: Radio },
  { id: "daily", label: "日报", icon: Newspaper },
];

export function AiNewsGeekHub({ items, onToggleStar, layout = "full" }: Props) {
  const [hubTab, setHubTab] = useState<AiNewsHubTab>("selected");
  const showBackToHome = layout === "full";

  const main = (
    <>
      {hubTab === "selected" && (
        <SelectedPanel
          items={items}
          onToggleStar={onToggleStar}
          showBackToHome={showBackToHome}
        />
      )}
      {hubTab === "all" && (
        <AllPanel items={items} onToggleStar={onToggleStar} showBackToHome={showBackToHome} />
      )}
      {hubTab === "daily" && <AiNewsDailyPanel showBackToHome={showBackToHome} />}
    </>
  );

  if (layout === "embedded") {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-950 p-4">
        <div className="mb-4 flex gap-1 border-b border-white/[0.06] pb-3">
          {EMBEDDED_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setHubTab(id)}
              className={[
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium",
                hubTab === id ? CATEGORY_PILL_ACTIVE : CATEGORY_PILL_IDLE,
              ].join(" ")}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
        {main}
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-6rem)] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-slate-950">
      <AiNewsHubSidebar hubTab={hubTab} onTabChange={setHubTab} />
      <main className="min-w-0 flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-8">{main}</main>
    </div>
  );
}

export const MOCK_AI_NEWS: AINews[] = [
  {
    id: "mock-1",
    title: "OpenAI 发布新一代推理模型，API 定价下调",
    source: "X",
    author: "@openai",
    originalText: "面向开发者与企业客户，强调长上下文与工具调用稳定性。",
    summary: "面向开发者与企业客户，强调长上下文与工具调用稳定性。",
    date: new Date().toISOString().slice(0, 10),
    publishedAt: new Date().toISOString(),
    url: "https://example.com/1",
    category: "ai-models",
    starred: true,
    recommendReason: "模型能力与成本同时变化，直接影响 AI 产品 ROI 测算。",
  },
];
