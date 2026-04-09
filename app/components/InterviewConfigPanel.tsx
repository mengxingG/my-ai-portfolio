"use client";

import { useMemo } from "react";
import { BriefcaseBusiness, ChevronRight } from "lucide-react";

export type InterviewQuestionCount = 3 | 5;
export type InterviewAnswerMode = "voice" | "text";

export type InterviewConfig = {
  questionCount: InterviewQuestionCount;
  answerMode: InterviewAnswerMode;
};

type Props = {
  value: InterviewConfig;
  onChange: (next: InterviewConfig) => void;
  onStart: () => void;
  disabled?: boolean;
};

function OptionCard(props: {
  active: boolean;
  title: string;
  desc: string;
  onClick: () => void;
}) {
  const { active, title, desc, onClick } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "group w-full rounded-2xl border px-4 py-3 text-left transition",
        "focus:outline-none focus:ring-1 focus:ring-cyan-500/25",
        active
          ? "border-cyan-500/30 bg-cyan-500/10"
          : "border-white/10 bg-white/[0.03] hover:border-white/15 hover:bg-white/[0.05]",
      ].join(" ")}
      aria-pressed={active}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={[
              "text-sm font-semibold",
              active ? "text-cyan-100" : "text-slate-100",
            ].join(" ")}
          >
            {title}
          </div>
          <div className="mt-1 text-xs leading-relaxed text-slate-400">{desc}</div>
        </div>
        <ChevronRight
          className={[
            "mt-0.5 h-4 w-4 shrink-0 transition",
            active ? "text-cyan-200" : "text-slate-500 group-hover:text-slate-300",
          ].join(" ")}
          aria-hidden
        />
      </div>
    </button>
  );
}

export function InterviewConfigPanel({ value, onChange, onStart, disabled }: Props) {
  const countOptions = useMemo(
    () =>
      [
        { id: 3 as const, title: "3题快速", desc: "短平快，适合热身或碎片时间。" },
        { id: 5 as const, title: "5题标准", desc: "更完整的节奏与覆盖面。" },
      ] satisfies Array<{ id: InterviewQuestionCount; title: string; desc: string }>,
    []
  );

  const modeOptions = useMemo(
    () =>
      [
        { id: "voice" as const, title: "语音面试", desc: "更接近真实面试节奏（录音 + 转写）。" },
        { id: "text" as const, title: "文字面试", desc: "更适合安静环境或快速打字整理逻辑。" },
      ] satisfies Array<{ id: InterviewAnswerMode; title: string; desc: string }>,
    []
  );

  const preparing = Boolean(disabled);

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1115] p-6 text-slate-100">
      <div className="relative w-full max-w-[720px]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-400">Interview · Config</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                模拟面试官考核
                <span className="ml-2 align-middle text-xs font-mono text-cyan-200/70">
                  SETUP
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                先选配置，再开始对话。你也可以随时返回这里重配。
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-purple-500/20 bg-purple-500/[0.07] px-4 py-3 text-sm leading-relaxed text-purple-100/90">
            <span className="font-semibold text-purple-100">难度说明：</span>
            面试将自动从基础到深入递进，无需手动选择档位。
          </div>

          <div className="mt-6 grid gap-5">
            <section>
              <div className="mb-2 flex items-center gap-2 text-xs font-mono text-slate-500">
                <BriefcaseBusiness className="h-4 w-4 text-purple-200/80" />
                题量选择（单选）
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {countOptions.map((o) => (
                  <OptionCard
                    key={o.id}
                    active={value.questionCount === o.id}
                    title={o.title}
                    desc={o.desc}
                    onClick={() => onChange({ ...value, questionCount: o.id })}
                  />
                ))}
              </div>
            </section>

            <section>
              <div className="mb-2 text-xs font-mono text-slate-500">作答方式（单选）</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {modeOptions.map((o) => (
                  <OptionCard
                    key={o.id}
                    active={value.answerMode === o.id}
                    title={o.title}
                    desc={o.desc}
                    onClick={() => onChange({ ...value, answerMode: o.id })}
                  />
                ))}
              </div>
            </section>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              当前：{value.questionCount} 题（自动递增难度）
              {" · "}
              {value.answerMode === "voice" ? "语音面试" : "文字面试"}
            </div>
            <button
              type="button"
              onClick={onStart}
              disabled={disabled}
              aria-disabled={disabled}
              className={[
                "relative inline-flex items-center gap-2 overflow-hidden rounded-2xl border px-6 py-3 text-sm font-semibold transition",
                "border-purple-500/25 bg-gradient-to-b from-purple-500/20 to-white/[0.03] text-purple-100 hover:from-purple-500/25 hover:to-white/[0.05]",
                preparing
                  ? "cursor-not-allowed opacity-100"
                  : "",
              ].join(" ")}
            >
              {preparing ? (
                <>
                  <span
                    className="pointer-events-none absolute inset-0 opacity-80"
                    aria-hidden
                    style={{
                      background:
                        "radial-gradient(500px circle at 30% 0%, rgba(168,85,247,0.28), rgba(0,0,0,0) 60%), linear-gradient(90deg, rgba(34,211,238,0.10), rgba(168,85,247,0.10), rgba(34,211,238,0.10))",
                    }}
                  />
                  <span className="relative inline-flex items-center gap-2">
                    面试环境准备中…
                    <span className="flex items-center gap-1" aria-hidden>
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-200/90 motion-safe:animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-200/90 motion-safe:animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-purple-200/90 motion-safe:animate-bounce [animation-delay:300ms]" />
                    </span>
                  </span>
                </>
              ) : (
                <>
                  开始面试
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 text-center text-xs text-slate-600">
          提示：语音模式需要麦克风权限；文字模式更适合快速梳理表达结构。
        </div>
      </div>
    </div>
  );
}
