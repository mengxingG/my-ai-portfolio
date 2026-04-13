"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Clock } from "lucide-react";
import type { AINews } from "@/utils/notion";
import { AiNewsItemCard } from "@/app/components/ai-news/AiNewsItemCard";
import { AiNewsTimeRangeTabList } from "@/app/components/ai-news/AiNewsTimeRangeTabList";
import { AiNewsDayTimeline } from "@/app/components/ai-news/AiNewsDayTimeline";
import { AINewsStarButton } from "@/app/components/ai-news/AINewsStarButton";
import {
  AINewsSourceIconSlot,
  getAINewsSourcePresentation,
} from "@/app/components/ai-news/AINewsSourcePresentation";
import {
  enumerateShanghaiDaysForTab,
  filterAINewsByDateTab,
  type AiNewsTimeRangeTab,
} from "@/utils/ai-news-time-range";
import {
  AI_NEWS_SOURCE_FILTER_ORDER,
  canonicalAINewsSource,
} from "@/utils/ai-news-source-canonical";
import { patchAINewsStarred } from "@/utils/ai-news-star-api";

const selectClass =
  "min-w-[9.5rem] rounded-xl border border-purple-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-500/25";

const starredToggleClass = (active: boolean) =>
  [
    "rounded-xl border px-3 py-1.5 text-xs font-medium transition-all backdrop-blur-sm",
    active
      ? "border-yellow-400/45 bg-yellow-400/15 text-yellow-100 shadow-[0_0_16px_rgba(250,204,21,0.22)]"
      : "border-white/10 bg-white/[0.06] text-slate-400 hover:border-purple-400/35 hover:text-slate-200",
  ].join(" ");

export default function AINewsRadarClient({ news }: { news: AINews[] }) {
  const [items, setItems] = useState<AINews[]>(news);
  const [timeTab, setTimeTab] = useState<AiNewsTimeRangeTab>("today");
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [showOnlyStarred, setShowOnlyStarred] = useState(false);
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    setItems(news);
  }, [news]);

  useEffect(() => {
    setFromDate("");
    setToDate("");
  }, [timeTab]);

  const toggleStarred = useCallback(async (pageId: string, next: boolean) => {
    setItems((prev) => prev.map((i) => (i.id === pageId ? { ...i, starred: next } : i)));
    try {
      await patchAINewsStarred(pageId, next);
    } catch {
      setItems((prev) => prev.map((i) => (i.id === pageId ? { ...i, starred: !next } : i)));
    }
  }, []);

  function parseISODateToMs(d: string): number | null {
    if (!d) return null;
    if (d.length === 10) {
      const ms = Date.parse(`${d}T00:00:00Z`);
      return Number.isFinite(ms) ? ms : null;
    }
    const ms = Date.parse(d);
    return Number.isFinite(ms) ? ms : null;
  }

  const baseByTab = useMemo(() => filterAINewsByDateTab(items, timeTab), [items, timeTab]);

  const afterSource = useMemo(() => {
    let list = baseByTab;
    if (sourceFilter !== "all") {
      list = list.filter(
        (item) => canonicalAINewsSource(item.source) === sourceFilter
      );
    }
    return list;
  }, [baseByTab, sourceFilter]);

  const afterStarred = useMemo(
    () => (showOnlyStarred ? afterSource.filter((i) => i.starred) : afterSource),
    [afterSource, showOnlyStarred]
  );

  const timelineDays = useMemo(() => enumerateShanghaiDaysForTab(timeTab), [timeTab]);

  const countsByDay = useMemo(() => {
    const m: Record<string, number> = {};
    for (const item of afterStarred) {
      const d = item.date?.slice(0, 10);
      if (d) m[d] = (m[d] ?? 0) + 1;
    }
    return m;
  }, [afterStarred]);

  const filtered = useMemo(() => {
    let list = afterStarred;

    const fromMs = parseISODateToMs(fromDate);
    const toMs = parseISODateToMs(toDate);

    if (fromMs === null && toMs === null) return list;

    return list.filter((item) => {
      const itemMs = parseISODateToMs(item.date ?? "");
      if (itemMs === null) return false;
      if (fromMs !== null && itemMs < fromMs) return false;
      if (toMs !== null && itemMs > toMs) return false;
      return true;
    });
  }, [afterStarred, fromDate, toDate]);

  const pinnedDay = fromDate && fromDate === toDate ? fromDate : null;

  function handleTimelineDay(day: string) {
    if (pinnedDay === day) {
      setFromDate("");
      setToDate("");
    } else {
      setFromDate(day);
      setToDate(day);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:flex-wrap xl:items-center">
          <AiNewsTimeRangeTabList value={timeTab} onChange={setTimeTab} className="xl:mr-auto" />

          <div className="flex flex-wrap items-center gap-2">
            <label htmlFor="ai-news-source" className="text-xs text-slate-500">
              新闻来源
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

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="rounded-xl border border-purple-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-500/25"
                aria-label="From date"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="rounded-xl border border-purple-500/20 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-purple-400/50 focus:ring-1 focus:ring-purple-500/25"
                aria-label="To date"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => {
                  setFromDate("");
                  setToDate("");
                }}
                className="rounded-full border border-purple-500/25 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:border-purple-400/40 hover:text-purple-200"
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <p className="text-xs tabular-nums text-slate-500" aria-live="polite">
          当前筛选共 <span className="font-medium text-purple-200/90">{filtered.length}</span> 条数据
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="w-full shrink-0 lg:w-44 lg:max-w-[11rem]">
          <AiNewsDayTimeline
            days={timelineDays}
            countsByDay={countsByDay}
            pinnedDay={pinnedDay}
            onToggleDay={handleTimelineDay}
          />
        </div>

        <div className="min-w-0 flex-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">
              {showOnlyStarred
                ? "当前条件下没有已标星的资讯，可关闭「仅看标星」或调整其它筛选。"
                : "该维度暂无已发布的资讯，请切换标签或调整新闻来源、日期范围。"}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => {
                const srcVis = getAINewsSourcePresentation(item.source);
                return (
                  <AiNewsItemCard key={item.id}>
                    <div>
                      <div className="mb-4 flex min-w-0 items-center gap-1.5">
                        <AINewsSourceIconSlot source={item.source} />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-200">
                          {item.author}
                        </span>
                        <div className="flex shrink-0 items-center gap-0.5 text-xs text-slate-500">
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="tabular-nums">{item.date || "—"}</span>
                        </div>
                      </div>

                      <h3 className="mb-2 text-lg font-medium leading-snug text-slate-100">{item.title}</h3>

                      {item.originalText ? (
                        <div className="max-h-20 overflow-hidden text-sm italic leading-relaxed text-slate-100/90 transition-all duration-300 ease-out group-hover:max-h-[1000px]">
                          &ldquo;{item.originalText}&rdquo;
                        </div>
                      ) : null}
                    </div>

                    <div className="mt-6 border-t border-purple-500/15 pt-4">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-0.5">
                          <div className="pointer-events-auto -ml-1 shrink-0">
                            <AINewsStarButton
                              compact
                              starred={item.starred}
                              onToggle={() => toggleStarred(item.id, !item.starred)}
                            />
                          </div>
                          <span className="text-[10px] leading-none text-slate-500">
                            {srcVis.footerLabel}
                          </span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="pointer-events-none flex translate-y-2 items-center gap-1 text-sm text-slate-400 opacity-0 transition-all group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 hover:text-purple-300"
                        >
                          <span>原文</span>
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </div>
                    </div>
                  </AiNewsItemCard>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
