"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AINews } from "@/utils/notion";
import { AiNewsTimeRangeTabList } from "@/app/components/ai-news/AiNewsTimeRangeTabList";
import { AiNewsGeekDailySections } from "@/app/components/ai-news/AiNewsGeekDailySections";
import { AiNewsGeekTimeline } from "@/app/components/ai-news/AiNewsGeekTimeline";
import {
  filterAINewsByDateTab,
  type AiNewsTimeRangeTab,
} from "@/utils/ai-news-time-range";
import {
  AI_NEWS_SOURCE_FILTER_ORDER,
  canonicalAINewsSource,
} from "@/utils/ai-news-source-canonical";
import { patchAINewsStarred } from "@/utils/ai-news-star-api";

export type AiNewsViewMode = "daily" | "all";

const selectClass =
  "min-w-[9.5rem] rounded-xl border border-white/[0.08] bg-white/[0.05] px-2.5 py-1.5 text-sm text-slate-200 outline-none backdrop-blur-sm focus:border-cyan-400/45 focus:ring-1 focus:ring-cyan-500/25";

const starredToggleClass = (active: boolean) =>
  [
    "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all backdrop-blur-sm",
    active
      ? "border-yellow-400/45 bg-yellow-400/15 text-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.22)]"
      : "border-white/[0.08] bg-white/[0.05] text-slate-400 hover:border-purple-400/35 hover:text-slate-200",
  ].join(" ");

const viewTabClass = (active: boolean) =>
  [
    "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
    active
      ? "border border-cyan-400/40 bg-cyan-500/15 text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.2)]"
      : "border border-transparent text-slate-500 hover:bg-white/[0.05] hover:text-slate-300",
  ].join(" ");

export default function AINewsRadarClient({ news }: { news: AINews[] }) {
  const [items, setItems] = useState<AINews[]>(news);
  const [timeTab, setTimeTab] = useState<AiNewsTimeRangeTab>("today");
  const [viewMode, setViewMode] = useState<AiNewsViewMode>("daily");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);

  useEffect(() => {
    setItems(news);
  }, [news]);

  const toggleStarred = useCallback(async (pageId: string, next: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === pageId ? { ...i, starred: next } : i)));
    try {
      await patchAINewsStarred(pageId, next);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === pageId ? { ...i, starred: !next } : i)));
    }
  }, []);

  const filtered = useMemo(() => {
    let list = filterAINewsByDateTab(items, timeTab);
    if (sourceFilter !== "all") {
      list = list.filter(
        (item) => canonicalAINewsSource(item.source) === sourceFilter,
      );
    }
    if (showOnlyStarred) {
      list = list.filter((i) => i.starred);
    }
    return list;
  }, [items, timeTab, sourceFilter, showOnlyStarred]);

  return (
    <div className="min-w-0">
      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/[0.06] bg-black/30 p-4 backdrop-blur-md sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
          <AiNewsTimeRangeTabList value={timeTab} onChange={setTimeTab} className="xl:mr-auto" />

          <div
            className="flex rounded-xl border border-white/[0.08] bg-white/[0.03] p-1"
            role="tablist"
            aria-label="展示模式"
          >
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "daily"}
              className={viewTabClass(viewMode === "daily")}
              onClick={() => setViewMode("daily")}
            >
              日报分栏
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={viewMode === "all"}
              className={viewTabClass(viewMode === "all")}
              onClick={() => setViewMode("all")}
            >
              全部动态
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ai-news-source" className="text-xs text-slate-500">
              来源
            </label>
            <select
              id="ai-news-source"
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className={selectClass}
              aria-label="按新闻来源筛选"
            >
              <option value="all">全部</option>
              {AI_NEWS_SOURCE_FILTER_ORDER.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            aria-pressed={showOnlyStarred}
            onClick={() => setShowOnlyStarred((v) => !v)}
            className={starredToggleClass(showOnlyStarred)}
          >
            🌟 仅看标星
          </button>
        </div>

        <p className="text-xs leading-relaxed text-slate-500" aria-live="polite">
          当前筛选共{" "}
          <span className="font-medium text-purple-200/90">{filtered.length}</span> 条 ·
          {viewMode === "daily"
            ? " 按 5 大板块聚合，编号 1…N 全局连续"
            : " 垂直时间轴，左侧显示时分"}
        </p>
      </div>

      {viewMode === "daily" ? (
        <AiNewsGeekDailySections items={filtered} onToggleStar={toggleStarred} />
      ) : (
        <AiNewsGeekTimeline items={filtered} onToggleStar={toggleStarred} />
      )}
    </div>
  );
}
