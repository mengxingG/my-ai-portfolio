"use client";

import type { AiNewsTimeRangeTab } from "@/utils/ai-news-time-range";

const TAB_ITEMS: Array<{ id: AiNewsTimeRangeTab; label: string }> = [
  { id: "today", label: "今日热门" },
  { id: "week", label: "本周精选" },
  { id: "month", label: "月度回顾" },
];

type Props = {
  value: AiNewsTimeRangeTab;
  onChange: (next: AiNewsTimeRangeTab) => void;
  size?: "sm" | "md";
  className?: string;
};

export function AiNewsTimeRangeTabList({
  value,
  onChange,
  size = "md",
  className = "",
}: Props) {
  const pad = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-sm";
  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 ${className}`}
      role="tablist"
      aria-label="按时间维度筛选资讯"
    >
      {TAB_ITEMS.map(({ id, label }) => {
        const active = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(id)}
            className={[
              "rounded-xl border font-medium transition-all",
              pad,
              active
                ? "border-purple-400/60 bg-purple-500/15 text-purple-100 shadow-[0_0_16px_rgba(168,85,247,0.35)]"
                : "border-purple-500/25 bg-black/30 text-slate-400 hover:border-purple-400/45 hover:bg-purple-500/10 hover:text-slate-200",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
