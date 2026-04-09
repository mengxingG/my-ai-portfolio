"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

type TodayReviewItem = {
  sessionId: string;
  sessionName: string;
  knowledgeTitle: string;
  knowledgePageId: string;
  lastStudyDate: string;
  daysSinceStudy: number;
  lastScore: number;
  reviewRound: number;
  status: "待复习";
};

type HeatmapRow = { date: string; count: number; totalMinutes: number; avgScore: number; intensity: number };
type HeatmapSummary = {
  totalDays: number;
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
};

type DailyStats = {
  todayStudyMinutes: number;
  todayCompletedSessions: number;
  streakDays: number;
};

type RadarDimension = { keyword: string; avgScore: number; resourceCount: number };

function scoreLabelClass(score: number): string {
  if (score >= 80) return "fill-emerald-300";
  if (score >= 60) return "fill-cyan-300";
  if (score >= 40) return "fill-amber-300";
  return "fill-rose-300";
}

function RadarAxisTick(props: any) {
  const { x, y, payload, onSelect } = props as {
    x: number;
    y: number;
    payload: { value: string };
    onSelect?: (keyword: string) => void;
  };
  const raw = String(payload?.value ?? "");
  // payload.value expected like "AGI 65%"
  const kw = raw.replace(/\s+\d+%$/, "").trim();
  const scoreMatch = raw.match(/(\d+)%$/);
  const score = scoreMatch ? Number(scoreMatch[1]) : 0;
  return (
    <text
      x={x}
      y={y}
      textAnchor="middle"
      className={["cursor-pointer select-none text-[11px]", scoreLabelClass(score)].join(" ")}
      onClick={() => {
        if (onSelect && kw) onSelect(kw);
      }}
    >
      {raw}
    </text>
  );
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

function isoToDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function dayIndexMon0(d: Date): number {
  const js = d.getDay(); // 0=Sun..6=Sat
  return (js + 6) % 7; // Mon=0..Sun=6
}

function intensityLevel(intensity: number, hasAny: boolean): 0 | 1 | 2 | 3 | 4 {
  if (!hasAny) return 0;
  if (intensity >= 91) return 4;
  if (intensity >= 61) return 3;
  if (intensity >= 31) return 2;
  return 1; // 1-30
}

function formatTooltip(d: HeatmapRow): string {
  return `${d.date}：${d.count} 次学习 · ${d.totalMinutes} 分钟 · 平均掌握度 ${d.avgScore}% · 强度 ${d.intensity}`;
}

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
  durationMinutes: number | null;
  keywords: string[];
  lastStudyDate?: string | null;
  masteryScore?: number | null;
  sessionCount?: number | null;
};

type KnowledgeProgress = {
  knowledgePageId: string;
  sessionCount: number;
  bestScore: number | null;
  lastStudyDate: string | null;
};

function statusPriority(status: string): number {
  const s = String(status ?? "").trim();
  if (s === "进行中") return 0;
  if (s === "待复习") return 1;
  if (s === "未开始" || s === "未设置") return 2;
  if (s === "已完成") return 3;
  return 2;
}

function progressPercent(item: KnowledgeItem): number {
  const score = item.masteryScore;
  if (typeof score === "number" && Number.isFinite(score)) return Math.max(0, Math.min(100, Math.round(score)));
  const s = String(item.status ?? "").trim();
  if (s === "已完成") return 100;
  if (s === "进行中") return 50;
  if (s === "待复习") return 60;
  return 0;
}

function progressBarClass(item: KnowledgeItem): string {
  const s = String(item.status ?? "").trim();
  if (s === "已完成") return "bg-emerald-400/80";
  if (s === "进行中" || s === "待复习") return "bg-cyan-400/75";
  return "bg-white/20";
}

