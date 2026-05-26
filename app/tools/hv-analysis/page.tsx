"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import ConfigForm from "@/components/hv-analysis/ConfigForm";
import type { ConfigFormData } from "@/components/hv-analysis/ConfigForm";
import HistoryReportSidebar from "@/components/hv-analysis/HistoryReportSidebar";
import type { HvHistoryListItem } from "@/components/hv-analysis/HistoryReportSidebar";
import TerminalLogs from "@/components/hv-analysis/TerminalLogs";
import type { LogEntry } from "@/components/hv-analysis/TerminalLogs";
import AnalysisDashboard, { type StreamDataState } from "@/components/hv-analysis/AnalysisDashboard";
import QaInspector from "@/components/hv-analysis/QaInspector";
import type { HvQaResult, QaInspectorStatus } from "@/lib/hv-analysis/qa-types";
import {
  finalizeReportMarkdown,
  sanitizeReportFilename,
} from "@/lib/hv-analysis/report-markdown";

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

/** 判断一行是否为协议行（[INFO]/[WORKER]/[DATA]/[DONE] 等） */
function isProtocolLine(line: string): boolean {
  return /^\[\d{2}:\d{2}:\d{2}\]\s*\[(INFO|WORKER|DATA|DONE|SEARCH|ERROR|WARN)\]/.test(line);
}

/** 格式化秒数为 mm:ss */
function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** 全局分析状态：idle=配置表单，running=流式生成中，success=分析完成（含历史载入） */
export type HvAnalysisStatus = "idle" | "running" | "success";

const DEFAULT_CONFIG: ConfigFormData = {
  productName: "",
  researchMotivation: "",
  competitor: "",
  timeRange: "full",
  mode: "lite",
  modelId: "deepseek-v4-flash",
  objectType: "auto",
};

