"use client";

import { useMemo, useState } from "react";
import { Twitter, Youtube, ExternalLink, Clock } from "lucide-react";
import type { AINews } from "@/utils/notion";

type TabKey = "all" | "news" | "vedio";

export default function AINewsRadarClient({ news }: { news: AINews[] }) {
  const [tab, setTab] = useState<TabKey>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  function parseISODateToMs(d: string): number | null {
    if (!d) return null;
    // Notion date is formatted like "YYYY-MM-DD"; parse as UTC midnight.
    if (d.length === 10) {
      const ms = Date.parse(`${d}T00:00:00Z`);
      return Number.isFinite(ms) ? ms : null;
    }
    const ms = Date.parse(d);
    return Number.isFinite(ms) ? ms : null;
  }

  const filtered = useMemo(() => {
    let list = news;
    if (tab === "vedio") list = list.filter((n) => n.source === "YouTube");
    if (tab === "news") list = list.filter((n) => n.source === "X");

    const fromMs = parseISODateToMs(fromDate);
    const toMs = parseISODateToMs(toDate);

    if (fromMs === null && toMs === null) return list;

    return list.filter((item) => {
      const itemMs = parseISODateToMs(item.date ?? "");
      if (itemMs === null) return false;
      if (fromMs !== null && itemMs < fromMs) return false;
      if (toMs !== null && itemMs > toMs) return false;
      return true;
    });
  }, [news, tab, fromDate, toDate]);

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "all", label: "all" },
    { key: "news", label: "news" },
    { key: "vedio", label: "vedio" },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2">
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

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              aria-label="From date"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-sm text-slate-200 outline-none focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-500/20"
              aria-label="To date"
            />
          </div>
          {(fromDate || toDate) && (
            <button
              type="button"
              onClick={() => {
                setFromDate("");
                setToDate("");
              }}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition hover:border-cyan-500/30 hover:text-cyan-200"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="liquid-glass-card group flex flex-col justify-between rounded-2xl p-6 transition-all hover:border-cyan-400/40"
          >
            <div>
              <div className="flex items-center justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  {item.source === "X" ? (
                    <div className="liquid-glass-card flex items-center justify-center rounded-full p-1.5">
                      <Twitter className="h-4 w-4 text-white" />
                    </div>
                  ) : (
                    <div className="liquid-glass-card flex items-center justify-center rounded-full p-1.5 ring-1 ring-red-500/35">
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

