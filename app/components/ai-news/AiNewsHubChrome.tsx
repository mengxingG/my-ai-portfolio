"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, Newspaper, Radio, Sparkles } from "lucide-react";
import type { AiNewsHubTab } from "@/app/components/ai-news/types";

const SERIF = '"Georgia", "Noto Serif SC", "Songti SC", serif';

export const CATEGORY_PILL_ACTIVE =
  "border-cyan-500/50 bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(34,211,238,0.15)]";
export const CATEGORY_PILL_IDLE =
  "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:border-white/15 hover:text-slate-200";

export function FilterPillRow<T extends string>({
  items,
  value,
  onChange,
}: {
  items: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((pill) => (
        <button
          key={pill.id}
          type="button"
          onClick={() => onChange(pill.id)}
          className={[
            "rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all",
            value === pill.id ? CATEGORY_PILL_ACTIVE : CATEGORY_PILL_IDLE,
          ].join(" ")}
        >
          {pill.label}
        </button>
      ))}
    </div>
  );
}

export function DateSectionHeader({ label }: { label: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-slate-400">
      <ChevronDown className="h-4 w-4 text-slate-600" />
      <span className="font-medium text-slate-300">{label}</span>
    </div>
  );
}

/** 来源行：圆形占位 + 名称 */
export function SourceRow({ source, author }: { source: string; author?: string }) {
  const initial = (source || "?").trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-slate-700 text-xs font-bold text-cyan-100 ring-1 ring-white/10">
        {initial}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-200">{source || "Unknown"}</p>
        {author && author !== "—" ? (
          <p className="truncate text-[11px] text-slate-500">{author}</p>
        ) : null}
      </div>
    </div>
  );
}

export function RecommendReasonBar({ reason }: { reason: string }) {
  return (
    <div className="mt-4 rounded-lg border border-emerald-500/20 bg-emerald-950/40 px-4 py-3">
      <p className="text-sm leading-relaxed">
        <span className="font-medium text-emerald-400">推荐理由：</span>
        <span className="text-emerald-400/90">{reason}</span>
      </p>
    </div>
  );
}

const NAV: Array<{ id: AiNewsHubTab; label: string; icon: LucideIcon }> = [
  { id: "selected", label: "精选", icon: Sparkles },
  { id: "all", label: "全部 AI 动态", icon: Radio },
  { id: "daily", label: "AI 日报", icon: Newspaper },
];

type SidebarProps = {
  hubTab: AiNewsHubTab;
  onTabChange: (tab: AiNewsHubTab) => void;
};

export function AiNewsHubSidebar({ hubTab, onTabChange }: SidebarProps) {
  return (
    <aside className="flex w-[13.5rem] shrink-0 flex-col border-r border-white/[0.06] bg-slate-950/80 py-5 pl-4 pr-3 lg:w-56">
      <Link href="/" className="mb-6 block">
        <div className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-950/30 px-2.5 py-1.5 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/20 text-[10px] font-bold text-cyan-300">
            AI
          </span>
          <span className="text-sm font-bold tracking-wide text-cyan-100">HOT</span>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-0.5" aria-label="资讯导航">
        {NAV.map(({ id, label, icon: Icon }) => {
          const active = hubTab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onTabChange(id)}
              className={[
                "relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-all",
                active
                  ? "bg-cyan-500/10 text-cyan-100"
                  : "text-slate-400 hover:bg-white/[0.04] hover:text-slate-200",
              ].join(" ")}
            >
              {active ? (
                <span
                  className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-cyan-400"
                  aria-hidden
                />
              ) : null}
              <Icon className={`h-4 w-4 shrink-0 ${active ? "text-cyan-400" : "opacity-70"}`} />
              {label}
            </button>
          );
        })}
      </nav>

      <Link
        href="/"
        className="mt-4 text-[11px] text-slate-600 transition hover:text-cyan-400/80"
      >
        ← 返回主界面
      </Link>
    </aside>
  );
}

export { SERIF };