export default function HVAnalysisPage() {
  const [config, setConfig] = useState<ConfigFormData | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<HvAnalysisStatus>("idle");
  const [streamData, setStreamData] = useState<StreamDataState>({
    timeline: null,
    competitor: null,
    matrix: null,
    insights: null,
    quality: null,
  });
  const [hasData, setHasData] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ===== 打字机效果状态 =====
  const [typewriterText, setTypewriterText] = useState("");
  const [charCount, setCharCount] = useState(0);
  const typewriterRef = useRef<HTMLDivElement>(null);

  // ===== 动态计时器 =====
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [notionSaving, setNotionSaving] = useState(false);
  const [notionSaveMessage, setNotionSaveMessage] = useState<string | null>(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);

  // ===== 14 条军规质检 =====
  const [qaStatus, setQaStatus] = useState<QaInspectorStatus>("idle");
  const [qaResult, setQaResult] = useState<HvQaResult | null>(null);
  const [qaError, setQaError] = useState<string | null>(null);
  const analysisRunIdRef = useRef(0);
  const qaAbortRef = useRef<AbortController | null>(null);
  const qaReceivedFromStreamRef = useRef(false);
  const historyLoadSeqRef = useRef(0);
  const refineAbortRef = useRef<AbortController | null>(null);
  const [isRefining, setIsRefining] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const [historyDetailLoadingId, setHistoryDetailLoadingId] = useState<string | null>(
    null,
  );

  // 自动滚动打字机区域到底部
  useEffect(() => {
    if (typewriterRef.current) {
      typewriterRef.current.scrollTop = typewriterRef.current.scrollHeight;
    }
  }, [typewriterText]);

  // 计时器管理
  useEffect(() => {
    if (status === "running") {
      timerRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  const applyHistoryDetail = useCallback(
    (item: HvHistoryListItem, markdown: string, qaData: HvQaResult | null) => {
      qaReceivedFromStreamRef.current = Boolean(qaData);
      setTypewriterText(markdown);
      setCharCount(markdown.length);
      setPdfError(null);

      if (qaData) {
        setQaResult(qaData);
        setQaStatus("done");
        setQaError(null);
      } else {
        setQaResult(null);
        setQaStatus("idle");
        setQaError(null);
      }

      setLogs([
        {
          id: `hist-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "info",
          message: qaData
            ? `已载入历史报告与质检结果（${qaData.overallScore} 分）`
            : `已载入历史报告：${item.title}`,
        },
      ]);
    },
    [],
  );

  const handleSelectHistory = useCallback(
    async (item: HvHistoryListItem) => {
      abortRef.current?.abort();
      abortRef.current = null;
    qaAbortRef.current?.abort();
    refineAbortRef.current?.abort();
    analysisRunIdRef.current += 1;
      qaReceivedFromStreamRef.current = true;

      setSelectedHistoryId(item.id);
      setHistoryDetailLoadingId(item.id);
      setStatus("success");
      setConfig({
        ...DEFAULT_CONFIG,
        productName: item.target,
      });
      setStreamData({
        timeline: null,
        competitor: null,
        matrix: null,
        insights: null,
        quality: null,
      });
      setHasData(false);
      setPdfError(null);
      // 保留上一篇正文直至新数据就绪，避免闪屏

      const loadSeq = ++historyLoadSeqRef.current;

      try {
        const res = await fetch(`/api/hv-history/${encodeURIComponent(item.id)}`, {
          cache: "no-store",
        });
        const data = (await res.json()) as {
          markdown?: string;
          qaData?: HvQaResult | null;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `载入失败: ${res.status}`);
        }
        if (loadSeq !== historyLoadSeqRef.current) return;
        applyHistoryDetail(item, String(data.markdown ?? ""), data.qaData ?? null);
      } catch (e) {
        if (loadSeq !== historyLoadSeqRef.current) return;
        qaReceivedFromStreamRef.current = false;
        setQaStatus("idle");
        setQaResult(null);
        setLogs([
          {
            id: `hist-err-${Date.now()}`,
            timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
            level: "error",
            message: `历史报告载入失败: ${e instanceof Error ? e.message : String(e)}`,
          },
        ]);
      } finally {
        setHistoryDetailLoadingId(null);
      }
    },
    [applyHistoryDetail],
  );

  const handleStart = useCallback(async (data: ConfigFormData) => {
    setConfig(data);
    setLogs([]);
    setStreamData({ timeline: null, competitor: null, matrix: null, insights: null, quality: null });
    setHasData(false);
    setTypewriterText("");
    setCharCount(0);
    setElapsed(0);
    setPdfError(null);
    setNotionSaveMessage(null);
    setQaStatus("idle");
    setQaResult(null);
    setQaError(null);
    qaAbortRef.current?.abort();
    refineAbortRef.current?.abort();
    refineAbortRef.current = null;
    setIsRefining(false);
    qaReceivedFromStreamRef.current = false;
    analysisRunIdRef.current += 1;
    setSelectedHistoryId(null);
    setStatus("running");

    // 创建 AbortController
    abortRef.current?.abort();
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // 将 ConfigFormData 映射为 API 期望的 AnalysisRequest 格式
      const apiBody = {
        targetName: data.productName,
        additionalContext: data.researchMotivation,
        competitor: data.competitor,
        timeRange: data.timeRange,
        mode: data.mode,
        modelId: data.modelId,
        objectType: data.objectType,
      };
      const response = await fetch("/api/hv-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(apiBody),
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
        setStatus("success");
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
        setStatus("success");
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

          if (line.includes("[DONE]")) {
            setStatus("success");
            if (!qaReceivedFromStreamRef.current) {
              setQaStatus("loading");
            }
          }

          // 解析 [DATA] 结构化数据
          const payload = parseDataPayload(line);
          if (payload) {
            const type = payload.type as string;
            const content = payload.content;
            if (type === "qa" && content && typeof content === "object") {
              qaReceivedFromStreamRef.current = true;
              setQaResult(content as HvQaResult);
              setQaStatus("done");
              setQaError(null);
              continue;
            }
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

          // 非协议行 → 打字机效果内容（大模型生成的 Markdown）
          if (!isProtocolLine(line)) {
            setTypewriterText((prev) => prev + line + "\n");
            setCharCount((prev) => prev + line.length);
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
      setStatus("success");
    }
  }, []);

  /** 重置 */
  const handleReset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    refineAbortRef.current?.abort();
    refineAbortRef.current = null;
    setIsRefining(false);
    setConfig(null);
    setLogs([]);
    setStreamData({ timeline: null, competitor: null, matrix: null, insights: null, quality: null });
    setHasData(false);
    setTypewriterText("");
    setCharCount(0);
    setElapsed(0);
    setPdfError(null);
    setNotionSaveMessage(null);
    qaAbortRef.current?.abort();
    setQaStatus("idle");
    setQaResult(null);
    setQaError(null);
    qaReceivedFromStreamRef.current = false;
    setSelectedHistoryId(null);
    setStatus("idle");
  }, []);

  const getAssembledMarkdown = useCallback(() => {
    if (!config) return typewriterText;
    return finalizeReportMarkdown({
      targetName: config.productName,
      body: typewriterText,
      competitor: config.competitor,
      timeRange: config.timeRange,
      objectType: config.objectType,
    });
  }, [config, typewriterText]);

  const handleDownloadMd = useCallback(() => {
    const md = getAssembledMarkdown();
    const safe = sanitizeReportFilename(config?.productName ?? "unknown");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${safe}_横纵分析报告.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [config?.productName, getAssembledMarkdown]);

  const handleExportPdf = useCallback(async () => {
    if (!config?.productName || !typewriterText.trim()) return;
    setPdfExporting(true);
    setPdfError(null);
    try {
      const res = await fetch("/api/hv-analysis/pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText: typewriterText,
          targetName: config.productName,
          competitor: config.competitor,
          timeRange: config.timeRange,
          objectType: config.objectType,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `PDF 接口失败: ${res.status}`,
        );
      }
      const blob = await res.blob();
      const safe = sanitizeReportFilename(config.productName);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${safe}_横纵分析报告.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setPdfError(e instanceof Error ? e.message : String(e));
    } finally {
      setPdfExporting(false);
    }
  }, [config, typewriterText]);

  const runReportQa = useCallback(
    async (bodyMarkdown: string) => {
      if (!config) return;
      const runId = ++analysisRunIdRef.current;
      qaAbortRef.current?.abort();
      const controller = new AbortController();
      qaAbortRef.current = controller;
      qaReceivedFromStreamRef.current = true;

      setQaStatus("loading");
      setQaResult(null);
      setQaError(null);

      const reportText = finalizeReportMarkdown({
        targetName: config.productName,
        body: bodyMarkdown,
        competitor: config.competitor,
        timeRange: config.timeRange,
        objectType: config.objectType,
      });

      try {
        const res = await fetch("/api/hv-qa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportText }),
          signal: controller.signal,
        });

        if (runId !== analysisRunIdRef.current) return;

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error ?? `质检接口失败: ${res.status}`,
          );
        }

        const data = (await res.json()) as HvQaResult;
        if (runId !== analysisRunIdRef.current) return;

        setQaResult(data);
        setQaStatus("done");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (runId !== analysisRunIdRef.current) return;
        setQaError(e instanceof Error ? e.message : String(e));
        setQaStatus("error");
      }
    },
    [config],
  );

  const handleAutoRefine = useCallback(async () => {
    if (!config || !qaResult) return;
    const failedAudits = qaResult.items
      .filter((i) => !i.pass)
      .map((i) => ({ title: i.title, reason: i.reason }));
    if (failedAudits.length === 0) return;

    const previousBody = typewriterText;
    refineAbortRef.current?.abort();
    const controller = new AbortController();
    refineAbortRef.current = controller;
    analysisRunIdRef.current += 1;
    qaAbortRef.current?.abort();

    setIsRefining(true);
    setStatus("running");
    setSelectedHistoryId(null);
    setTypewriterText("");
    setCharCount(0);
    setNotionSaveMessage(null);
    qaReceivedFromStreamRef.current = false;
    setQaStatus("idle");
    setQaResult(null);
    setQaError(null);

    setLogs((prev) => [
      ...prev,
      {
        id: `refine-${Date.now()}`,
        timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
        level: "info",
        message: `Actor-Critic 闭环：开始定向修复（${failedAudits.length} 项未通过）`,
      },
    ]);

    try {
      const res = await fetch("/api/hv-refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportText: getAssembledMarkdown(),
          failedAudits,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { error?: string }).error ?? `修复接口失败: ${res.status}`,
        );
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("响应体不可读");

      const decoder = new TextDecoder();
      let refined = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        refined += decoder.decode(value, { stream: true });
        setTypewriterText(refined);
        setCharCount(refined.length);
      }

      if (!refined.trim()) {
        throw new Error("修复结果为空");
      }

      setStatus("success");
      setLogs((prev) => [
        ...prev,
        {
          id: `refine-done-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "success",
          message: "定向修复完成，正在重新执行 QA 质检…",
        },
      ]);

      await runReportQa(refined);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      const msg = e instanceof Error ? e.message : String(e);
      setTypewriterText(previousBody);
      setCharCount(previousBody.length);
      setStatus("success");
      setLogs((prev) => [
        ...prev,
        {
          id: `refine-err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "error",
          message: `定向修复失败: ${msg}`,
        },
      ]);
    } finally {
      setIsRefining(false);
    }
  }, [config, qaResult, typewriterText, getAssembledMarkdown, runReportQa]);

  const handleSaveToNotion = useCallback(async () => {
    if (!config?.productName || !typewriterText.trim()) return;
    setNotionSaving(true);
    setNotionSaveMessage(null);
    try {
      const res = await fetch("/api/hv-analysis/notion-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetName: config.productName,
          fullMarkdown: getAssembledMarkdown(),
          modelId: config.modelId,
          objectType: config.objectType,
          motivation: config.researchMotivation,
          competitors: config.competitor,
          qaData: qaResult,
          qaDataEmpty: !qaResult,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; pageId?: string; error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? `Notion 保存失败: ${res.status}`);
      }
      setNotionSaveMessage("已存入 Notion 数据库");
      setHistoryRefreshToken((n) => n + 1);
      setLogs((prev) => [
        ...prev,
        {
          id: `notion-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "success",
          message: `报告已写入 Notion（page: ${data.pageId ?? "ok"}）`,
        },
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setNotionSaveMessage(`保存失败：${msg}`);
      setLogs((prev) => [
        ...prev,
        {
          id: `notion-err-${Date.now()}`,
          timestamp: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          level: "error",
          message: `Notion 保存失败: ${msg}`,
        },
      ]);
    } finally {
      setNotionSaving(false);
    }
  }, [config, typewriterText, getAssembledMarkdown, qaResult]);

  /** 报告流结束（[DONE] 后 status=success）兜底调用 /api/hv-qa；流水线已推送 qa 则跳过 */
  useEffect(() => {
    if (status !== "success" || !config || !typewriterText.trim()) return;
    if (selectedHistoryId || isRefining) return;
    if (qaReceivedFromStreamRef.current) return;

    void runReportQa(typewriterText);
  }, [status, config, typewriterText, selectedHistoryId, isRefining, runReportQa]);

  return (
    <div className="relative flex min-h-screen">
      {/* 背景层 */}
      <div className="fixed inset-0 -z-10 bg-[#09090b]">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_0%,rgba(139,92,246,0.12),transparent_55%)]" />
      </div>

      <HistoryReportSidebar
        collapsed={sidebarCollapsed}
        onToggleCollapsed={() => setSidebarCollapsed((c) => !c)}
        selectedId={selectedHistoryId}
        detailLoadingId={historyDetailLoadingId}
        onSelect={handleSelectHistory}
        refreshToken={historyRefreshToken}
      />

      <div className="min-w-0 flex-1 overflow-x-hidden">
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
        {status === "idle" && (
          <div className="liquid-glass-card rounded-2xl p-5 sm:p-6">
            <ConfigForm onStart={handleStart} />
          </div>
        )}

        {/* ===== 阶段二 & 三：运行中 / 完成 ===== */}
        {(status === "running" || status === "success") && (
          <div className="space-y-6">
            {/* 顶部状态栏 — 含动态计时器 */}
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-black/30 px-4 py-3">
              <div className="flex items-center gap-3">
                {isRefining ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
                    <span className="text-xs font-mono text-orange-300">
                      根据审计意见定向修复中…
                    </span>
                  </>
                ) : status === "running" ? (
                  <>
                    <span className="h-2 w-2 animate-pulse rounded-full bg-amber-400" />
                    <span className="text-xs font-mono text-amber-300">分析执行中...</span>
                  </>
                ) : selectedHistoryId ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-cyan-400" />
                    <span className="text-xs font-mono text-cyan-300">历史研报已载入</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-xs font-mono text-green-300">分析完成</span>
                  </>
                )}
                {!selectedHistoryId && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800/50 px-2 py-0.5 text-[10px] font-mono text-slate-400">
                    ⏱️ {formatElapsed(elapsed)}
                  </span>
                )}
              </div>
              <button
                onClick={handleReset}
                className="rounded-lg border border-white/10 px-3 py-1 text-[11px] text-slate-400 transition hover:border-white/20 hover:text-slate-200"
              >
                ← 重新配置
              </button>
            </div>

            {/* 实时分析才展示终端；历史回看隐藏 */}
            {!selectedHistoryId && (
              <TerminalLogs logs={logs} title="hv-analysis terminal" />
            )}

            {/* ===== 打字机效果阅读区（始终渲染，有内容才显示） ===== */}
            <div
              className={`flex flex-col overflow-hidden rounded-xl border shadow-inner ${
                selectedHistoryId ? "" : "transition-all duration-500"
              } ${
                typewriterText
                  ? "border-white/10 bg-black/60 opacity-100"
                  : "border-white/5 bg-black/30 opacity-60"
              }`}
              style={{ minHeight: "480px", maxHeight: "70vh" }}
            >
              {/* 标题栏 + 字数统计 + 导出按钮 */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-4 py-2 shrink-0">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-gradient-to-br from-purple-600 to-cyan-600 text-[10px] font-bold text-white">
                    AI
                  </span>
                  <span className="text-[11px] font-mono text-slate-300">
                    {isRefining
                      ? "Auto-Refine 修复稿"
                      : selectedHistoryId
                        ? "历史报告正文"
                        : "实时生成内容"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {/* 实时字数统计 */}
                  <span className="inline-flex items-center gap-1 rounded-full border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                    {status === "running" && (
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
                    )}
                    {isRefining && (
                      <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                    )}
                    {charCount.toLocaleString()} chars
                  </span>
                  {/* 导出 Markdown 按钮（生成完毕后显示） */}
                  {(status === "success" || (status === "running" && typewriterText)) &&
                    typewriterText &&
                    !isRefining && (
                    <>
                      <button
                        type="button"
                        onClick={handleDownloadMd}
                        className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition hover:bg-emerald-500/20"
                      >
                        ⬇ 下载 Markdown
                      </button>
                      <button
                        type="button"
                        onClick={handleExportPdf}
                        disabled={pdfExporting}
                        className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300 transition hover:bg-blue-500/20 disabled:opacity-50"
                      >
                        {pdfExporting ? "排版中…" : "📄 导出 PDF"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveToNotion()}
                        disabled={notionSaving}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-300 transition hover:bg-violet-500/20 disabled:opacity-50"
                      >
                        {notionSaving ? "写入中…" : "💾 存入 Notion"}
                      </button>
                    </>
                  )}
                </div>
              </div>

              {pdfError && (
                <p className="border-b border-rose-500/20 bg-rose-500/10 px-4 py-2 text-[11px] text-rose-300">
                  PDF 导出失败：{pdfError}
                </p>
              )}
              {notionSaveMessage && (
                <p
                  className={`border-b px-4 py-2 text-[11px] ${
                    notionSaveMessage.startsWith("已存入")
                      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/20 bg-rose-500/10 text-rose-300"
                  }`}
                >
                  {notionSaveMessage}
                </p>
              )}
              {/* 打字机内容滚动区 — 撑满剩余高度 */}
              <div
                ref={typewriterRef}
                className="flex-1 overflow-y-auto p-4 text-[13px] leading-relaxed text-slate-200 scrollbar-thin"
                style={{ scrollbarWidth: "thin" }}
              >
                {typewriterText ? (
                  <div className="prose prose-invert prose-sm max-w-none break-words prose-headings:font-semibold prose-h1:mb-4 prose-h1:text-xl prose-h2:mt-6 prose-h2:text-lg prose-h3:text-base prose-h4:text-sm prose-p:font-normal prose-p:text-[13px] prose-p:leading-relaxed prose-p:text-slate-200 prose-strong:font-semibold prose-li:text-[13px]">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {typewriterText}
                    </ReactMarkdown>
                    {status === "running" && !isRefining && (
                      <span className="inline-block h-4 w-2 animate-pulse bg-cyan-400 ml-0.5 align-text-bottom" />
                    )}
                    {isRefining && (
                      <span className="inline-block h-4 w-2 animate-pulse bg-orange-400 ml-0.5 align-text-bottom" />
                    )}
                  </div>
                ) : historyDetailLoadingId ? (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    <span className="animate-pulse">▌正在从 Notion 载入历史报告…</span>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-600">
                    <span className="animate-pulse">▌等待大模型输出...</span>
                  </div>
                )}
              </div>
            </div>

            {/* 质检面板：实时 [DONE] 或历史载入 qaData 后立即展示 */}
            {status === "success" && qaStatus !== "idle" && (
              <QaInspector
                status={qaStatus}
                result={qaResult}
                error={qaError}
                refining={isRefining}
                onAutoRefine={
                  !selectedHistoryId && !isRefining && status === "success"
                    ? () => void handleAutoRefine()
                    : undefined
                }
              />
            )}

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
    </div>
  );
}
