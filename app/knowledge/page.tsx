"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

/** 与 Notion「资料类型」选项一致（顺序与数据库配置保持一致） */
const MATERIAL_TYPE_OPTIONS = [
  "小红书",
  "B站",
  "YouTube",
  "PDF",
  "视频链接",
  "网页文章",
  "图片截图",
  "PRD",
  "未分类",
] as const;

const MATERIAL_TYPE_PILL: Record<string, string> = {
  小红书: "border-emerald-400/35 bg-emerald-500/15 text-emerald-100",
  B站: "border-slate-400/35 bg-slate-500/20 text-slate-200",
  YouTube: "border-orange-400/40 bg-orange-500/15 text-orange-100",
  PDF: "border-pink-400/35 bg-pink-500/15 text-pink-100",
  视频链接: "border-violet-400/35 bg-violet-500/15 text-violet-100",
  网页文章: "border-sky-400/35 bg-sky-500/15 text-sky-100",
  图片截图: "border-amber-400/40 bg-amber-500/15 text-amber-100",
  PRD: "border-fuchsia-400/35 bg-fuchsia-500/15 text-fuchsia-100",
  未分类: "border-white/15 bg-white/10 text-slate-300",
};

function materialTypePillClass(type: string): string {
  return MATERIAL_TYPE_PILL[type] ?? "border-white/10 bg-black/25 text-slate-300";
}

type KnowledgeItem = {
  id: string;
  title: string;
  type: string;
  status: string;
  difficulty: string;
  durationMinutes: number | null;
  keywords: string[];
};

