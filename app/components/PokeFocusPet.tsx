"use client";

import { forwardRef, useEffect, useMemo, useImperativeHandle, useState } from "react";

export type PokeFocusPetHandle = {
  /** 若已在运行则忽略 */
  startTimer: () => void;
};

export type TodaySessionMode = "feynman" | "interview" | "peek";
export type TodaySession = {
  startTime: number;
  endTime: number;
  mode: TodaySessionMode;
};

type PokeFocusPetProps = {
  petSpriteUrl: string;
  petName: string;
  focusRunning: boolean;
  petEatBurst: boolean;
  petLevelUpBurst: boolean;
  petBubble: string | null;
  petStreak: number;
  petEmoji: "🙂" | "😎" | "👑";
  petBadge: string | null;
  petStage: "idle" | "paused" | "waking" | "happy" | "rest";
  subtleBreathClass: string;
  timerTextClass: string;
  elapsedMin: number;
  pokedexLevel: number;
  feedLevel: number;
  companionStatus: string;
  onReset: () => void;
  onStartTimer: () => void;
  todaySessions: TodaySession[];
  elapsedSec: number;
  userMessageCount: number;
  onSessionComplete: () => void;
  /** When false, render inline instead of fixed overlay. */
  floating?: boolean;
  /** Optional wrapper class when floating={false}. */
  containerClassName?: string;
  /** Compact UI for embedding into header cards. */
  compact?: boolean;
};

function hhmm(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n));
}

