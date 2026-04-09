"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Send, X } from "lucide-react";
import type { InterviewConfig } from "@/app/components/InterviewConfigPanel";
import { parseInterviewReplyMarkers } from "@/lib/interview-markers";

type Msg = { id: string; role: "assistant" | "user"; content: string };

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** 与语音面试官「自动递增」一致：5 档；3 题取第 1、3、5 档 */
function progressiveQuestionPool(total: number): string[] {
  const ladder = [
    "你怎么理解这个主题的核心概念？能简单说说它是什么吗？",
    "这里面两个关键概念，你认为最关键的区别是什么？为什么说其中一个更重要？",
    "它们之间是什么逻辑关系？如果其中一个前提不成立，会影响结论吗？",
    "材料里某个判断你同意吗？请说出你的立场，并给出理由。",
    "如果让你把今天聊的内容向业务负责人汇报 2 分钟，你会怎么组织？对你实际工作有什么启发？",
  ];
  const n = Math.max(1, total);
  if (n >= 5) return ladder.slice(0, n);
  if (n === 3) return [ladder[0], ladder[2], ladder[4]];
  if (n === 4) return [ladder[0], ladder[1], ladder[3], ladder[4]];
  if (n === 2) return [ladder[0], ladder[3]];
  return [ladder[0]];
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function InterviewTextUI(props: {
  config: InterviewConfig;
  onBackToConfig: () => void;
  onFinish?: (messages: Array<{ role: "assistant" | "user"; content: string }>) => void;
  /** 生成评分报告（与语音模式一致） */
  onGenerateReport?: (messages: Array<{ role: "assistant" | "user"; content: string }>) => void;
}) {
  const { config, onBackToConfig, onFinish, onGenerateReport } = props;
  const pool = useMemo(() => progressiveQuestionPool(config.questionCount), [config.questionCount]);
  const total = useMemo(() => Math.max(1, config.questionCount), [config.questionCount]);

  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: nowId(),
      role: "assistant",
      content:
        "已进入文字面试。请先简单自我介绍（约 20 秒），随后我会按【第N题】标记逐题提问。",
    },
  ]);
  const [input, setInput] = useState("");
  const questionsAskedRef = useRef(0);
  /** 与 AI 标记对齐的当前题号展示，初始为 1 */
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [interviewEnded, setInterviewEnded] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);

  const displayQuestionUi = interviewEnded ? total : clamp(currentQuestion, 1, total);
  const progressPercent = Math.min(100, (displayQuestionUi / total) * 100);

  useLayoutEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || interviewEnded) return;
    setInput("");
    setMessages((ms) => [...ms, { id: nowId(), role: "user", content: text }]);

    window.setTimeout(() => {
      const qa = questionsAskedRef.current;
      if (qa < total) {
        const nextN = qa + 1;
        const q = pool[(nextN - 1) % pool.length];
        const body = `【第${nextN}题】\n${q}`;
        const { currentN } = parseInterviewReplyMarkers(body, total);
        if (currentN != null) setCurrentQuestion(currentN);
        questionsAskedRef.current = nextN;
        setMessages((ms) => [...ms, { id: nowId(), role: "assistant", content: body }]);
        return;
      }
      const endBody =
        "【面试结束】\n感谢你的回答，本轮面试已全部完成。你可以在下方生成评分报告。";
      setInterviewEnded(true);
      setMessages((ms) => [...ms, { id: nowId(), role: "assistant", content: endBody }]);
    }, 380);
  }, [interviewEnded, pool, total]);

  const finish = useCallback(() => {
    if (onFinish) {
      try {
        onFinish(messages.map((m) => ({ role: m.role, content: m.content })));
      } catch {
        /* ignore */
      }
    }
    onBackToConfig();
  }, [messages, onBackToConfig, onFinish]);

  const report = onGenerateReport ?? onFinish;

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#0f1115] p-6 text-slate-100">
      <div className="relative w-full max-w-[720px]">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.03] px-6 py-7 shadow-[0_0_0_1px_rgba(255,255,255,0.02),0_20px_60px_rgba(0,0,0,0.55)]">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-mono text-slate-400">Interview · Text</div>
              <div className="mt-1 text-lg font-semibold text-slate-100">
                文字面试
                <span className="ml-2 align-middle text-xs font-mono text-cyan-200/70">
                  LADDER
                </span>
              </div>
              <div className="mt-1 text-sm text-slate-400">
                {config.questionCount} 题 · 难度自动递进 · 题目带【第N题】；完成后【面试结束】
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={finish}
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-semibold text-slate-200 transition hover:bg-white/[0.07]"
              >
                <ArrowLeft className="mr-2 inline h-4 w-4" />
                返回配置
              </button>
              <button
                type="button"
                onClick={finish}
                className="rounded-2xl border border-rose-500/25 bg-rose-500/10 px-4 py-2 text-xs font-semibold text-rose-100 transition hover:bg-rose-500/15"
              >
                <X className="mr-2 inline h-4 w-4" />
                结束
              </button>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-mono text-slate-500">面试进度</div>
              <div className="text-sm font-semibold tabular-nums text-purple-100/95">
                第 {displayQuestionUi} 题 / 共 {total} 题
              </div>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-500/90 via-purple-500/85 to-purple-400/80 shadow-[0_0_14px_rgba(168,85,247,0.35)] transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div
            ref={chatScrollRef}
            className="mt-5 max-h-[320px] min-h-[160px] overflow-y-auto rounded-2xl border border-white/10 bg-black/20 p-4"
          >
            <div className="flex flex-col gap-3">
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={[
                    "max-w-[92%] rounded-2xl border px-4 py-3 text-sm leading-relaxed shadow-sm",
                    m.role === "assistant"
                      ? "self-start border-white/10 bg-white/[0.03] text-slate-100"
                      : "self-end border-cyan-500/25 bg-cyan-500/10 text-cyan-100",
                  ].join(" ")}
                >
                  <div className="whitespace-pre-wrap break-words">{m.content}</div>
                </div>
              ))}
            </div>
          </div>

          {interviewEnded ? (
            <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-center">
              <div className="text-sm font-semibold text-emerald-100">
                面试已结束，共完成 {total} 道题
              </div>
              <button
                type="button"
                onClick={() => {
                  if (report) {
                    report(messages.map((m) => ({ role: m.role, content: m.content })));
                  }
                }}
                className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-emerald-500/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
              >
                生成评分报告
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              rows={2}
              disabled={interviewEnded}
              placeholder={
                interviewEnded
                  ? "面试已结束"
                  : "输入你的回答…（回车可换行，点击发送提交）"
              }
              className="min-h-[44px] flex-1 resize-none rounded-2xl border border-white/10 bg-neutral-950/60 px-4 py-3 text-sm text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-500/35 focus:ring-1 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={interviewEnded}
              className="inline-flex h-[44px] items-center gap-2 rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              发送
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-600">
            说明：文字模式为本地模拟流程；语音模式将调用 /api/interview 与真实面试官模型。
          </div>
        </div>
      </div>
    </div>
  );
}