export default function LearningDashboard() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("全部");
  const [difficultyFilter, setDifficultyFilter] = useState("全部");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<KnowledgeItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/knowledge", { cache: "no-store" });
        const data = (await res.json()) as { items?: KnowledgeItem[]; error?: string };
        // eslint-disable-next-line no-console
        console.log("[LearningDashboard] /api/knowledge response:", {
          ok: res.ok,
          status: res.status,
          data,
        });
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!active) return;
        const raw = Array.isArray(data.items) ? data.items : [];
        setItems(
          raw.map((it) => ({
            ...it,
            keywords: Array.isArray(it.keywords) ? it.keywords : [],
          }))
        );
      } catch (e) {
        if (!active) return;
        setError(e instanceof Error ? e.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const statusOptions = ["全部", ...Array.from(new Set(items.map((i) => i.status).filter(Boolean)))];
  const difficultyOptions = ["全部", ...Array.from(new Set(items.map((i) => i.difficulty).filter(Boolean)))];
  const typeOptions = ["全部", ...MATERIAL_TYPE_OPTIONS];
  const q = keywordQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const hitStatus = statusFilter === "全部" || item.status === statusFilter;
    const hitDifficulty = difficultyFilter === "全部" || item.difficulty === difficultyFilter;
    const hitType = typeFilter === "全部" || item.type === typeFilter;
    const hayTitle = item.title.toLowerCase();
    const hayKw = (item.keywords ?? []).join(" ").toLowerCase();
    const hitKeyword =
      !q ||
      hayTitle.includes(q) ||
      hayKw.includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      item.difficulty.toLowerCase().includes(q) ||
      (item.keywords ?? []).some((k) => k.toLowerCase().includes(q));
    return hitStatus && hitDifficulty && hitType && hitKeyword;
  });

  async function confirmDeleteKnowledge() {
    if (!deleteConfirmItem) return;
    setDeleteBusy(true);
    setDeleteModalError(null);
    try {
      const res = await fetch(`/api/knowledge/${encodeURIComponent(deleteConfirmItem.id)}`, {
        method: "DELETE",
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
      setItems((prev) => prev.filter((i) => i.id !== deleteConfirmItem.id));
      setDeleteConfirmItem(null);
    } catch (e) {
      setDeleteModalError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-neutral-950 px-6 py-10 text-slate-100">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold">Learning Dashboard</h1>
              <p className="mt-2 text-sm text-slate-400">从 Notion 数据库同步你的学习资料与进度。</p>
            </div>
            <Link
              href="/learning"
              className="inline-flex items-center justify-center rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
            >
              进入 Learning（学习室）
            </Link>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            提示：点击任意卡片可带着条目进入 Learning。
          </p>
        </div>

        {!loading && !error ? (
          <div className="mb-5 space-y-3">
            <div className="grid grid-cols-1 gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="block">
                <div className="mb-1 text-xs text-slate-500">学习状态</div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                >
                  {statusOptions.map((opt) => (
                    <option key={`status-${opt}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-slate-500">难度星级</div>
                <select
                  value={difficultyFilter}
                  onChange={(e) => setDifficultyFilter(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                >
                  {difficultyOptions.map((opt) => (
                    <option key={`difficulty-${opt}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <div className="mb-1 text-xs text-slate-500">资料类型</div>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                >
                  {typeOptions.map((opt) => (
                    <option key={`type-${opt}`} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </label>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => {
                    setStatusFilter("全部");
                    setDifficultyFilter("全部");
                    setTypeFilter("全部");
                    setKeywordQuery("");
                  }}
                  className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
                >
                  重置筛选
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <label className="block">
                <div className="mb-1 text-xs text-slate-500">
                  关键词搜索（匹配标题、Notion 核心关键词、类型与状态文案）
                </div>
                <input
                  type="search"
                  value={keywordQuery}
                  onChange={(e) => setKeywordQuery(e.target.value)}
                  placeholder="输入关键词，实时筛选…"
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-500/40"
                  autoComplete="off"
                />
              </label>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-300">
            Loading...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-5 py-8 text-sm text-rose-100">
            数据加载失败：{error}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-400">
            暂无学习资料，请先在 Notion 数据库中添加内容。
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-400">
            当前筛选条件下暂无结果，请调整学习状态、难度、资料类型或关键词。
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredItems.map((item) => (
              <div
                key={item.id}
                className="group relative rounded-2xl border border-white/10 bg-white/[0.03] shadow-sm transition hover:border-cyan-500/25 hover:bg-white/[0.05]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setDeleteModalError(null);
                    setDeleteConfirmItem(item);
                  }}
                  className="absolute right-3 top-3 z-20 rounded-lg border border-white/15 bg-black/60 p-1.5 text-slate-400 backdrop-blur transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-200"
                  aria-label="删除资料"
                  title="删除资料"
                >
                  <X className="h-4 w-4" />
                </button>
                <Link
                  href={{ pathname: "/learning", query: { itemId: item.id, title: item.title } }}
                  className="block rounded-2xl p-4 pr-12 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                  aria-label={`进入 Learning：${item.title}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="line-clamp-2 text-base font-semibold text-slate-100 group-hover:text-cyan-200">
                      {item.title}
                    </h2>
                    <span className="shrink-0 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-mono text-cyan-200 opacity-80 transition group-hover:opacity-100">
                      打开 →
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">资料类型</span>
                      <span
                        className={[
                          "rounded-full border px-2 py-0.5 text-xs",
                          materialTypePillClass(item.type),
                        ].join(" ")}
                      >
                        {item.type}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">学习状态</span>
                      <span>{item.status}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">难度星级</span>
                      <span>{item.difficulty}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-500">建议时长</span>
                      <span>{item.durationMinutes ? `${item.durationMinutes} 分钟` : "未设置"}</span>
                    </div>
                    {(item.keywords ?? []).length ? (
                      <div className="border-t border-white/5 pt-2">
                        <div className="text-xs text-slate-500">关键词</div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.keywords.map((kw) => (
                            <span
                              key={`${item.id}-${kw}`}
                              className="rounded-md border border-white/10 bg-black/25 px-1.5 py-0.5 text-[11px] text-slate-400"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {deleteConfirmItem ? (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 px-4 backdrop-blur-sm"
          role="presentation"
          onClick={() => {
            if (!deleteBusy) setDeleteConfirmItem(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-knowledge-title"
            className="w-full max-w-md rounded-2xl border border-white/15 bg-neutral-900 p-6 shadow-2xl ring-1 ring-white/10"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="delete-knowledge-title" className="text-lg font-semibold text-slate-100">
              确定删除资料？
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              将从列表移除，并在 Notion 中归档该页面（可在 Notion 回收站恢复）。
            </p>
            <p className="mt-3 line-clamp-2 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-200">
              {deleteConfirmItem.title}
            </p>
            {deleteModalError ? (
              <p className="mt-3 text-sm text-rose-300">{deleteModalError}</p>
            ) : null}
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => setDeleteConfirmItem(null)}
                className="rounded-xl border border-white/15 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/[0.08] disabled:opacity-50"
              >
                取消
              </button>
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => void confirmDeleteKnowledge()}
                className="rounded-xl border border-rose-500/40 bg-rose-500/15 px-4 py-2 text-sm font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-50"
              >
                {deleteBusy ? "删除中…" : "确定删除"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

