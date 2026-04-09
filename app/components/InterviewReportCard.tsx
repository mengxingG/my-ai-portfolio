"use client";

import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChevronDown, Loader2, RefreshCw, Save, SlidersHorizontal } from "lucide-react";
import type { InterviewEvaluation } from "@/app/api/interview/evaluate/route";

function scoreColor(score: number) {
  if (score >= 80) return "text-emerald-200";
  if (score >= 60) return "text-amber-200";
  return "text-rose-200";
}

function summarizeAnswer(text: string) {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "（未作答）";
  if (t.length <= 70) return t;
  return `${t.slice(0, 70)}…`;
}

function statusBadgeClass(status: string) {
  const s = String(status ?? "").trim();
  if (s === "已完成") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-100";
  if (s === "待复习") return "border-amber-500/30 bg-amber-500/10 text-amber-100";
  return "border-slate-500/30 bg-white/[0.06] text-slate-200";
}

export function InterviewReportCard(props: {
  report: InterviewEvaluation;
  saving?: boolean;
  /** 父组件在保存成功时递增，用于触发就地提示 */
  saveSuccessTick?: number;
  onSaveToNotion: () => void;
  /** 头部「重新配置」：回到配置（清空当前报告） */
  onReconfigure: () => void;
  /** 底部「重新面试」：同上，独立入口 */
  onReInterview: () => void;
  /** 底部「返回学习」：切回费曼模式 */
  onBackToLearning: () => void;
}) {
  const {
    report,
    saving,
    saveSuccessTick,
    onSaveToNotion,
    onReconfigure,
    onReInterview,
    onBackToLearning,
  } = props;
  const overall = useMemo(() => Math.max(0, Math.min(100, Math.round(report.overallScore))), [report.overallScore]);
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const statusLabel = String(report.suggestedStatus ?? "").trim() || "—";
  const [saveOk, setSaveOk] = useState(false);

  useEffect(() => {
    if (!saveSuccessTick) return;
    setSaveOk(true);
    const t = window.setTimeout(() => setSaveOk(false), 1600);
    return () => window.clearTimeout(t);
  }, [saveSuccessTick]);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col bg-[#0f1115] text-slate-100">
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-[720px] px-5 py-5 sm:px-6 sm:py-6">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.02] px-5 py-6 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)] sm:px-6">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-500/35 to-transparent"
            />

            {/* 第一行：标题 + 状态 | 重新配置 */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-slate-100 sm:text-xl">面试评分报告</h2>
                <span
                  className={[
                    "shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
                    statusBadgeClass(statusLabel),
                  ].join(" ")}
                >
                  {statusLabel}
                </span>
              </div>
              <button
                type="button"
                onClick={onReconfigure}
                className="inline-flex shrink-0 items-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 transition hover:bg-cyan-500/15 sm:text-sm"
              >
                <SlidersHorizontal className="h-4 w-4" aria-hidden />
                重新配置
              </button>
            </div>

            {/* 第二行：副标题 */}
            <p className="mt-3 text-sm text-slate-400">每题可展开查看反馈与遗漏点</p>

            {/* 第三行：总分居中 + 刻度 */}
            <div className="mt-8 text-center">
              <div className={["text-5xl font-extrabold tabular-nums sm:text-6xl", scoreColor(overall)].join(" ")}>
                {overall}
              </div>
              <div className="mt-2 text-xs font-mono text-slate-500">0 - 100</div>
            </div>

            <div className="my-8 border-t border-white/10" />

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-xs font-mono text-slate-500">逐题复盘</div>
              <div className="mt-3 flex flex-col gap-2">
                {(report.questions || []).length ? (
                  report.questions.map((q, idx) => {
                    const open = openIndex === idx;
                    return (
                      <div
                        key={`${idx}-${q.questionText.slice(0, 24)}`}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <button
                          type="button"
                          onClick={() => setOpenIndex((v) => (v === idx ? null : idx))}
                          className="flex w-full items-start justify-between gap-3 text-left"
                          aria-expanded={open}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-100">
                              {idx + 1}. {q.questionText || "（题目缺失）"}
                            </div>
                            <div className="mt-1 text-xs text-slate-400">
                              你的回答摘要：{summarizeAnswer(q.userAnswer)}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <div
                              className={[
                                "rounded-xl border px-3 py-1 text-xs font-semibold tabular-nums",
                                q.score >= 80
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-100"
                                  : q.score >= 60
                                    ? "border-amber-500/25 bg-amber-500/10 text-amber-100"
                                    : "border-rose-500/25 bg-rose-500/10 text-rose-100",
                              ].join(" ")}
                            >
                              {Math.max(0, Math.min(100, Math.round(q.score)))} 分
                            </div>
                            <ChevronDown
                              className={[
                                "h-4 w-4 text-slate-500 transition",
                                open ? "rotate-180 text-slate-300" : "",
                              ].join(" ")}
                              aria-hidden
                            />
                          </div>
                        </button>

                        {open ? (
                          <div className="mt-3 grid gap-3">
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <div className="text-xs font-mono text-slate-500">得分</div>
                              <div
                                className={[
                                  "mt-1 text-sm font-semibold tabular-nums",
                                  q.score >= 80
                                    ? "text-emerald-200"
                                    : q.score >= 60
                                      ? "text-amber-200"
                                      : "text-rose-200",
                                ].join(" ")}
                              >
                                {Math.max(0, Math.min(100, Math.round(q.score)))} / 100
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <div className="text-xs font-mono text-slate-500">AI反馈</div>
                              <div className="mt-1 whitespace-pre-wrap text-sm text-slate-200">
                                {q.feedback || "（无）"}
                              </div>
                            </div>
                            <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                              <div className="text-xs font-mono text-slate-500">遗漏的知识点</div>
                              {Array.isArray(q.missedPoints) && q.missedPoints.length ? (
                                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-200">
                                  {q.missedPoints.slice(0, 12).map((p, i) => (
                                    <li key={`${idx}-m-${i}`}>{p}</li>
                                  ))}
                                </ul>
                              ) : (
                                <div className="mt-1 text-sm text-slate-400">（无）</div>
                              )}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-300">
                    暂无逐题数据（可能是对话太短或模型未返回 questions）。
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs font-mono text-slate-500">整体优势</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                  {report.strengths || "（无）"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div className="text-xs font-mono text-slate-500">改进建议</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-slate-200">
                  {report.improvements || "（无）"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="shrink-0 border-t border-white/10 bg-[#0b0f16] px-5 py-4 sm:px-6">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end sm:gap-3">
          <div className="relative w-full sm:w-auto">
            {saveOk ? (
              <div className="absolute -top-10 left-1/2 w-max -translate-x-1/2 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 shadow-xl backdrop-blur">
                保存成功
              </div>
            ) : null}
            <button
              type="button"
              onClick={onSaveToNotion}
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[9rem]"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden />
              ) : (
                <Save className="h-4 w-4" aria-hidden />
              )}
              {saving ? "保存中…" : "保存到 Notion"}
            </button>
          </div>
          <button
            type="button"
            onClick={onReInterview}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-500/25 bg-purple-500/10 px-4 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/15 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[9rem]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
            重新面试
          </button>
          <button
            type="button"
            onClick={onBackToLearning}
            disabled={saving}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.07] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[9rem]"
          >
            <BookOpen className="h-4 w-4" aria-hidden />
            返回学习
          </button>
        </div>
      </div>
    </div>
  );
}
