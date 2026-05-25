"use client";

import { useState } from "react";

export type AnalysisMode = "lite" | "full";

export interface ConfigFormData {
  /** 产品 / 分析对象（必填） */
  productName: string;
  /** 研究动机 / 核心关注点（选填）— 作为 Prompt Context 传给 AI */
  researchMotivation: string;
  /** 指定对标竞品（选填）— 对应横轴（空间对比） */
  competitor: string;
  /** 时间追溯范围（选填）— 对应纵轴（时间演进） */
  timeRange: "full" | "3years" | "1year";
  /** 分析模式 */
  mode: AnalysisMode;
}

interface ConfigFormProps {
  onStart: (data: ConfigFormData) => void;
  disabled?: boolean;
}

const inputBase =
  "w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-slate-100 placeholder-slate-400 outline-none transition focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30";
const labelBase = "block text-xs font-semibold tracking-wide text-slate-200 mb-1.5";

const TIME_RANGE_OPTIONS = [
  { value: "full", label: "追踪完整生命史" },
  { value: "3years", label: "仅看近三年" },
  { value: "1year", label: "仅看近一年" },
] as const;

export default function ConfigForm({ onStart, disabled }: ConfigFormProps) {
  const [productName, setProductName] = useState("");
  const [researchMotivation, setResearchMotivation] = useState("");
  const [competitor, setCompetitor] = useState("");
  const [timeRange, setTimeRange] = useState<ConfigFormData["timeRange"]>("full");
  const [mode, setMode] = useState<AnalysisMode>("lite");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onStart({ productName, researchMotivation, competitor, timeRange, mode });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* 标题区 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">🔍 深度研究配置</h2>
          <p className="mt-0.5 text-xs text-slate-300">
            设定研究对象与视角，AI 将自动执行横纵交叉分析
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-300">模式</span>
          <button
            type="button"
            onClick={() => setMode(mode === "lite" ? "full" : "lite")}
            disabled={disabled}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
              mode === "full" ? "bg-purple-600/60" : "bg-white/10"
            } ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                mode === "full" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className="text-[11px] text-slate-200">
            {mode === "lite" ? "精简版" : "详细版"}
          </span>
        </div>
      </div>

      {/* 产品 / 分析对象（必填） */}
      <div>
        <label className={labelBase}>
          产品 / 分析对象
          <span className="ml-1.5 text-[10px] text-rose-400/70">必填</span>
        </label>
        <input
          className={inputBase}
          placeholder="你想系统性研究的产品、公司、概念或人物（例如：DeepSeek、RAG技术、Cursor）"
          value={productName}
          onChange={(e) => setProductName(e.target.value)}
          disabled={disabled}
          required
        />
        <p className="mt-1 text-[10px] text-cyan-400">
          这是研究的锚点，AI 将围绕它展开横纵交叉分析
        </p>
      </div>

      {/* 研究动机 / 核心关注点（选填） */}
      <div>
        <label className={labelBase}>
          研究动机 / 核心关注点
          <span className="ml-1.5 text-[10px] text-slate-400">选填</span>
        </label>
        <textarea
          className={`${inputBase} min-h-[72px] resize-y`}
          placeholder="为什么要研究它？有没有特别想深入的侧重点？（例如：它的商业模式是怎么跑通的？技术架构有何特殊之处？）"
          value={researchMotivation}
          onChange={(e) => setResearchMotivation(e.target.value)}
          disabled={disabled}
        />
        <p className="mt-1 text-[10px] text-cyan-400">
          这部分将作为 Prompt 的 Context 传给 AI，指导横纵交汇时的最终洞察输出
        </p>
      </div>

      {/* 指定对标竞品（选填） */}
      <div>
        <label className={labelBase}>
          指定对标竞品
          <span className="ml-1.5 text-[10px] text-slate-400">选填</span>
        </label>
        <input
          className={inputBase}
          placeholder="你希望它与谁进行横向对比？（例如：OpenAI, Claude。若留空，AI 将自动检索行业竞品）"
          value={competitor}
          onChange={(e) => setCompetitor(e.target.value)}
          disabled={disabled}
        />
        <p className="mt-1 text-[10px] text-cyan-400">
          这对应了核心概念里的横轴（空间对比）
        </p>
      </div>

      {/* 时间追溯范围（选填 / 下拉单选） */}
      <div>
        <label className={labelBase}>
          时间追溯范围
          <span className="ml-1.5 text-[10px] text-slate-400">选填</span>
        </label>
        <select
          className={inputBase}
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value as ConfigFormData["timeRange"])}
          disabled={disabled}
        >
          {TIME_RANGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-[#1a1a2e] text-slate-200">
              {opt.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[10px] text-cyan-400">
          这对应了核心概念里的纵轴（时间演进）
        </p>
      </div>

      {/* 执行按钮 */}
      <button
        type="submit"
        disabled={disabled || !productName.trim()}
        className={`w-full rounded-lg py-2.5 text-sm font-semibold tracking-wide transition ${
          disabled || !productName.trim()
            ? "cursor-not-allowed bg-white/5 text-slate-600"
            : "bg-gradient-to-r from-purple-600 to-cyan-600 text-white shadow-lg shadow-purple-600/20 hover:shadow-purple-600/40 active:scale-[0.98]"
        }`}
      >
        {disabled ? "⏳ 分析执行中..." : "🚀 开始深度研究"}
      </button>
    </form>
  );
}
