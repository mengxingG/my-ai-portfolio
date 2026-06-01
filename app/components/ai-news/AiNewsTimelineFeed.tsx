"use client";

import type { ReactNode } from "react";
import type { AINews } from "@/utils/notion";
import { formatTimelineClock } from "@/utils/ai-news-human-time";
import { groupItemsByShanghaiDate } from "@/utils/ai-news-grouping";
import { DateSectionHeader } from "@/app/components/ai-news/AiNewsHubChrome";

type Props = {
  items: AINews[];
  renderCard: (item: AINews) => ReactNode;
  emptyMessage?: string;
};

export function AiNewsTimelineFeed({ items, renderCard, emptyMessage }: Props) {
  const groups = groupItemsByShanghaiDate(items);

  if (!groups.length) {
    return (
      <p className="py-16 text-center text-sm text-slate-500">
        {emptyMessage ?? "暂无内容"}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section key={group.ymd}>
          <DateSectionHeader label={group.label} />
          <div className="relative">
            <div
              className="pointer-events-none absolute bottom-0 left-[3.25rem] top-0 w-px bg-slate-700/80"
              aria-hidden
            />
            <ul className="space-y-5">
              {group.items.map((item) => {
                const clock = formatTimelineClock(item);
                return (
                  <li key={item.id} className="relative flex gap-0">
                    <div className="w-[3.25rem] shrink-0 pt-5 text-right">
                      <span className="font-mono text-xs tabular-nums text-slate-500">
                        {clock}
                      </span>
                    </div>
                    <div className="relative flex flex-1 gap-3 pb-1 pl-4">
                      <div className="absolute left-0 top-6 z-[1] flex flex-col items-center">
                        <div
                          className="h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.55)]"
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0 flex-1">{renderCard(item)}</div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      ))}
    </div>
  );
}
