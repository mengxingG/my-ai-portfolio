"use client";

import { useMemo, useState } from "react";
import { Twitter, Youtube, ExternalLink, Clock } from "lucide-react";
import type { AINews } from "@/utils/notion";

type TabKey = "all" | "news" | "vedio";

export default function AINewsRadarClient({ news }: { news: AINews[] }) {
  const [tab, setTab] = useState<TabKey>("all");

  const filtered = useMemo(() => {
    if (tab === "vedio") return news.filter((n) => n.source === "YouTube");
    if (tab === "news") return news.filter((n) => n.source === "X");
    return news;
  }, [news, tab]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "all", label: "all" },
    { key: "news", label: "news" },
    { key: "vedio", label: "vedio" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {tabs.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "rounded-full border px-3 py-1.5 text-sm transition-all",
                active
                  ? "border-cyan-500/50 bg-cyan-500/10 text-cyan-200"
                  : "border-white/10 bg-white/5 text-slate-300 hover:border-cyan-500/40 hover:bg-white/10",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group flex flex-col justify-between rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-xl transition-all hover:border-cyan-400/30 hover:bg-black/30"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {item.source === "X" ? (
                    <div className="flex items-center justify-center rounded-full bg-black/40 p-1.5 ring-1 ring-white/20">
                      <Twitter className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-full bg-red-500/10 p-1.5 ring-1 ring-red-500/30">
                      <Youtube className="h-4 w-4 text-red-500" />
                    </div>
                  )}
                  <span className="text-sm font-semibold text-slate-200">
                    {item.author}
                  </span>
                </div>

                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{item.date || "—"}</span>
                </div>
              </div>

              <h3 className="mb-2 text-lg font-medium leading-snug text-slate-100">
                {item.title}
              </h3>

              {item.originalText ? (
                <div className="text-sm italic leading-relaxed text-slate-100/90 transition-all duration-300 ease-out max-h-20 overflow-hidden group-hover:max-h-[1000px]">
                  &ldquo;{item.originalText}&rdquo;
                </div>
              ) : null}
            </div>

            {/* 悬停时展示“全部具体信息”中的外链等补充 */}
            <div className="mt-6 pt-4 border-t border-white/10">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[10px] text-slate-500">
                  {item.source === "X" ? "X / Twitter" : "YouTube"}
                </span>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-slate-400 transition-all opacity-0 translate-y-2 pointer-events-none group-hover:opacity-100 group-hover:translate-y-0 group-hover:pointer-events-auto hover:text-cyan-300"
                >
                  <span>原文</span>
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

