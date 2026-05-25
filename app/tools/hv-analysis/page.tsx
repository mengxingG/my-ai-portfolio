"use client";

import { useState, useCallback, useRef } from "react";
import ConfigForm from "@/components/hv-analysis/ConfigForm";
import type { ConfigFormData } from "@/components/hv-analysis/ConfigForm";
import TerminalLogs from "@/components/hv-analysis/TerminalLogs";
import type { LogEntry } from "@/components/hv-analysis/TerminalLogs";
import AnalysisDashboard, { type StreamDataState } from "@/components/hv-analysis/AnalysisDashboard";

/** 从流式文本行解析日志级别 */
function inferLevel(text: string): LogEntry["level"] {
  if (text.includes("[ERROR]")) return "error";
  if (text.includes("[WARN]")) return "warn";
  if (text.includes("[DONE]") || text.includes("[OK]")) return "success";
  if (text.includes("[SEARCH]") || text.includes("[DATA]")) return "system";
  return "info";
}

/** 从流式文本行提取消息内容（去掉时间戳和级别前缀） */
function extractMessage(text: string): string {
  // 去掉 [HH:MM:SS] [LEVEL] 前缀
  return text.replace(/^\[\d{2}:\d{2}:\d{2}\]\s*\[\w+\]\s*/, "").trim();
}

/** 生成 LogEntry */
function makeLogFromChunk(chunk: string): LogEntry {
  const now = new Date();
  const ts = now.toLocaleTimeString("zh-CN", { hour12: false });
  const level = inferLevel(chunk);
  const message = extractMessage(chunk);
  return {
    id: `${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
    timestamp: ts,
    level,
    message,
  };
}

/** 解析 [DATA] 前缀的结构化 JSON */
function parseDataPayload(line: string): Record<string, unknown> | null {
  const match = line.match(/\[DATA\]\s*(\{.*\})/);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

export default function HVAnalysisPage() {
  const [config, setConfig] = useState<ConfigFormData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [phase, setPhase] = useState<"form" | "running" | "done">("form");
  const [streamData, setStreamData] = useState<StreamDataState>({
    timeline: null,
    competitor: null,
    matrix: null,
    insights: null,
    quality: null,
  });
  const [hasData, setHasData] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleStart = useCallback(async (data: ConfigFormData) => {
    setConfig(data);
    setLogs([]);
    setStreamData({ timeline: null, competitor: null, matrix: null, insights: null, quality: null });
    setHasData(false);
    setPhase("running");

    // 创建 AbortController
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const response = await fetch("/api/hv-analysis/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errText = await response.text();
        setLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
            level: "error",
            message: `API 请求失败: ${response.status} ${errText}`,
          },
        ]);
        setPhase("done");
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setLogs((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
            level: "error",
            message: "响应体不可读",
          },
        ]);
        setPhase("done");
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按行分割处理
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? ""; // 保留未完成的行

        for (const line of lines) {
          if (!line.trim()) continue;

          // 添加日志
          setLogs((prev) => [...prev, makeLogFromChunk(line)]);

          // 解析 [DATA] 结构化数据
          const payload = parseDataPayload(line);
          if (payload) {
            const type = payload.type as string;
            const content = payload.content;
            // 首次收到 [DATA] 时，顺滑展开看板
            setHasData(true);
            if (type === "timeline") {
              setStreamData((prev) => ({ ...prev, timeline: content }));
            } else if (type === "competitor") {
              setStreamData((prev) => ({ ...prev, competitor: content }));
            } else if (type === "matrix") {
              setStreamData((prev) => ({ ...prev, matrix: content }));
            } else if (type === "insights") {
              setStreamData((prev) => ({ ...prev, insights: content }));
            } else if (type === "quality") {
              setStreamData((prev) => ({ ...prev, quality: content }));
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        // 用户取消，不处理
        return;
      }
      setLogs((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "error",
          message: `连接异常: ${err instanceof Error ? err.message : String(err)}`,
        },
      ]);
    } finally {
      setPhase("done");
    }
  }, []);

  /** 重置 */
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setConfig(null);
    setLogs([]);
    setStreamData({ timeline: null, competitor: null, matrix: null, insights: null, quality: null });
    setHasData(false);
    setPhase("form");
  }, []);

  return (
    <div className="relative min-h-screen">
      {/* 背景层 */}
      <div className="fixed inset-0 -z-10 bg-[#09090b]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.12),transparent_55%)]" />
      </div>

      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* ===== 页面头部 ===== */}
        <header className="mb-8">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-purple-600 to-cyan-600 text-[12px] font-bold text-white">
              HV
            </span>
            <h1 className="text-lg font-semibold text-slate-100 sm:text-xl">
              横纵分析法
            </h1>
            <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono text-purple-300">
              HV-Analysis
            </span>
          </div>
          <p className="mt-1.5 text-sm text-slate-300">
            设定研究对象与视角，AI 将自动执行横纵交叉分析——横轴（空间对比）对标竞品，纵轴（时间演进）追溯发展脉络。
          </p>
        </header>

        {/* ===== 阶段一：配置表单 ===== */}
        {phase === "form" && (
          <div className="liquid-glass-card rounded-2xl p-5 sm:p-6">
            <ConfigForm onStart={handleStart} />
          </div>
        )}

        {/* ===== 阶段二 & 三：运行中 / 完成 ===== */}
        {(phase === "running" || phase === "done") && (
          <div className="space-y-6">
            {/* 顶部状态栏 */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="flex items-center gap-2">
                {phase === "running" ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-xs font-mono text-amber-300">分析执行中...</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs font-mono text-green-300">分析完成</span>
                  </>
                )}
              </div>
              <button
                onClick={handleReset}
                className="rounded-lg border border-white/10 px-3 py-1 text-[11px] text-slate-400 transition hover:border-white/20 hover:text-slate-200"
              >
                ← 重新配置
              </button>
            </div>

            {/* 终端日志 */}
            <TerminalLogs logs={logs} title="hv-analysis terminal" />

            {/* 大屏看板（收到第一条 [DATA] 后顺滑展开） */}
            {hasData && config && (
              <div
                className="liquid-glass-card rounded-2xl p-5 sm:p-6 transition-all duration-700 ease-out"
                style={{
                  opacity: 1,
                  transform: "translateY(0)",
                }}
              >
                <AnalysisDashboard
                  config={config}
                  streamData={streamData}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
