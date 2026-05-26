"use client";

import { useCallback, useEffect, useState } from "react";
import type { HvHistoryListItem } from "@/lib/hv-analysis/notion-history";

export type { HvHistoryListItem };

type HistoryReportSidebarProps = {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  selectedId: string | null;
  detailLoadingId: string | null;
  onSelect: (item: HvHistoryListItem) => void;
  /** 递增后自动刷新列表（如手动存入 Notion 成功） */
  refreshToken?: number;
};

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistoryReportSidebar({
  collapsed,
  onToggleCollapsed,
  selectedId,
  detailLoadingId,
  onSelect,
  refreshToken = 0,
}: HistoryReportSidebarProps) {
  const [items, setItems] = useState<HvHistoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hv-history?limit=50", { cache: "no-store" });
      const data = (await res.json()) as { items?: HvHistoryListItem[]; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `加载失败: ${res.status}`);
      }
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory, refreshToken]);

  return (
    <aside
      className={`flex shrink-0 flex-col border-r border-white/10 bg-black/50 backdrop-blur-md transition-[width] duration-300 ${
        collapsed ? "w-12" : "w-[280px] sm:w-[300px]"
      }`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-white/10 px-2">
        {!collapsed && (
          <div className="min-w-0 px-1">
            <h2 className="truncate text-xs font-semibold tracking-wide text-slate-100">
              历史研报舱
            </h2>
            <p className="truncate text-[10px] text-slate-500">Notion 已存档报告</p>
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="ml-auto flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 text-slate-400 transition hover:border-white/20 hover:bg-white/5 hover:text-slate-200"
          aria-label={collapsed ? "展开历史研报舱" : "收起历史研报舱"}
          title={collapsed ? "展开" : "收起"}
        >
          {collapsed ? "›" : "‹"}
        </button>
      </div>

      {!collapsed && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-end border-b border-white/5 px-2 py-1">
            <button
              type="button"
              onClick={() => void loadHistory()}
              disabled={loading}
              className="text-[10px] text-slate-500 transition hover:text-cyan-400 disabled:opacity-40"
            >
              {loading ? "刷新中…" : "↻ 刷新"}
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
            {loading && items.length === 0 && (
              <p className="px-2 py-6 text-center text-[11px] text-slate-500 animate-pulse">
                正在同步历史列表…
              </p>
            )}

            {error && (
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2 py-2 text-[11px] text-rose-300">
                {error}
              </div>
            )}

            {!loading && !error && items.length === 0 && (
              <p className="px-2 py-6 text-center text-[11px] leading-relaxed text-slate-500">
                暂无已存档报告
                <br />
                <span className="text-slate-600">完成分析后将自动写入 Notion</span>
              </p>
            )}

            <ul className="space-y-1">
              {items.map((item) => {
                const isSelected = selectedId === item.id;
                const isLoading = detailLoadingId === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onSelect(item)}
                      disabled={isLoading}
                      className={`w-full rounded-lg border px-2.5 py-2 text-left transition ${
                        isSelected
                          ? "border-purple-500/40 bg-purple-500/15 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
                          : "border-white/5 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]"
                      } disabled:opacity-60`}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        <span
                          className={`line-clamp-2 min-w-0 flex-1 text-[12px] font-medium leading-snug ${
                            isSelected ? "text-purple-100" : "text-slate-200"
                          }`}
                        >
                          {item.target}
                        </span>
                        <div className="flex shrink-0 items-center gap-1">
                          {typeof item.overallScore === "number" && (
                            <span
                              className={`rounded-full border px-1.5 py-0.5 font-mono text-[9px] font-semibold ${
                                item.overallScore >= 90
                                  ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-300"
                                  : item.overallScore >= 75
                                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-300"
                                    : item.overallScore >= 60
                                      ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                                      : "border-rose-500/40 bg-rose-500/15 text-rose-300"
                              }`}
                            >
                              {item.overallScore}分
                            </span>
                          )}
                          {isLoading && (
                            <span className="h-3 w-3 animate-spin rounded-full border border-cyan-400/30 border-t-cyan-400" />
                          )}
                        </div>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-slate-500">{item.title}</p>
                      <p className="mt-1 font-mono text-[9px] text-slate-600">
                        {formatHistoryDate(item.createdAt)}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {collapsed && (
        <div className="flex flex-1 flex-col items-center pt-3">
          <span
            className="text-[10px] font-semibold text-slate-600 [writing-mode:vertical-rl]"
            title="历史研报舱"
          >
            历史
          </span>
        </div>
      )}
    </aside>
  );
}
