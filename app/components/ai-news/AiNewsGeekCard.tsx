"use client";

import { ExternalLink } from "lucide-react";
import type { AINews } from "@/utils/notion";
import {
  getCategorySection,
  getNewsSummary,
  normalizeNewsCategorySlug,
  type NumberedNewsItem,
} from "@/utils/ai-news-category";
import { formatHumanNewsTime } from "@/utils/ai-news-human-time";
import { AINewsStarButton } from "@/app/components/ai-news/AINewsStarButton";
import { AiNewsGeekBadge } from "@/app/components/ai-news/AiNewsGeekBadge";

type Props = {
  item: NumberedNewsItem | AINews;
  showIndex?: boolean;
  showCategoryBadge?: boolean;
  onToggleStar?: (pageId: string, next: boolean) => void;
  compact?: boolean;
};

export function AiNewsGeekCard({
  item,
  showIndex = true,
  showCategoryBadge = true,
  onToggleStar,
  compact = false,
}: Props) {
  const summary = getNewsSummary(item);
  const slug = normalizeNewsCategorySlug(item.category);
  const section = getCategorySection(slug);
  const humanTime = formatHumanNewsTime(item);
  const globalIndex = "globalIndex" in item ? item.globalIndex : undefined;

  return (
    <article
      className={[
        "group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.05] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition duration-300",
        "hover:border-purple-400/25 hover:bg-white/[0.07] hover:shadow-[0_0_28px_rgba(168,85,247,0.12)]",
        compact ? "p-3" : "p-4",
      ].join(" ")}
    >
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl" aria-hidden />

      <div className="relative flex gap-3">
        {showIndex && globalIndex != null ? (
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10 font-mono text-sm font-semibold tabular-nums text-purple-200"
            aria-hidden
          >
            {globalIndex}
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <time className="text-[11px] tabular-nums text-slate-500" dateTime={item.publishedAt ?? item.date}>
              {humanTime}
            </time>
            <AiNewsGeekBadge>{item.source || "Unknown"}</AiNewsGeekBadge>
            {showCategoryBadge ? (
              <AiNewsGeekBadge variant="category" className={section.badge}>
                {section.label}
              </AiNewsGeekBadge>
            ) : null}
          </div>

          <h3
            className={[
              "font-semibold leading-snug text-slate-50",
              compact ? "text-sm" : "text-base sm:text-[1.05rem]",
            ].join(" ")}
          >
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="outline-offset-2 transition hover:text-cyan-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-400/60"
            >
              {item.title}
            </a>
          </h3>

          {summary ? (
            <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-400">{summary}</p>
          ) : null}

          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
            <div className="flex min-w-0 items-center gap-1">
              {onToggleStar ? (
                <div className="pointer-events-auto -ml-1 shrink-0">
                  <AINewsStarButton
                    compact
                    starred={item.starred}
                    onToggle={() => onToggleStar(item.id, !item.starred)}
                  />
                </div>
              ) : null}
              {item.author ? (
                <span className="truncate text-[10px] text-slate-600">{item.author}</span>
              ) : null}
            </div>
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto flex shrink-0 items-center gap-1 text-[11px] text-slate-500 transition hover:text-cyan-300"
            >
              原文
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
