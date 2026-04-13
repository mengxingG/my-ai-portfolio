"use client";

import { useCallback, useRef, useState } from "react";

type LegStatus = "idle" | "active" | "done" | "skipped" | "stuck";
type RunPhase = "idle" | "running" | "success" | "fatal" | "partial";
type ServerTone = "idle" | "processing" | "ok" | "error";

const STEP_MS = 520;
const MERGE_MS = 380;

function cn(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function SourceToggle({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div
      id={id}
      role="switch"
      tabIndex={disabled ? -1 : 0}
      aria-checked={checked}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onChange(!checked);
        }
      }}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40",
        checked
          ? "border-cyan-500/35 bg-cyan-500/10"
          : "border-white/10 bg-black/30 hover:border-white/20",
        disabled && "pointer-events-none cursor-not-allowed opacity-50"
      )}
    >
      <span className="text-xs font-medium text-slate-200">{label}</span>
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
          checked ? "bg-cyan-500/50" : "bg-slate-600/80"
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </span>
    </div>
  );
}

function FlowLine({ status }: { status: LegStatus }) {
  const widthClass =
    status === "idle" || status === "skipped" ? "w-0" : status === "stuck" ? "w-[32%]" : "w-full";
  const fillClass =
    status === "active"
      ? "bg-gradient-to-r from-cyan-400/30 via-cyan-400 to-purple-400/80 shadow-[0_0_14px_rgba(34,211,238,0.45)]"
      : status === "done"
        ? "bg-emerald-500/70 shadow-[0_0_10px_rgba(16,185,129,0.35)]"
        : status === "skipped"
          ? "bg-slate-600/30"
          : status === "stuck"
            ? "bg-red-500 shadow-[0_0_16px_rgba(239,68,68,0.55)]"
            : "bg-cyan-400/40";

  return (
    <div className="relative h-1.5 min-w-[2rem] flex-1 overflow-hidden rounded-full border border-dashed border-white/15 bg-black/40">
      <div className={cn("h-full rounded-full transition-all duration-500 ease-out", widthClass, fillClass)} />
      {status === "active" ? (
        <div className="degradation-flow-shimmer pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-80" />
      ) : null}
    </div>
  );
}

function SourceNode({
  label,
  short,
  enabled,
  leg,
}: {
  label: string;
  short: string;
  enabled: boolean;
  leg: LegStatus;
}) {
  const skipped = leg === "skipped";
  const stuck = leg === "stuck";
  const glow =
    leg === "done" || leg === "active"
      ? "border-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
      : skipped
        ? "border-slate-500/40 bg-slate-900/50 opacity-80"
        : stuck
          ? "border-red-500/60 shadow-[0_0_18px_rgba(239,68,68,0.35)]"
          : enabled
            ? "border-emerald-500/30"
            : "border-amber-500/40 bg-amber-500/5";

  return (
    <div
      className={cn(
        "flex min-w-[7.5rem] flex-col rounded-xl border px-3 py-2 transition-all duration-300",
        "bg-black/35 backdrop-blur-sm",
        glow
      )}
    >
      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">{short}</span>
      <span className="text-xs font-semibold text-slate-100">{label}</span>
      {skipped ? (
        <span className="mt-1 text-[10px] font-medium text-slate-500">Skipped</span>
      ) : null}
      {stuck ? (
        <span className="mt-1 text-[10px] font-medium text-red-300">Blocked</span>
      ) : null}
    </div>
  );
}

function ServerCore({ tone }: { tone: ServerTone }) {
  return (
    <div
      className={cn(
        "flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 text-center transition-all duration-500",
        "bg-black/40 backdrop-blur-md",
        tone === "idle" && "border-purple-500/25 shadow-[0_0_24px_rgba(168,85,247,0.12)]",
        tone === "processing" &&
          "border-cyan-400/50 shadow-[0_0_28px_rgba(34,211,238,0.25)] scale-[1.02]",
        tone === "ok" && "border-emerald-400/55 shadow-[0_0_28px_rgba(16,185,129,0.3)]",
        tone === "error" &&
          "border-red-500/70 bg-red-500/15 shadow-[0_0_32px_rgba(239,68,68,0.45)] animate-pulse"
      )}
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-slate-500">FastAPI</span>
      <span className="mt-1 text-xs font-bold text-slate-100">处理中心</span>
    </div>
  );
}

