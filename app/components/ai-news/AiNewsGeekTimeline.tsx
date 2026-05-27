"use client";

import type { AINews } from "@/utils/notion";
import { buildTimelineNumberedFeed } from "@/utils/ai-news-category";
import { formatTimelineClock } from "@/utils/ai-news-human-time";
import { AiNewsGeekCard } from "@/app/components/ai-news/AiNewsGeekCard";

type Props = {
  items: AINews[];
  onToggleStar?: (pageId: string, next: boolean) => void;
};

export function AiNewsGeekTimeline({ items, onToggleStar }: Props) {
  const numbered = buildTimelineNumberedFeed(items);

  if (numbered.length === 0) {
    return (
      <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-500 backdrop-blur-sm">
        当前筛选下暂无资讯
      </p>
    );
  }

  return (
    <div className="relative">
      <p className="mb-6 text-xs tabular-nums text-slate-500">
        全部动态 · 共 <span className="font-medium text-cyan-200/90">{numbered.length}</span> 条时间轴
      </p>

      {/* 微光垂直轴线 */}
      <div
        className="pointer-events-none absolute bottom-2 left-[1.125rem] top-2 w-px bg-gradient-to-b from-cyan-400/50 via-purple-500/40 to-transparent shadow-[0_0_12px_rgba(34,211,238,0.35)]"
        aria-hidden
      />

      <ul className="relative space-y-5 pl-0">
        {numbered.map((item) => {
          const clock = formatTimelineClock(item);
          return (
            <li key={item.id} className="relative flex gap-4 sm:gap-5">
              {/* 时间轴节点 + 时分 */}
              <div className="relative z-[1] flex w-9 shrink-0 flex-col items-center pt-4 sm:w-10">
                <div
                  className="h-2.5 w-2.5 rounded-full border border-cyan-300/60 bg-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.55)] ring-2 ring-cyan-400/20"
                  aria-hidden
                />
                <span className="mt-1.5 font-mono text-[10px] tabular-nums text-cyan-200/80">{clock}</span>
              </div>

              <div className="min-w-0 flex-1 pb-1">
                <AiNewsGeekCard item={item} showIndex onToggleStar={onToggleStar} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
