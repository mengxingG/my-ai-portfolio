"use client";

import type { HvQaResult, QaInspectorStatus } from "@/lib/hv-analysis/qa-types";
import { getQaScoreVerdict } from "@/lib/hv-analysis/qa-types";

interface QaInspectorProps {
  status: QaInspectorStatus;
  result: HvQaResult | null;
  error: string | null;
  /** 定向修复进行中 */
  refining?: boolean;
  onAutoRefine?: () => void;
}

const TONE_STYLES = {
  excellent: {
    score: "text-emerald-300",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-200",
  },
  good: {
    score: "text-cyan-300",
    badge: "border-cyan-500/40 bg-cyan-500/15 text-cyan-200",
  },
  fair: {
    score: "text-amber-300",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-200",
  },
  poor: {
    score: "text-rose-300",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-200",
  },
} as const;

export default function QaInspector({
  status,
  result,
  error,
  refining = false,
  onAutoRefine,
}: QaInspectorProps) {
  if (status === "idle") return null;

  const verdict =
    result != null ? getQaScoreVerdict(result.overallScore) : null;
  const toneStyle = verdict ? TONE_STYLES[verdict.tone] : TONE_STYLES.fair;
  const passCount = result?.items.filter((i) => i.pass).length ?? 0;
  const failedItems = result?.items.filter((i) => !i.pass) ?? [];
  const showRefineButton =
    status === "done" && failedItems.length > 0 && onAutoRefine && !refining;

  return (
    <div
      className="overflow-hidden rounded-xl border border-indigo-500/25 bg-slate-950/70 shadow-[0_0_40px_rgba(99,102,241,0.08)] backdrop-blur-xl"
      role="region"
      aria-label="AI 质检审计面板"
    >
      {/* 顶栏 */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-gradient-to-r from-indigo-950/50 via-purple-950/30 to-slate-950/50 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-indigo-400/30 bg-indigo-500/20 text-sm">
            🛡️
          </span>
          <div>
            <h3 className="text-sm font-semibold tracking-wide text-slate-100">
              QA Inspector · 14 条军规审计
            </h3>
            <p className="text-[10px] font-mono text-indigo-300/80">
              HV-Analysis Methodology Compliance
            </p>
          </div>
        </div>

        {status === "loading" && (
          <div className="text-right">
            <p className="text-[11px] font-mono text-indigo-200">审计进行中</p>
          </div>
        )}

        {status === "done" && result != null && verdict && (
          <div className="flex flex-col items-end gap-2">
            <div className="text-right">
              <p className={`text-4xl font-bold tabular-nums ${toneStyle.score}`}>
                {result.overallScore}
                <span className="text-lg font-normal text-slate-500">/100</span>
              </p>
              <p
                className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[10px] ${toneStyle.badge}`}
              >
                {verdict.label}
              </p>
            </div>
            {showRefineButton && (
              <button
                type="button"
                onClick={onAutoRefine}
                className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-500/20 px-3 py-1.5 text-[11px] font-semibold text-amber-100 shadow-[0_0_20px_rgba(251,191,36,0.25)] transition hover:from-amber-500/35 hover:to-rose-500/30"
              >
                ✨ 根据审计意见重写 (Auto-Refine)
              </button>
            )}
          </div>
        )}
      </div>

      {/* 加载态 */}
      {status === "loading" && (
        <div className="space-y-3 px-5 py-5">
          <div className="flex items-center gap-2 text-[12px] text-indigo-200">
            <span className="inline-block animate-spin text-base">🔄</span>
            <span>正在执行深度质检，核对 14 条方法论规范…</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-full animate-pulse rounded-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 opacity-80" />
          </div>
          <p className="text-[10px] text-slate-500">
            由高级模型逐条比对叙事、横纵深度、套话禁区与万字体量…
          </p>
        </div>
      )}

      {/* 错误态 */}
      {status === "error" && error && (
        <div className="border-l-2 border-rose-500/60 bg-rose-500/10 px-5 py-4 text-[12px] text-rose-200">
          质检失败：{error}
        </div>
      )}

      {/* 检查清单 */}
      {status === "done" && result != null && (
        <div className="max-h-[420px] overflow-y-auto px-3 py-3 scrollbar-thin">
          <p className="mb-2 px-2 text-[10px] font-mono text-slate-500">
            通过 {passCount}/14 项
            {result.meta?.modelId ? ` · 模型 ${result.meta.modelId}` : ""}
          </p>
          <ul className="space-y-1">
            {result.items.map((item) => (
              <li
                key={item.id}
                className={`rounded-lg border px-3 py-2.5 transition ${
                  item.pass
                    ? "border-emerald-500/15 bg-emerald-500/5"
                    : "border-rose-500/20 bg-rose-500/5"
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 shrink-0 text-sm"
                    aria-hidden
                  >
                    {item.pass ? "✅" : "❌"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-[12px] font-medium leading-snug ${
                        item.pass ? "text-slate-200" : "text-rose-100"
                      }`}
                    >
                      {item.title}
                    </p>
                    {!item.pass && item.reason && (
                      <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                        {item.reason}
                      </p>
                    )}
                    {item.pass && item.reason && (
                      <p className="mt-1 text-[10px] text-slate-500">
                        {item.reason}
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {showRefineButton && (
            <div className="mt-3 border-t border-white/10 px-2 pt-3">
              <button
                type="button"
                onClick={onAutoRefine}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/15 px-4 py-2.5 text-[12px] font-semibold text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.2)] transition hover:brightness-110"
              >
                ✨ 根据审计意见重写 (Auto-Refine)
                <span className="font-mono text-[10px] font-normal text-amber-200/80">
                  {failedItems.length} 项待修复
                </span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
