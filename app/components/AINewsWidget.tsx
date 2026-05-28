"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AINews } from "@/utils/notion";
import { AiNewsGeekHub } from "@/app/components/ai-news/AiNewsGeekHub";
import { sortNewsNewestFirst } from "@/utils/ai-news-grouping";
import { patchAINewsStarred } from "@/utils/ai-news-star-api";

export type { AINews };

export function AINewsWidget({ news }: { news: AINews[] }) {
  const [items, setItems] = useState<AINews[]>(news);

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

  const sorted = useMemo(() => sortNewsNewestFirst(items), [items]);

  return (
    <div className="mt-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <h3 className="text-xl font-semibold text-slate-100">📡 AI 资讯雷达</h3>
        <div className="flex w-full min-w-0 flex-col gap-2 sm:w-auto sm:items-end">
          <Link
            href="/ai-news"
            className="flex shrink-0 items-center gap-1 text-sm font-medium text-cyan-300/90 transition hover:text-cyan-200 hover:underline sm:justify-end"
          >
            完整雷达 <ExternalLink className="h-3 w-3" />
          </Link>
          <p className="text-xs tabular-nums text-slate-500 sm:text-right" aria-live="polite">
            共 <span className="font-medium text-purple-200/90">{sorted.length}</span> 条
          </p>
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500">暂无资讯，请稍后再来。</p>
      ) : (
        <div className="max-h-[min(70vh,640px)] overflow-y-auto">
          <AiNewsGeekHub
            items={sorted.slice(0, 20)}
            onToggleStar={toggleStarred}
            layout="embedded"
          />
        </div>
      )}
    </div>
  );
}
