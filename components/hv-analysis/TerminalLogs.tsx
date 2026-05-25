"use client";

import { useEffect, useRef } from "react";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success" | "system";
  message: string;
  detail?: string;
}

interface TerminalLogsProps {
  logs: LogEntry[];
  title?: string;
}

const levelStyles: Record<LogEntry["level"], string> = {
  info: "text-cyan-200",
  warn: "text-amber-200",
  error: "text-red-300",
  success: "text-green-300",
  system: "text-purple-300",
};

const levelBadge: Record<LogEntry["level"], string> = {
  info: "INFO",
  warn: "WARN",
  error: "ERROR",
  success: "OK",
  system: "SYS",
};

export default function TerminalLogs({ logs, title = "终端日志" }: TerminalLogsProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-black/60 shadow-inner">
      {/* 终端标题栏 */}
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2">
        <div className="flex gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
        </div>
        <span className="ml-2 text-[11px] font-mono text-slate-300">{title}</span>
        <span className="ml-auto text-[10px] font-mono text-slate-400">
          {logs.length} entries
        </span>
      </div>

      {/* 日志滚动区 */}
      <div
        ref={scrollRef}
        className="h-64 overflow-y-auto p-3 font-mono text-[12px] leading-relaxed scrollbar-thin"
        style={{ scrollbarWidth: "thin" }}
      >
        {logs.length === 0 ? (
          <div className="flex h-full items-center justify-center text-slate-600">
            <span className="animate-pulse">▌等待执行...</span>
          </div>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => (
              <div key={log.id} className="group flex gap-2">
                {/* 时间戳 */}
                <span className="shrink-0 text-slate-400">{log.timestamp}</span>
                {/* 级别徽标 */}
                <span
                  className={`shrink-0 rounded px-1 font-semibold ${
                    levelStyles[log.level]
                  } bg-white/5`}
                >
                  {levelBadge[log.level]}
                </span>
                {/* 消息 */}
                <span className={levelStyles[log.level]}>
                  {log.message}
                  {log.detail && (
                    <span className="ml-1 text-slate-500">— {log.detail}</span>
                  )}
                </span>
                {/* 光标闪烁（最后一条） */}
                {log.id === logs[logs.length - 1]?.id && (
                  <span className="animate-pulse text-slate-400">▌</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