function TailLine({ active, done, fatal }: { active: boolean; done: boolean; fatal: boolean }) {
  const widthClass = fatal ? "w-[18%]" : active || done ? "w-full" : "w-0";
  const colorClass = fatal
    ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.45)]"
    : active
      ? "bg-gradient-to-r from-purple-400/60 to-emerald-400/80 shadow-[0_0_12px_rgba(168,85,247,0.25)]"
      : done
        ? "bg-emerald-500/65"
        : "bg-emerald-400/30";

  return (
    <div className="relative h-1.5 w-full max-w-[8rem] overflow-hidden rounded-full border border-dashed border-white/15 bg-black/40 lg:w-24">
      <div className={cn("h-full rounded-full transition-all duration-500 ease-out", widthClass, colorClass)} />
    </div>
  );
}

export function DegradationSimulator() {
  const [hnOn, setHnOn] = useState(true);
  const [redditOn, setRedditOn] = useState(true);
  const [xOn, setXOn] = useState(true);
  const [graceful, setGraceful] = useState(true);

  const [phase, setPhase] = useState<RunPhase>("idle");
  const [hnLeg, setHnLeg] = useState<LegStatus>("idle");
  const [redditLeg, setRedditLeg] = useState<LegStatus>("idle");
  const [xLeg, setXLeg] = useState<LegStatus>("idle");
  const [serverTone, setServerTone] = useState<ServerTone>("idle");
  const [tailActive, setTailActive] = useState(false);
  const [tailDone, setTailDone] = useState(false);
  const [tailFatal, setTailFatal] = useState(false);

  const runGen = useRef(0);

  const clearLegVisuals = useCallback(() => {
    setHnLeg("idle");
    setRedditLeg("idle");
    setXLeg("idle");
    setServerTone("idle");
    setTailActive(false);
    setTailDone(false);
    setTailFatal(false);
  }, []);

  const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  const runPipeline = useCallback(async () => {
    const myGen = ++runGen.current;
    const alive = () => runGen.current === myGen;

    clearLegVisuals();
    setPhase("running");

    const processSource = async (
      on: boolean,
      setLeg: (s: LegStatus) => void,
      name: "hn" | "reddit" | "x"
    ): Promise<"ok" | "fatal" | "skip"> => {
      if (!alive()) return "ok";
      if (on) {
        setLeg("active");
        await wait(STEP_MS);
        if (!alive()) return "ok";
        setLeg("done");
        return "ok";
      }
      if (!graceful) {
        setLeg("stuck");
        await wait(MERGE_MS);
        return "fatal";
      }
      setLeg("skipped");
      await wait(MERGE_MS * 0.6);
      return "skip";
    };

    // Hacker News
    const r0 = await processSource(hnOn, setHnLeg, "hn");
    if (!alive()) return;
    if (r0 === "fatal") {
      setServerTone("error");
      setPhase("fatal");
      setTailFatal(true);
      return;
    }

    // Reddit
    const r1 = await processSource(redditOn, setRedditLeg, "reddit");
    if (!alive()) return;
    if (r1 === "fatal") {
      setServerTone("error");
      setPhase("fatal");
      setTailFatal(true);
      return;
    }

    // X — user-specified scenarios center on X
    const r2 = await processSource(xOn, setXLeg, "x");
    if (!alive()) return;
    if (r2 === "fatal") {
      setServerTone("error");
      setPhase("fatal");
      setTailFatal(true);
      return;
    }

    setServerTone("processing");
    await wait(MERGE_MS);
    if (!alive()) return;
    setServerTone("ok");
    setTailActive(true);
    await wait(STEP_MS);
    if (!alive()) return;
    setTailActive(false);
    setTailDone(true);

    const partial = !hnOn || !redditOn || !xOn;
    setPhase(partial ? "partial" : "success");
  }, [graceful, hnOn, redditOn, xOn, clearLegVisuals]);

  const busy = phase === "running";
  const partialExactScenario = !xOn && hnOn && redditOn && graceful;
  const outputText =
    phase === "idle"
      ? "等待运行管线…"
      : phase === "running"
        ? "处理中…"
        : phase === "success"
          ? "Success: 全量数据抓取完毕"
          : phase === "fatal"
            ? "FATAL ERROR: Pipeline Crashed"
            : phase === "partial"
              ? partialExactScenario
                ? "Partial Success: 80% 数据抓取成功 (X 平台已跳过)"
                : "Partial Success: 部分数据源已跳过（优雅降级）"
              : "等待运行管线…";

  const outputClass =
    phase === "success"
      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
      : phase === "fatal"
        ? "border-red-500/50 bg-red-500/15 text-red-200"
        : phase === "partial"
          ? "border-amber-400/45 bg-amber-500/10 text-amber-100"
          : "border-white/10 bg-black/30 text-slate-500";

  return (
    <div
      className={cn(
        "rounded-2xl border border-purple-500/20 bg-black/35 p-5 shadow-[0_0_40px_rgba(168,85,247,0.08)] backdrop-blur-xl sm:p-6",
        "ring-1 ring-inset ring-white/[0.06]"
      )}
    >
      <div className="mb-1 text-[10px] font-mono uppercase tracking-[0.25em] text-purple-200/70">
        Interactive · Graceful Degradation
      </div>
      <h3 className="text-sm font-semibold text-slate-100">管线降级模拟器</h3>
      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        关闭数据源或关闭「优雅降级」以观察管线在 X 等节点失败时的行为差异。
      </p>

      {/* Control panel */}
      <div className="mt-5 rounded-xl border border-white/10 bg-black/25 p-4">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">控制台 (Control Panel)</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <SourceToggle id="sim-hn" label="Hacker News" checked={hnOn} onChange={setHnOn} disabled={busy} />
          <SourceToggle id="sim-reddit" label="Reddit" checked={redditOn} onChange={setRedditOn} disabled={busy} />
          <SourceToggle id="sim-x" label="X 平台" checked={xOn} onChange={setXOn} disabled={busy} />
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="switch"
            tabIndex={busy ? -1 : 0}
            aria-checked={graceful}
            aria-label="开启优雅降级"
            onKeyDown={(e) => {
              if (busy) return;
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setGraceful(!graceful);
              }
            }}
            onClick={() => !busy && setGraceful(!graceful)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-purple-500/40",
              busy && "pointer-events-none cursor-not-allowed opacity-60"
            )}
          >
            <span className="text-xs text-slate-300">开启优雅降级</span>
            <span
              className={cn(
                "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-300",
                graceful ? "bg-purple-500/50" : "bg-slate-600/80"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-300",
                  graceful ? "translate-x-5" : "translate-x-0"
                )}
              />
            </span>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={runPipeline}
            className={cn(
              "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all",
              "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
              "hover:border-cyan-400/60 hover:bg-cyan-500/25 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]",
              busy && "pointer-events-none opacity-60"
            )}
          >
            {busy ? "运行中…" : "运行管线 (Run Pipeline)"}
          </button>
        </div>
      </div>

      {/* Visualizer */}
      <div className="mt-6 rounded-xl border border-white/10 bg-black/20 p-4 sm:p-5">
        <div className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
          可视化数据流 (Data Flow Visualizer)
        </div>

        <div className="mt-6 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
          <div className="flex min-w-0 flex-1 flex-col gap-5">
            <div className="flex items-center gap-2 sm:gap-3">
              <SourceNode label="Hacker News" short="HN" enabled={hnOn} leg={hnLeg} />
              <FlowLine status={hnLeg} />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <SourceNode label="Reddit" short="RD" enabled={redditOn} leg={redditLeg} />
              <FlowLine status={redditLeg} />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <SourceNode label="X (Twitter)" short="X" enabled={xOn} leg={xLeg} />
              <FlowLine status={xLeg} />
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 lg:px-2">
            <div className="hidden text-[10px] text-slate-600 lg:block">汇聚</div>
            <ServerCore tone={serverTone} />
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-3 lg:items-stretch">
            <div className="flex w-full items-center justify-center gap-2 lg:justify-start">
              <TailLine active={tailActive} done={tailDone} fatal={tailFatal} />
            </div>
            <div
              className={cn(
                "w-full rounded-xl border px-4 py-3 font-mono text-xs leading-relaxed transition-all duration-500",
                outputClass
              )}
            >
              {outputText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
