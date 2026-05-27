"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AINews } from "@/utils/notion";
import { AiNewsGeekCard } from "@/app/components/ai-news/AiNewsGeekCard";
import { AiNewsTimeRangeTabList } from "@/app/components/ai-news/AiNewsTimeRangeTabList";
import {
  filterAINewsByDateTab,
  type AiNewsTimeRangeTab,
} from "@/utils/ai-news-time-range";
import { patchAINewsStarred } from "@/utils/ai-news-star-api";
import { buildTimelineNumberedFeed } from "@/utils/ai-news-category";

export type { AINews };

const starredToggleClass = (active: boolean) =>
  [
    "rounded-xl border px-2.5 py-1 text-[11px] font-medium transition-all backdrop-blur-sm",
    active
      ? "border-yellow-400/45 bg-yellow-400/15 text-yellow-100 shadow-[0_0_12px_rgba(250,204,21,0.2)]"
      : "border-white/10 bg-white/[0.06] text-slate-500 hover:border-purple-400/35 hover:text-slate-300",
  ].join(" ");

export function AINewsWidget({ news }: { news: AINews[] }) {
  const [items, setItems] = useState<AINews[]>(news);
  const [timeTab, setTimeTab] = useState<AiNewsTimeRangeTab>("today");
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

  const tabFiltered = useMemo(() => {
    let list = filterAINewsByDateTab(items, timeTab);
    if (showOnlyStarred) list = list.filter((i) => i.starred);
    return buildTimelineNumberedFeed(list).slice(0, 5);
  }, [items, timeTab, showOnlyStarred]);

  const tabFilteredCount = useMemo(() => {
    let list = filterAINewsByDateTab(items, timeTab);
    if (showOnlyStarred) list = list.filter((i) => i.starred);
    return list.length;
  }, [items, timeTab, showOnlyStarred]);

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <h3 className="text-xl font-semibold text-slate-100">📡 AI 资讯雷达</h3>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end sm:gap-2">
            <AiNewsTimeRangeTabList
              value={timeTab}
              onChange={setTimeTab}
              size="sm"
              className="sm:justify-end"
            />
            <button
              type="button"
              aria-pressed={showOnlyStarred}
              onClick={() => setShowOnlyStarred((v) => !v)}
              className={starredToggleClass(showOnlyStarred)}
            >
              🌟 仅看标星
            </button>
            <Link
              href="/ai-news"
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-cyan-300/90 transition hover:text-cyan-200 hover:underline"
            >
              完整雷达 <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p className="text-xs tabular-nums text-slate-500 sm:text-right" aria-live="polite">
            共 <span className="font-medium text-purple-200/90">{tabFilteredCount}</span> 条
          </p>
        </div>
      </div>

      {tabFiltered.length === 0 ? (
        <p className="text-sm text-slate-500">
          {showOnlyStarred
            ? "当前维度下没有已标星的资讯。"
            : "该维度暂无资讯，请切换标签或稍后再来。"}
        </p>
      ) : (
        <ul className="space-y-3">
          {tabFiltered.map((item) => (
            <li key={item.id}>
              <AiNewsGeekCard
                item={item}
                showIndex
                compact
                onToggleStar={toggleStarred}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