export default function LearningDashboard() {
  const [items, setItems] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayReview, setTodayReview] = useState<{
    loading: boolean;
    error: string | null;
    reviewItems: TodayReviewItem[];
  }>({ loading: true, error: null, reviewItems: [] });
  const [daily, setDaily] = useState<{
    loading: boolean;
    error: string | null;
    data: DailyStats | null;
  }>({ loading: true, error: null, data: null });
  const [heatmap, setHeatmap] = useState<{
    loading: boolean;
    error: string | null;
    data: HeatmapRow[];
    summary: HeatmapSummary | null;
  }>({ loading: true, error: null, data: [], summary: null });
  const [radar, setRadar] = useState<{
    loading: boolean;
    error: string | null;
    dimensions: RadarDimension[];
  }>({ loading: true, error: null, dimensions: [] });
  const [statusFilter, setStatusFilter] = useState("全部");
  const [topicFilter, setTopicFilter] = useState("全部");
  const [typeFilter, setTypeFilter] = useState("全部");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<KnowledgeItem | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);
  const [reviewExpanded, setReviewExpanded] = useState(false);
  const [selectedRadarKeyword, setSelectedRadarKeyword] = useState<string | null>(null);
  const heatmapCardRef = useRef<HTMLDivElement | null>(null);
  const [heatmapCardWidth, setHeatmapCardWidth] = useState<number>(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        setTodayReview((v) => ({ ...v, loading: true, error: null }));
        const res = await fetch("/api/review/today", { cache: "no-store" });
        const data = (await res.json()) as { reviewItems?: TodayReviewItem[]; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!active) return;
        setTodayReview({ loading: false, error: null, reviewItems: Array.isArray(data.reviewItems) ? data.reviewItems : [] });
      } catch (e) {
        if (!active) return;
        setTodayReview({ loading: false, error: e instanceof Error ? e.message : "加载失败", reviewItems: [] });
      }
    })();
    void (async () => {
      try {
        setHeatmap({ loading: true, error: null, data: [], summary: null });
        const res = await fetch("/api/stats/heatmap", { cache: "no-store" });
        const data = (await res.json()) as { heatmapData?: HeatmapRow[]; summary?: HeatmapSummary; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!active) return;
        setHeatmap({
          loading: false,
          error: null,
          data: Array.isArray(data.heatmapData) ? data.heatmapData : [],
          summary: data.summary ?? null,
        });
      } catch (e) {
        if (!active) return;
        setHeatmap({ loading: false, error: e instanceof Error ? e.message : "加载失败", data: [], summary: null });
      }
    })();
    void (async () => {
      try {
        setRadar({ loading: true, error: null, dimensions: [] });
        const res = await fetch("/api/stats/radar", { cache: "no-store" });
        const data = (await res.json()) as { dimensions?: RadarDimension[]; error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!active) return;
        setRadar({
          loading: false,
          error: null,
          dimensions: Array.isArray(data.dimensions) ? data.dimensions : [],
        });
      } catch (e) {
        if (!active) return;
        setRadar({ loading: false, error: e instanceof Error ? e.message : "加载失败", dimensions: [] });
      }
    })();
    void (async () => {
      try {
        setDaily({ loading: true, error: null, data: null });
        const res = await fetch("/api/stats/daily", { cache: "no-store" });
        const data = (await res.json()) as Partial<DailyStats> & { error?: string };
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        if (!active) return;
        setDaily({
          loading: false,
          error: null,
          data: {
            todayStudyMinutes: typeof data.todayStudyMinutes === "number" ? data.todayStudyMinutes : Number(data.todayStudyMinutes) || 0,
            todayCompletedSessions: typeof data.todayCompletedSessions === "number" ? data.todayCompletedSessions : Number(data.todayCompletedSessions) || 0,
            streakDays: typeof data.streakDays === "number" ? data.streakDays : Number(data.streakDays) || 0,
          },
        });
      } catch (e) {
        if (!active) return;
        setDaily({ loading: false, error: e instanceof Error ? e.message : "加载失败", data: null });
      }
    })();
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
        const base = raw.map((it) => ({
          ...it,
          keywords: Array.isArray(it.keywords) ? it.keywords : [],
        })) as KnowledgeItem[];
        setItems(base);

        // 查询学习进度（掌握度最高分 / 最近学习日期 / 会话次数）
        const shouldQuery = base.length <= 10 ? base : base.filter((x) => String(x.status ?? "").trim() !== "已完成");
        const ids = shouldQuery.map((x) => x.id).filter(Boolean);
        if (ids.length) {
          const r2 = await fetch("/api/knowledge/progress", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ knowledgePageIds: ids }),
          });
          const j2 = (await r2.json()) as { progress?: KnowledgeProgress[]; error?: string };
          if (r2.ok && Array.isArray(j2.progress)) {
            const map = new Map<string, KnowledgeProgress>();
            for (const p of j2.progress) {
              const pid = String(p?.knowledgePageId ?? "").trim();
              if (!pid) continue;
              map.set(pid, p);
            }
            setItems((prev) =>
              prev.map((it) => {
                const p = map.get(it.id);
                if (!p) return it;
                return {
                  ...it,
                  lastStudyDate: p.lastStudyDate,
                  masteryScore: p.bestScore,
                  sessionCount: p.sessionCount,
                };
              })
            );
          }
        }
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

  useEffect(() => {
    const el = heatmapCardRef.current;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setHeatmapCardWidth(w);
    });
    ro.observe(el);
    setHeatmapCardWidth(el.getBoundingClientRect().width);
    return () => ro.disconnect();
  }, []);

  const heatmapIndex = useMemo(() => {
    const m = new Map<string, HeatmapRow>();
    for (const d of heatmap.data) {
      const date = String((d as any)?.date ?? "").slice(0, 10);
      if (!date) continue;
      m.set(date, {
        date,
        count: Number((d as any)?.count) || 0,
        totalMinutes: Number((d as any)?.totalMinutes) || 0,
        avgScore: Number((d as any)?.avgScore) || 0,
        intensity: Number((d as any)?.intensity) || 0,
      });
    }
    return m;
  }, [heatmap.data]);

  const last13Weeks = useMemo(() => {
    const end = new Date();
    const totalDays = 13 * 7; // 91
    const start = addDays(end, -(totalDays - 1));
    const dates: string[] = [];
    for (let i = 0; i < totalDays; i++) dates.push(yyyyMmDd(addDays(start, i)));
    return { dates };
  }, []);

  const monthLabels = useMemo(() => {
    const labels: string[] = new Array(13).fill("");
    let prevMonth = -1;
    for (let week = 0; week < 13; week++) {
      const iso = last13Weeks.dates[week * 7]!;
      const d = isoToDate(iso);
      const m = d.getMonth();
      if (m !== prevMonth) {
        labels[week] = d.toLocaleString("en-US", { month: "short" });
        prevMonth = m;
      }
    }
    return labels;
  }, [last13Weeks.dates]);

  function isPureEnglishWordShort(s: string): boolean {
    const t = s.trim();
    return /^[A-Za-z]+$/.test(t) && t.length <= 3;
  }

  function canonicalizeTopicKeyword(raw: string): string {
    const v = raw.trim();
    if (!v) return "";

    // Explicit merges
    if (["风控", "风险管理", "风险控制", "实时风控"].includes(v)) return "风控";
    if (["金融合规", "合规管理"].includes(v)) return "合规";
    if (["AI", "AI发展", "AI治理"].includes(v)) return "AI";

    return v;
  }

  const statusOptions = ["全部", ...Array.from(new Set(items.map((i) => i.status).filter(Boolean)))];
  const topicOptions = useMemo(() => {
    const excluded = new Set(["demis", "hassabis"]);
    const picked: string[] = [];

    for (const it of items) {
      for (const kw of it.keywords ?? []) {
        const raw = String(kw ?? "").trim();
        if (!raw) continue;

        // filter: name tags + short english abbreviations
        const lower = raw.toLowerCase();
        if (excluded.has(lower)) continue;
        if (isPureEnglishWordShort(raw)) continue;

        const canon = canonicalizeTopicKeyword(raw);
        if (canon) picked.push(canon);
      }
    }

    // merge by containment: if A contains B, group into shorter B
    const uniq = Array.from(new Set(picked));
    uniq.sort((a, b) => a.length - b.length || a.localeCompare(b, "zh-Hans-CN"));
    const bases: string[] = [];
    for (const kw of uniq) {
      const hit = bases.find((b) => kw !== b && kw.includes(b));
      if (!hit) bases.push(kw);
    }

    bases.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
    return ["全部", ...bases];
  }, [items]);
  const typeOptions = ["全部", ...MATERIAL_TYPE_OPTIONS];
  const q = keywordQuery.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    const hitStatus = statusFilter === "全部" || item.status === statusFilter;
    const hitTopic = topicFilter === "全部" || (item.keywords ?? []).includes(topicFilter);
    const hitType = typeFilter === "全部" || item.type === typeFilter;
    const hayTitle = item.title.toLowerCase();
    const hayKw = (item.keywords ?? []).join(" ").toLowerCase();
    const hitKeyword =
      !q ||
      hayTitle.includes(q) ||
      hayKw.includes(q) ||
      item.type.toLowerCase().includes(q) ||
      item.status.toLowerCase().includes(q) ||
      (item.keywords ?? []).some((k) => k.toLowerCase().includes(q));
    const hitRadar = !selectedRadarKeyword || (item.keywords ?? []).includes(selectedRadarKeyword);
    return hitStatus && hitTopic && hitType && hitKeyword && hitRadar;
  }).sort((a, b) => {
    const pa = statusPriority(a.status);
    const pb = statusPriority(b.status);
    if (pa !== pb) return pa - pb;
    const sa = typeof a.masteryScore === "number" ? a.masteryScore : -1;
    const sb = typeof b.masteryScore === "number" ? b.masteryScore : -1;
    if (sa !== sb) return sb - sa;
    const da = String(a.lastStudyDate ?? "");
    const db = String(b.lastStudyDate ?? "");
    if (da && db && da !== db) return db.localeCompare(da);
    return a.title.localeCompare(b.title);
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
        {/* 顶部统计栏（全宽） */}
        <div className="mb-6 rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] text-slate-500">今日学习</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-cyan-200">
                {daily.loading ? "—" : daily.data ? `${daily.data.todayStudyMinutes}m` : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] text-slate-500">今日会话</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-purple-200">
                {daily.loading ? "—" : daily.data ? daily.data.todayCompletedSessions : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] text-slate-500">连续天数</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-emerald-200">
                {daily.loading ? "—" : daily.data ? daily.data.streakDays : "—"}
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <div className="text-[11px] text-slate-500">待复习</div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-amber-200">
                {todayReview.loading ? "—" : todayReview.reviewItems.length}
                <span className="ml-1 text-sm font-medium text-slate-400">项</span>
              </div>
            </div>
          </div>
          {daily.error ? <div className="mt-2 text-xs text-rose-200">统计加载失败：{daily.error}</div> : null}
        </div>

        <div className="grid min-h-0 grid-cols-1 gap-4 lg:grid-cols-[13fr_7fr]">
          {/* 左列：核心资料列表（含筛选与卡片） */}
          <div className="min-h-0 lg:max-h-[calc(100vh-220px)] flex flex-col">

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
                <div className="mb-1 text-xs text-slate-500">主题分类</div>
                <select
                  value={topicFilter}
                  onChange={(e) => setTopicFilter(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-500/40"
                >
                  {topicOptions.map((opt) => (
                    <option key={`topic-${opt}`} value={opt}>
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
                    setTopicFilter("全部");
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

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {loading ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-8 text-sm text-slate-300">
              <div className="flex items-center gap-3">
                <span className="text-slate-300">Loading</span>
                <span className="flex items-center gap-1" aria-hidden>
                  <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:0ms]" />
                  <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:150ms]" />
                  <span className="h-2 w-2 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:300ms]" />
                </span>
              </div>
              <div className="mt-4 space-y-3">
                <div className="h-3 w-1/2 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-white/10" />
              </div>
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
              当前筛选条件下暂无结果，请调整学习状态、主题分类、资料类型或关键词。
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02]">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="group relative border-b border-white/10 bg-white/[0.03] px-4 py-3 transition hover:bg-white/[0.05]"
                >
                  <div className="absolute inset-x-0 bottom-0 h-[2px] overflow-hidden bg-black/30">
                    <div
                      className={["h-full", progressBarClass(item)].join(" ")}
                      style={{ width: `${progressPercent(item)}%` }}
                    />
                  </div>

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-100 group-hover:text-cyan-200">
                        {item.title}
                      </div>
                      {(item.keywords ?? []).length ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {item.keywords.slice(0, 6).map((kw) => (
                            <span
                              key={`${item.id}-kw-${kw}`}
                              className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-slate-300"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        href={{ pathname: "/learning", query: { itemId: item.id, title: item.title } }}
                        className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20"
                        aria-label={`打开：${item.title}`}
                      >
                        打开
                      </Link>
                      <button
                        type="button"
                        onClick={() => {
                          setDeleteModalError(null);
                          setDeleteConfirmItem(item);
                        }}
                        className="rounded-xl border border-white/15 bg-black/40 p-1.5 text-slate-400 transition hover:border-rose-500/40 hover:bg-rose-500/15 hover:text-rose-200"
                        aria-label="删除资料"
                        title="删除资料"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[11px]",
                        materialTypePillClass(item.type),
                      ].join(" ")}
                    >
                      {item.type}
                    </span>
                    <span className="rounded-full border border-white/10 bg-black/25 px-2 py-0.5 text-[11px] text-slate-300">
                      {item.status}
                    </span>
                </div>
              </div>
            ))}
          </div>
        )}

        </div>
      </div>

          {/* 右列：今日复习 + 热力图（缩小） + 雷达图（缩小） */}
          <div className="min-h-0 space-y-3 lg:max-h-[calc(100vh-220px)] lg:overflow-y-auto">
            {/* 今日复习（紧凑） */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-emerald-300/80">Review · Today</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">今日复习</div>
                </div>
                {todayReview.reviewItems.length > 3 ? (
                  <button
                    type="button"
                    onClick={() => setReviewExpanded((v) => !v)}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    {reviewExpanded ? "收起" : "查看全部"}
                  </button>
                ) : null}
              </div>

              {todayReview.loading ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>Loading</span>
                    <span className="flex items-center gap-1" aria-hidden>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 motion-safe:animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              ) : todayReview.error ? (
                <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  加载失败：{todayReview.error}
                </div>
              ) : todayReview.reviewItems.length ? (
                <div className="mt-3 space-y-2">
                  {(reviewExpanded ? todayReview.reviewItems : todayReview.reviewItems.slice(0, 3)).map((it) => (
                    <div
                      key={it.knowledgePageId}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-slate-100">{it.knowledgeTitle}</div>
                      </div>
                      <Link
                        href={`/learning?itemId=${encodeURIComponent(it.knowledgePageId)}&title=${encodeURIComponent(it.knowledgeTitle)}`}
                        className="shrink-0 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                      >
                        复习
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3">
                  <div className="text-sm font-semibold text-emerald-100">
                    今天没有需要复习的内容，继续保持！
                  </div>
                  <Link
                    href="/learning"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
                  >
                    快速开始学习
                  </Link>
                </div>
              )}
            </div>

            {/* 热力图（缩小版） */}
            <div
              ref={heatmapCardRef}
              className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-cyan-200/70">Learning · Heatmap</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">过去 90 天</div>
                </div>
              </div>
              {heatmap.loading ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>Loading</span>
                    <span className="flex items-center gap-1" aria-hidden>
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              ) : heatmap.error ? (
                <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  加载失败：{heatmap.error}
                </div>
              ) : (
                <div className="mt-2 w-full">
                  <HeatmapGrid
                    dates={last13Weeks.dates}
                    index={heatmapIndex}
                    monthLabels={monthLabels}
                    showMonthLabels={false}
                    cell={computeHeatmapCell(heatmapCardWidth)}
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {/* 雷达图（缩小版） */}
            <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-cyan-200/70">Knowledge · Radar</div>
                  <div className="mt-1 text-sm font-semibold text-slate-100">掌握度雷达图</div>
                  <div className="mt-1 text-[11px] text-slate-500">
                    点击维度筛选{selectedRadarKeyword ? `（当前：${selectedRadarKeyword}）` : ""}
                  </div>
                </div>
                {selectedRadarKeyword ? (
                  <button
                    type="button"
                    onClick={() => setSelectedRadarKeyword(null)}
                    className="shrink-0 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    清除
                  </button>
                ) : null}
              </div>

              {radar.loading ? (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <span>Loading</span>
                    <span className="flex items-center gap-1" aria-hidden>
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-cyan-300 motion-safe:animate-bounce [animation-delay:300ms]" />
                    </span>
                  </div>
                </div>
              ) : radar.error ? (
                <div className="mt-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  加载失败：{radar.error}
                </div>
              ) : radar.dimensions.length ? (
                <div className="mt-3 h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart
                      data={radar.dimensions.map((d) => ({
                        keyword: d.keyword,
                        score: d.avgScore,
                        resourceCount: d.resourceCount,
                        label: `${d.keyword} ${d.avgScore}%`,
                      }))}
                      outerRadius="78%"
                    >
                      <PolarGrid stroke="rgba(148,163,184,0.25)" />
                      <PolarRadiusAxis
                        angle={90}
                        domain={[0, 100]}
                        tickCount={6}
                        stroke="rgba(148,163,184,0.25)"
                        tick={{ fill: "rgba(148,163,184,0.75)", fontSize: 10 }}
                      />
                      <PolarAngleAxis
                        dataKey="label"
                        tick={(p) => (
                          <RadarAxisTick
                            {...p}
                            onSelect={(kw: string) => setSelectedRadarKeyword(kw)}
                          />
                        )}
                      />
                      <Radar
                        dataKey="score"
                        stroke="rgba(34,211,238,0.95)"
                        fill="rgba(34,211,238,0.22)"
                        fillOpacity={1}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "rgba(2,6,23,0.92)",
                          border: "1px solid rgba(255,255,255,0.10)",
                          borderRadius: 12,
                          color: "rgba(226,232,240,0.95)",
                          fontSize: 12,
                        }}
                        formatter={(value: any, _name: any, ctx: any) => {
                          const kw = String(ctx?.payload?.keyword ?? "");
                          const score = Number(value) || 0;
                          const cnt = Number(ctx?.payload?.resourceCount) || 0;
                          return [`平均掌握度 ${score}%（涉及 ${cnt} 份资料）`, kw];
                        }}
                        labelFormatter={(label) => String(label ?? "").replace(/\s+\d+%$/, "")}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-6 text-sm text-slate-300">
                  暂无足够数据生成雷达图。
                </div>
              )}
            </div>
          </div>
        </div>
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

function HeatmapGrid(props: {
  dates: string[];
  index: Map<string, HeatmapRow>;
  monthLabels: string[];
  cell?: number;
  showMonthLabels?: boolean;
  className?: string;
}) {
  const { dates, index, monthLabels, cell = 12, showMonthLabels = true, className } = props;
  const [tip, setTip] = useState<{ open: boolean; x: number; y: number; text: string }>({
    open: false,
    x: 0,
    y: 0,
    text: "",
  });

  const colorByLevel: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: "bg-white/[0.05] border-white/10",
    1: "bg-cyan-900/50 border-cyan-500/15",
    2: "bg-cyan-700/55 border-cyan-500/20",
    3: "bg-cyan-500/65 border-cyan-400/25",
    4: "bg-cyan-300/75 border-cyan-200/35",
  };

  return (
    <div className={className ?? "mt-4"}>
      {tip.open ? (
        <div
          className="pointer-events-none fixed z-[80] -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-950/90 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur"
          style={{ left: tip.x, top: tip.y }}
        >
          {tip.text}
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        {/* y-axis labels */}
        <div className={["text-[11px] text-slate-500", showMonthLabels ? "pt-[18px]" : "pt-0"].join(" ")}>
          <div className="h-[12px]" />
          <div className="mt-[3px] h-[12px]" />
          <div className="mt-[3px] h-[12px]">Wed</div>
          <div className="mt-[3px] h-[12px]" />
          <div className="mt-[3px] h-[12px]">Fri</div>
          <div className="mt-[3px] h-[12px]" />
          <div className="mt-[3px] h-[12px]" />
        </div>

        <div className="min-w-0">
          {/* month labels */}
          {showMonthLabels ? (
            <div className="grid grid-cols-13 gap-[3px] text-[11px] text-slate-500">
              {monthLabels.map((m, i) => (
                <div key={`m-${i}`} className="h-4">
                  {m}
                </div>
              ))}
            </div>
          ) : null}

          {/* grid: 7 rows (Mon..Sun), 13 cols (weeks) */}
          <div className={["grid grid-flow-col grid-rows-7 gap-[3px]", showMonthLabels ? "mt-1" : "mt-0"].join(" ")}>
            {dates.map((iso) => {
              const d = isoToDate(iso);
              const row = dayIndexMon0(d);
              const data = index.get(iso) ?? { date: iso, count: 0, totalMinutes: 0, avgScore: 0, intensity: 0 };
              const level = intensityLevel(data.intensity, data.count > 0);
              return (
                <div
                  key={iso}
                  className={["rounded-[2px] border transition", colorByLevel[level]].join(" ")}
                  style={{ gridRowStart: row + 1, width: `${cell}px`, height: `${cell}px` }}
                  onMouseEnter={(e) => {
                    setTip({ open: true, x: e.clientX, y: e.clientY - 12, text: formatTooltip(data) });
                  }}
                  onMouseMove={(e) => {
                    setTip((v) => (v.open ? { ...v, x: e.clientX, y: e.clientY - 12 } : v));
                  }}
                  onMouseLeave={() => setTip({ open: false, x: 0, y: 0, text: "" })}
                  aria-label={formatTooltip(data)}
                />
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-slate-500">
            <div />
            <div className="flex items-center gap-2">
              <span>低强度</span>
              <div className="flex items-center gap-[3px]">
                {[0, 1, 2, 3, 4].map((lv) => (
                  <span
                    key={`lg-${lv}`}
                    className={["inline-block rounded-[2px] border", colorByLevel[lv as 0 | 1 | 2 | 3 | 4]].join(
                      " "
                    )}
                    style={{ width: `${cell}px`, height: `${cell}px` }}
                    aria-hidden
                  />
                ))}
              </div>
              <span>高强度</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function computeHeatmapCell(cardWidth: number): number {
  // 右侧卡片：宽度有限，需要自适应让 13 列尽量铺满（保留 y 轴标签 + 间距）
  // 经验值：y 轴标签约 22px，gap=3px，共 12 个 gap
  const w = Number.isFinite(cardWidth) ? cardWidth : 0;
  if (!w) return 8;
  const usable = Math.max(0, w - 22 - 12 * 3);
  const cell = Math.floor(usable / 13);
  return Math.max(6, Math.min(14, cell));
}

