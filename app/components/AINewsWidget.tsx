"use client";

import { Twitter, Youtube, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AINews } from "@/utils/notion";

export type { AINews };

export function AINewsWidget({ news }: { news: AINews[] }) {
  const displayNews = news.slice(0, 6);

  return (
    <div className="mt-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-xl font-semibold text-slate-100">📡 AI 资讯雷达 (最新动态)</h3>
        <Link
          href="/ai-news"
          className="flex items-center gap-1 text-sm font-medium text-cyan-400 transition-all hover:text-cyan-300 hover:underline"
        >
          查看完整雷达 <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {displayNews.length === 0 ? (
        <p className="text-sm text-slate-500">暂无已发布的资讯，请稍后再来。</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {displayNews.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="查看原文"
              className="liquid-glass-card group relative flex flex-col justify-between rounded-2xl p-5 transition-all hover:-translate-y-1 hover:border-purple-500/35"
            >
              {/* 悬停提示：查看原文 */}
              <div className="liquid-glass-card pointer-events-none absolute right-3 bottom-3 flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] text-slate-200 opacity-0 transition-all group-hover:opacity-100 group-hover:translate-y-0.5">
                <span>查看原文</span>
                <ExternalLink className="h-3 w-3 text-cyan-300" />
              </div>

              <div>
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {item.source === "X" ? (
                      <Twitter className="h-4 w-4 text-white" />
                    ) : (
                      <Youtube className="h-4 w-4 text-red-500" />
                    )}
                    <span className="text-xs font-semibold text-slate-300">{item.author}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">{item.date || "—"}</span>
                </div>
                <h4 className="line-clamp-4 text-sm font-medium leading-relaxed text-slate-100">
                  {item.title}
                </h4>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
