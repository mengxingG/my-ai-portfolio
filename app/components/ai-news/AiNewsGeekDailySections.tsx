"use client";

import type { AINews } from "@/utils/notion";
import { buildDailyNumberedFeed } from "@/utils/ai-news-category";
import { AiNewsGeekCard } from "@/app/components/ai-news/AiNewsGeekCard";

type Props = {
  items: AINews[];
  onToggleStar?: (pageId: string, next: boolean) => void;
};

export function AiNewsGeekDailySections({ items, onToggleStar }: Props) {
  const { groups, total } = buildDailyNumberedFeed(items);

  if (total === 0) {
    return (
      <p className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-8 text-center text-sm text-slate-500 backdrop-blur-sm">
        当前筛选下暂无资讯
      </p>
    );
  }

  return (
    <div className="space-y-12">
      <p className="text-xs tabular-nums text-slate-500">
        日报分栏 · 共 <span className="font-medium text-purple-200/90">{total}</span> 条（全局编号 1–{total}）
      </p>

      {groups.map(({ section, items: sectionItems }) => (
        <section key={section.slug} aria-labelledby={`ai-news-section-${section.slug}`}>
          <header className="mb-5 flex items-center gap-3 border-b border-white/[0.08] pb-3">
            <span
              className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg shadow-lg ${section.accent} shadow-purple-900/30`}
              aria-hidden
            >
              {section.icon}
            </span>
            <div>
              <h2
                id={`ai-news-section-${section.slug}`}
                className="text-lg font-bold tracking-tight text-slate-100 sm:text-xl"
              >
                {section.label}
              </h2>
              <p className="text-[11px] text-slate-500">{sectionItems.length} 条</p>
            </div>
          </header>

          <ul className="space-y-3">
            {sectionItems.map((item) => (
              <li key={item.id}>
                <AiNewsGeekCard
                  item={item}
                  showIndex
                  showCategoryBadge={false}
                  onToggleStar={onToggleStar}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
