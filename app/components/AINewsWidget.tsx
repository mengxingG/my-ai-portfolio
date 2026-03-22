"use client";

import { Twitter, Youtube, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { AINews } from "@/utils/notion";

export type { AINews };

export function AINewsWidget({ news }: { news: AINews[] }) {
  const displayNews = news.slice(0, 3);

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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {displayNews.map((item) => (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-xl border border-white/10 bg-white/5 p-5 transition-all hover:-translate-y-1 hover:border-cyan-500/50 hover:bg-white/10"
            >
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
                <h4 className="mb-2 line-clamp-2 text-sm font-medium leading-relaxed text-slate-100">
                  {item.title}
                </h4>
              </div>
              <div className="mt-4 flex flex-wrap gap-1">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-cyan-500/10 px-1.5 py-0.5 text-[10px] text-cyan-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