function mmss(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

export const PokeFocusPet = forwardRef<PokeFocusPetHandle, PokeFocusPetProps>(
  function PokeFocusPet(props, ref) {
    const {
      petSpriteUrl,
      petName,
      focusRunning,
      petEatBurst,
      petLevelUpBurst,
      petBubble,
      petStreak,
      petEmoji,
      petBadge,
      petStage,
      subtleBreathClass,
      timerTextClass,
      elapsedMin,
      pokedexLevel,
      feedLevel,
      companionStatus,
      onReset,
      onStartTimer,
      todaySessions,
      elapsedSec,
      userMessageCount,
      onSessionComplete,
      floating = true,
      containerClassName,
      compact = false,
    } = props;

    const [tip, setTip] = useState<{ open: boolean; x: number; y: number; text: string }>({
      open: false,
      x: 0,
      y: 0,
      text: "",
    });

    const [sessionMode, setSessionMode] = useState<"free" | 15 | 25>("free");
    const [sessionStartElapsedSec, setSessionStartElapsedSec] = useState<number | null>(null);
    const [sessionStartUserCount, setSessionStartUserCount] = useState<number>(0);
    const [sessionDoneOnce, setSessionDoneOnce] = useState(false);
    const [restState, setRestState] = useState<"none" | "resting" | "ready">("none");
    const [restRemainingSec, setRestRemainingSec] = useState(5 * 60);
    const [localBubble, setLocalBubble] = useState<string | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);

    // session start tracking
    useEffect(() => {
      if (!focusRunning) {
        setSessionStartElapsedSec(null);
        setSessionDoneOnce(false);
        return;
      }
      if (sessionMode === "free") return;
      if (sessionStartElapsedSec == null) {
        setSessionStartElapsedSec(elapsedSec);
        setSessionStartUserCount(userMessageCount);
        setSessionDoneOnce(false);
      }
    }, [elapsedSec, focusRunning, sessionMode, sessionStartElapsedSec, userMessageCount]);

    const sessionSecondsTotal = sessionMode === "free" ? null : sessionMode * 60;
    const sessionElapsed = sessionStartElapsedSec == null ? 0 : Math.max(0, elapsedSec - sessionStartElapsedSec);
    const sessionRemaining =
      sessionSecondsTotal == null ? null : Math.max(0, sessionSecondsTotal - sessionElapsed);
    const sessionUserMsgs = Math.max(0, userMessageCount - sessionStartUserCount);

    // session completion -> rest overlay + exp
    useEffect(() => {
      if (!focusRunning) return;
      if (sessionSecondsTotal == null) return;
      if (sessionStartElapsedSec == null) return;
      if (sessionDoneOnce) return;
      if (sessionRemaining != null && sessionRemaining <= 0) {
        setSessionDoneOnce(true);
        onSessionComplete();
        setLocalBubble("休息一下吧！5 分钟后回来");
        setRestRemainingSec(5 * 60);
        setRestState("resting");
      }
    }, [
      focusRunning,
      onSessionComplete,
      sessionDoneOnce,
      sessionRemaining,
      sessionSecondsTotal,
      sessionStartElapsedSec,
    ]);

    // rest countdown
    useEffect(() => {
      if (restState !== "resting") return;
      const id = window.setInterval(() => {
        setRestRemainingSec((s) => {
          const next = Math.max(0, s - 1);
          if (next === 0) {
            setRestState("ready");
            return 0;
          }
          return next;
        });
      }, 1000);
      return () => window.clearInterval(id);
    }, [restState]);

    const timeline = useMemo(() => {
      const now = new Date();
      const start = new Date(now);
      start.setHours(8, 0, 0, 0);
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      const startMs = start.getTime();
      const endMs = end.getTime();
      const range = Math.max(1, endMs - startMs);

      const modeColor: Record<TodaySessionMode, string> = {
        feynman: "bg-cyan-400/75",
        interview: "bg-purple-400/75",
        peek: "bg-white/35",
      };
      const modeLabel: Record<TodaySessionMode, string> = {
        feynman: "费曼学习",
        interview: "面试考核",
        peek: "随便看看",
      };

      const blocks = (Array.isArray(todaySessions) ? todaySessions : [])
        .filter((s) => Number.isFinite(s.startTime) && Number.isFinite(s.endTime) && s.endTime > s.startTime)
        .map((s) => {
          const s0 = clamp(s.startTime, startMs, endMs);
          const e0 = clamp(s.endTime, startMs, endMs);
          const leftPct = ((s0 - startMs) / range) * 100;
          const widthPct = ((Math.max(s0, e0) - s0) / range) * 100;
          const minutes = Math.max(1, Math.round((s.endTime - s.startTime) / 60000));
          return {
            key: `${s.startTime}-${s.endTime}-${s.mode}`,
            leftPct,
            widthPct: Math.max(0.6, widthPct), // ensure visible
            cls: modeColor[s.mode],
            text: `${hhmm(s.startTime)} - ${hhmm(s.endTime)} ${modeLabel[s.mode]} ${minutes}分钟`,
          };
        })
        .filter((b) => b.widthPct > 0)
        .sort((a, b) => a.leftPct - b.leftPct);

      const totalMinutes = (Array.isArray(todaySessions) ? todaySessions : []).reduce((sum, s) => {
        const ms = Math.max(0, Number(s.endTime) - Number(s.startTime));
        return sum + Math.round(ms / 60000);
      }, 0);

      return {
        blocks,
        totalMinutes,
        count: (Array.isArray(todaySessions) ? todaySessions : []).length,
      };
    }, [todaySessions]);

    useImperativeHandle(
      ref,
      () => ({
        startTimer: () => {
          onStartTimer();
        },
      }),
      [onStartTimer]
    );

    return (
      <div
        className={
          floating
            ? "fixed right-4 top-0 z-[60] w-[330px] max-w-[calc(100vw-1rem)]"
            : (containerClassName ?? "")
        }
      >
        {restState !== "none" ? (
          <div className="pointer-events-none fixed inset-0 z-[95] flex items-center justify-center bg-black/50 p-6 backdrop-blur-[1px]">
            <div className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950/75 p-6 shadow-[0_30px_120px_rgba(0,0,0,0.75)] ring-1 ring-white/10 backdrop-blur">
              {restState === "resting" ? (
                <>
                  <div className="text-xs font-mono text-slate-400">Rest · Countdown</div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">
                    已学习 {sessionMode} 分钟
                  </div>
                  <div className="mt-1 text-sm text-slate-400">
                    本 session：发送了 {sessionUserMsgs} 条消息
                  </div>
                  <div className="mt-4 rounded-2xl border border-white/10 bg-black/30 px-4 py-3 text-center">
                    <div className="text-[11px] font-mono text-slate-500">休息倒计时</div>
                    <div className="mt-1 text-3xl font-extrabold tabular-nums text-cyan-200">
                      {mmss(restRemainingSec)}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRestState("none")}
                    className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.06]"
                  >
                    跳过休息
                  </button>
                </>
              ) : (
                <>
                  <div className="text-xs font-mono text-slate-400">Rest · Done</div>
                  <div className="mt-2 text-lg font-semibold text-slate-100">准备好下一轮了吗？</div>
                  <button
                    type="button"
                    onClick={() => {
                      setRestState("none");
                      setLocalBubble("准备好下一轮了吗？");
                      // start next session window from now
                      if (sessionMode !== "free") {
                        setSessionStartElapsedSec(elapsedSec);
                        setSessionStartUserCount(userMessageCount);
                        setSessionDoneOnce(false);
                      }
                      if (!focusRunning) onStartTimer();
                    }}
                    className="mt-4 w-full rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/15"
                  >
                    开始
                  </button>
                </>
              )}
            </div>
          </div>
        ) : null}

        {tip.open ? (
          <div
            className="pointer-events-none fixed z-[90] -translate-x-1/2 rounded-xl border border-white/10 bg-neutral-950/90 px-3 py-2 text-xs text-slate-200 shadow-xl backdrop-blur"
            style={{ left: tip.x, top: tip.y }}
          >
            {tip.text}
          </div>
        ) : null}

        <div
          className={[
            compact
              ? "rounded-3xl border border-white/10 bg-neutral-950/65 px-3 py-3 text-sm shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur"
              : "rounded-3xl border border-white/10 bg-neutral-950/65 px-4 py-3 text-sm shadow-[0_30px_120px_rgba(0,0,0,0.55)] backdrop-blur",
            focusRunning && !compact ? "motion-safe:animate-[pulse_3.2s_ease-in-out_infinite]" : "",
            subtleBreathClass,
          ].join(" ")}
        >
          {compact ? (
            <div className="flex h-full flex-col items-center justify-between">
              <div className="flex flex-col items-center">
                <div
                  className={[
                    "relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-black/25 transition",
                    petEatBurst ? "pet-eat-burst border-cyan-400/40" : "",
                    petLevelUpBurst ? "pet-level-up-burst border-emerald-400/35" : "",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={petSpriteUrl}
                    alt={petName}
                    className="h-12 w-12 select-none object-contain pixelated"
                    draggable={false}
                  />
                  <div
                    className="absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-xl border border-white/10 bg-black/50 text-sm shadow-[0_0_30px_rgba(0,0,0,0.45)]"
                    aria-label="Pet mood emoji"
                    title="连续学习奖励外观"
                  >
                    {petEmoji}
                  </div>
                  {localBubble || petBubble ? (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-neutral-950/85 px-2.5 py-1 text-[11px] font-semibold text-slate-100 shadow-xl backdrop-blur">
                      {localBubble ?? petBubble}
                    </div>
                  ) : null}
                </div>

                <div className="mt-2 whitespace-nowrap text-[12px] font-semibold text-slate-200">
                  Lv.{pokedexLevel}{" "}
                  <span className="font-normal text-slate-400">
                    ·{" "}
                    {sessionMode === "free" || sessionRemaining == null
                      ? `已学习 ${elapsedMin}min`
                      : `剩余 ${mmss(sessionRemaining)}`}
                  </span>
                </div>
                {petBadge ? (
                  <div className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                    {petBadge}
                  </div>
                ) : null}
              </div>

              <div className="mt-2 w-full">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">EXP</span>
                  <span className="font-mono">{feedLevel}/100</span>
                </div>
                <div className="mt-1 h-1 overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400/80 to-purple-400/80 transition-[width] duration-500"
                    style={{ width: `${feedLevel}%` }}
                  />
                </div>
              </div>

              {/* Today timeline (8:00 - 24:00) */}
              <div className="mt-2 w-full">
                <div className="relative h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
                  {timeline.blocks.map((b) => (
                    <div
                      key={b.key}
                      className={["absolute top-0 h-full rounded-full", b.cls].join(" ")}
                      style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                      onMouseEnter={(e) => {
                        setTip({ open: true, x: e.clientX, y: e.clientY - 12, text: b.text });
                      }}
                      onMouseMove={(e) => {
                        setTip((v) => (v.open ? { ...v, x: e.clientX, y: e.clientY - 12 } : v));
                      }}
                      onMouseLeave={() => setTip({ open: false, x: 0, y: 0, text: "" })}
                      aria-label={b.text}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  今日已学习 {timeline.totalMinutes} 分钟 · {timeline.count} 个 session
                </div>
              </div>

              <div className="mt-2 flex w-full items-center justify-between text-[11px] text-slate-300">
                <span className="whitespace-nowrap text-slate-400">🔥{petStreak}天</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] p-0 text-slate-200 transition hover:bg-white/[0.08]"
                    aria-label="Session settings"
                    title="点击开始学习计时"
                  >
                    <span className="grid h-full w-full place-items-center text-[20px] leading-none">
                      ⚙︎
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] text-slate-200 transition hover:bg-white/[0.08]"
                    aria-label="Reset timer"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <div
                  className={[
                    "relative flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-black/25 transition",
                    petEatBurst ? "pet-eat-burst border-cyan-400/40" : "",
                    petLevelUpBurst ? "pet-level-up-burst border-emerald-400/35" : "",
                  ].join(" ")}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={petSpriteUrl}
                    alt={petName}
                    className="h-32 w-32 select-none object-contain pixelated"
                    draggable={false}
                  />
                  <div
                    className="absolute -right-1 -top-1 grid h-7 w-7 place-items-center rounded-xl border border-white/10 bg-black/50 text-sm shadow-[0_0_30px_rgba(0,0,0,0.45)]"
                    aria-label="Pet mood emoji"
                    title="连续学习奖励外观"
                  >
                    {petEmoji}
                  </div>
                  {localBubble || petBubble ? (
                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border border-white/10 bg-neutral-950/85 px-3 py-1.5 text-[11px] font-semibold text-slate-100 shadow-xl backdrop-blur">
                      {localBubble ?? petBubble}
                    </div>
                  ) : null}
                  {petStage === "rest" ? (
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-100">
                      休息一下？
                    </div>
                  ) : null}
                </div>

                <div className="min-w-0">
                  <div className="text-xs font-mono text-slate-400">
                    PokeFocusPet · Lv.{pokedexLevel}{" "}
                    {petStreak >= 3 ? (
                      <span className="ml-1 align-middle" aria-label="连续学习火焰">
                        🔥
                      </span>
                    ) : null}
                  </div>
                  <div className={["text-2xl font-semibold tabular-nums", timerTextClass].join(" ")}>
                    {sessionMode === "free" || sessionRemaining == null ? (
                      <>已学习 {elapsedMin} 分钟</>
                    ) : (
                      <span className="text-purple-200">剩余 {mmss(sessionRemaining)}</span>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-slate-500">{companionStatus}</div>
                  {petBadge ? (
                    <div className="mt-1 inline-flex rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[11px] font-semibold text-slate-200">
                      {petBadge}
                    </div>
                  ) : null}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen((v) => !v)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] p-0 text-slate-200 transition hover:bg-white/[0.08]"
                    aria-label="Session settings"
                    title="点击开始学习计时"
                  >
                    <span className="grid h-full w-full place-items-center text-[30px] leading-none">
                      ⚙︎
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={onReset}
                    className="inline-flex h-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] px-3 text-xs text-slate-200 transition hover:bg-white/[0.08]"
                    aria-label="Reset timer"
                  >
                    Reset
                  </button>
                </div>
              </div>

              <div className="mt-3">
                <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono">EXP</span>
                  <span className="font-mono">{feedLevel}/100</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full border border-white/10 bg-black/30">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400/80 to-purple-400/80 transition-[width] duration-500"
                    style={{ width: `${feedLevel}%` }}
                  />
                </div>
              </div>

              {/* Today timeline (8:00 - 24:00) */}
              <div className="mt-3">
                <div className="relative h-2 w-full overflow-hidden rounded-full border border-white/10 bg-black/30">
                  {timeline.blocks.map((b) => (
                    <div
                      key={b.key}
                      className={["absolute top-0 h-full rounded-full", b.cls].join(" ")}
                      style={{ left: `${b.leftPct}%`, width: `${b.widthPct}%` }}
                      onMouseEnter={(e) => {
                        setTip({ open: true, x: e.clientX, y: e.clientY - 12, text: b.text });
                      }}
                      onMouseMove={(e) => {
                        setTip((v) => (v.open ? { ...v, x: e.clientX, y: e.clientY - 12 } : v));
                      }}
                      onMouseLeave={() => setTip({ open: false, x: 0, y: 0, text: "" })}
                      aria-label={b.text}
                    />
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-slate-500">
                  今日已学习 {timeline.totalMinutes} 分钟 · {timeline.count} 个 session
                </div>
              </div>
            </>
          )}
        </div>

        {settingsOpen ? (
          <div className="relative">
            <div
              className={[
                "absolute right-0 top-2 z-[80] w-[260px] rounded-2xl border border-white/10 bg-neutral-950/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur",
                compact ? "translate-y-0" : "",
              ].join(" ")}
              role="dialog"
              aria-label="Session 配置"
            >
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-mono text-slate-400">Session 模式</div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-slate-200 hover:bg-white/[0.06]"
                >
                  关闭
                </button>
              </div>

              <div className="mt-2 space-y-2 text-sm text-slate-200">
                {(
                  [
                    { id: "free", label: "自由模式（正计时无限制）", value: "free" as const },
                    { id: "15", label: "15 分钟", value: 15 as const },
                    { id: "25", label: "25 分钟", value: 25 as const },
                  ] as const
                ).map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      setSessionMode(o.value);
                      setSettingsOpen(false);
                    }}
                    className={[
                      "flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-[13px] transition",
                      sessionMode === o.value
                        ? "border-cyan-500/30 bg-cyan-500/10"
                        : "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]",
                    ].join(" ")}
                    aria-pressed={sessionMode === o.value}
                  >
                    <span className="min-w-0 flex-1">{o.label}</span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {sessionMode === o.value ? "已选" : ""}
                    </span>
                  </button>
                ))}
              </div>

              {sessionMode === "free" ? (
                <div className="mt-2 text-[11px] text-slate-500">当前为正计时显示。</div>
              ) : (
                <div className="mt-2 text-[11px] text-slate-500">
                  已选择 {sessionMode} 分钟：将显示倒计时，结束后进入可跳过休息提示。
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    );
  }
);
