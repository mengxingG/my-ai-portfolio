"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AINews } from "@/utils/notion";
import { AiNewsItemCard } from "@/app/components/ai-news/AiNewsItemCard";
import { AINewsStarButton } from "@/app/components/ai-news/AINewsStarButton";
import {
  AINewsSourceIconSlot,
  getAINewsSourcePresentation,
} from "@/app/components/ai-news/AINewsSourcePresentation";
import { AiNewsTimeRangeTabList } from "@/app/components/ai-news/AiNewsTimeRangeTabList";
import {
  filterAINewsByDateTab,
  type AiNewsTimeRangeTab,
} from "@/utils/ai-news-time-range";
import { patchAINewsStarred } from "@/utils/ai-news-star-api";

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
    return list;
  }, [items, timeTab, showOnlyStarred]);

  const tabFilteredCount = tabFiltered.length;

  const displayNews = useMemo(() => tabFiltered.slice(0, 6), [tabFiltered]);

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <h3 className="text-xl font-semibold text-slate-100">
          📡 AI 资讯雷达 (最新动态)
        </h3>
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
              className="flex shrink-0 items-center gap-1 text-sm font-medium text-purple-300/90 transition-all hover:text-purple-200 hover:underline"
            >
              查看完整雷达 <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <p
            className="text-xs tabular-nums text-slate-500 sm:text-right"
            aria-live="polite"
          >
            共 <span className="font-medium text-purple-200/90">{tabFilteredCount}</span> 条数据
          </p>
        </div>
      </div>

      {displayNews.length === 0 ? (
        <p className="text-sm text-slate-500">
          {showOnlyStarred
            ? "当前维度下没有已标星的资讯，可关闭「仅看标星」或切换时间标签。"
            : "该维度暂无已发布的资讯，请切换标签或稍后再来。"}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {displayNews.map((item) => {
            const src = getAINewsSourcePresentation(item.source);
            return (
              <AiNewsItemCard
                key={item.id}
                as="a"
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="查看原文"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pointer-events-auto absolute right-3 bottom-3 z-[4] flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-2 py-1 text-[11px] text-slate-200 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-y-0.5 hover:border-purple-400/40 hover:text-white"
                >
                  <span>查看原文</span>
                  <ExternalLink className="h-3 w-3 text-purple-300" />
                </a>

                <div className="flex flex-1 flex-col">
                  <div className="mb-3 flex min-w-0 items-center gap-1.5">
                    <AINewsSourceIconSlot source={item.source} />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold text-slate-300">
                      {item.author}
                    </span>
                    <span className="shrink-0 tabular-nums text-[10px] text-slate-500">
                      {item.date || "—"}
                    </span>
                  </div>
                  <h4 className="line-clamp-4 text-sm font-medium leading-relaxed text-slate-100">
                    {item.title}
                  </h4>
                  <div className="mt-3 flex items-center gap-0.5 border-t border-purple-500/15 pt-2">
                    <div className="pointer-events-auto -ml-1 shrink-0">
                      <AINewsStarButton
                        compact
                        starred={item.starred}
                        onToggle={() => toggleStarred(item.id, !item.starred)}
                      />
                    </div>
                    <span className="text-[10px] leading-none text-slate-500">{src.footerLabel}</span>
                  </div>
                </div>
              </AiNewsItemCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
