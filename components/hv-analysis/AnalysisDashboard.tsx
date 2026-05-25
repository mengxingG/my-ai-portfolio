"use client";

import type { ConfigFormData } from "./ConfigForm";

/** 流式数据累积状态（与 page.tsx 保持一致） */
export interface StreamDataState {
  timeline: unknown | null;
  competitor: unknown | null;
  matrix: unknown | null;
  insights: unknown | null;
  quality: unknown | null;
}

interface AnalysisDashboardProps {
  config: ConfigFormData;
  streamData?: StreamDataState;
}

/** 时间范围标签映射 */
const TIME_RANGE_LABEL: Record<ConfigFormData["timeRange"], string> = {
  full: "追踪完整生命史",
  "3years": "仅看近三年",
  "1year": "仅看近一年",
};

/** Mock 热力数据 — 横轴维度 × 纵轴实体（降级方案） */
function generateMockHeatmap(config: ConfigFormData) {
  // 从 competitor 字段解析横轴对比实体
  const competitors = config.competitor
    ? config.competitor.split(",").map((s) => s.trim()).filter(Boolean)
    : ["行业平均", "头部竞品", "新兴玩家"];
  const hDims = competitors;
  // 纵轴用时间维度
  const vDims = ["早期阶段", "中期发展", "当前状态"];

  const cells = vDims.map((v) => ({
    entity: v,
    scores: hDims.map((h) => ({
      dimension: h,
      score: Number((Math.random() * 3 + 2).toFixed(1)),
    })),
  }));

  return { hDims, vDims, cells };
}

/** 热力色阶 */
function heatColor(score: number): string {
  if (score >= 4.5) return "bg-green-500/30 text-green-200 border-green-500/30";
  if (score >= 3.8) return "bg-emerald-500/20 text-emerald-200 border-emerald-500/20";
  if (score >= 3.0) return "bg-amber-500/20 text-amber-200 border-amber-500/20";
  if (score >= 2.5) return "bg-orange-500/20 text-orange-200 border-orange-500/20";
  return "bg-red-500/20 text-red-200 border-red-500/20";
}

export default function AnalysisDashboard({ config, streamData }: AnalysisDashboardProps) {
  // 优先使用流式数据，降级到 Mock
  const timelineEvents = (streamData?.timeline as Array<{ date: string; event: string; status: string }> | null)
    ?? generateMockTimeline();
  const competitors = (streamData?.competitor as Array<{ name: string; coverage: string; gap: string }> | null)
    ?? [];
  const matrixData = streamData?.matrix as { hDims: string[]; vDims: string[]; cells: Array<{ entity: string; scores: Array<{ dimension: string; score: number }> }> } | null;
  const insights = (streamData?.insights as string[] | null) ?? [];
  const quality = streamData?.quality as { completeness: number; confidence: number } | null;

  // 矩阵数据
  const heatmap = matrixData ?? generateMockHeatmap(config);

  return (
    <div className="space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-100">📊 分析看板</h2>
          <p className="mt-0.5 text-xs text-slate-300">
            {config.productName} · {config.mode === "lite" ? "精简模式" : "详细模式"}
          </p>
        </div>
        <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-mono text-cyan-300">
          {streamData?.matrix ? "LIVE DATA" : "MOCK DATA"}
        </span>
      </div>

      {/* ===== 时间轴 ===== */}
      <div className="rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-200">⏱ 分析时间轴</h3>
        <div className="relative">
          <div className="absolute left-2 top-2 bottom-2 w-px bg-white/10" />
          <div className="space-y-3 pl-7">
            {timelineEvents.map((evt: { date: string; event: string; status: string }) => (
              <div key={evt.event} className="relative">
                <div
                  className={`absolute -left-5 top-1.5 h-2.5 w-2.5 rounded-full border ${
                    evt.status === "completed"
                      ? "border-green-500/50 bg-green-500/30"
                      : evt.status === "current"
                        ? "border-purple-500/60 bg-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.5)]"
                        : "border-slate-600 bg-slate-700/50"
                  }`}
                />
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-mono text-slate-400">{evt.date}</span>
                  <span
                    className={`text-xs ${
                      evt.status === "completed"
                        ? "text-slate-200"
                        : evt.status === "current"
                          ? "font-semibold text-purple-200"
                          : "text-slate-500"
                    }`}
                  >
                    {evt.event}
                  </span>
                  {evt.status === "current" && (
                    <span className="animate-pulse text-[10px] text-purple-400">● 进行中</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== 对比热力表格 ===== */}
      <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4">
        <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-200">
          🔬 横纵交叉对比矩阵
        </h3>
        <table className="w-full min-w-[480px] border-collapse text-left text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 bg-black/30 px-2 py-2 text-[11px] font-semibold text-slate-300">
                实体 \ 维度
              </th>
              {heatmap.hDims.map((h: string) => (
                <th
                  key={h}
                  className="px-2 py-2 text-center text-[11px] font-semibold text-slate-200"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {heatmap.cells.map((row: { entity: string; scores: Array<{ dimension: string; score: number }> }) => (
              <tr key={row.entity} className="border-t border-white/5">
                <td className="sticky left-0 bg-black/30 px-2 py-2 text-[11px] font-mono text-slate-200">
                  {row.entity}
                </td>
                {row.scores.map((cell) => (
                  <td key={cell.dimension} className="px-1 py-1.5">
                    <div
                      className={`rounded-md border px-2 py-1 text-center text-[11px] font-mono font-semibold ${heatColor(cell.score)}`}
                    >
                      {cell.score.toFixed(1)}
                    </div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[10px] text-slate-400">
          * 评分范围 1.0–5.0，颜色越深表示表现越优
        </p>
      </div>

      {/* ===== 竞品对比（有流式数据时展示） ===== */}
      {competitors.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h3 className="mb-3 text-xs font-semibold tracking-wide text-slate-200">🏢 竞品扫描</h3>
          <div className="grid gap-3 sm:grid-cols-3">
            {competitors.map((c: { name: string; coverage: string; gap: string }) => (
              <div key={c.name} className="rounded-lg border border-white/10 bg-black/20 p-3">
                <div className="text-sm font-semibold text-slate-100">{c.name}</div>
                <div className="mt-1.5 space-y-1 text-[11px]">
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-green-400">✓</span>
                    <span className="text-slate-200">{c.coverage}</span>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-amber-400">△</span>
                    <span className="text-slate-200">{c.gap}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===== 详细版额外卡片 ===== */}
      {(config.mode === "full" || insights.length > 0 || quality) && (
        <div className="grid gap-4 sm:grid-cols-3">
          {/* 洞察卡片 */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-slate-200">💡 关键洞察</div>
            <ul className="mt-2 space-y-1 text-[11px] text-slate-200">
              {insights.length > 0 ? (
                insights.map((ins: string, i: number) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-cyan-400">→</span>
                    <span>{ins}</span>
                  </li>
                ))
              ) : (
                <>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-green-400">+</span>
                    <span>本产品在「用户体验」维度领先竞品 18%</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-amber-400">!</span>
                    <span>「可扩展性」为共同薄弱项，建议优先投入</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-cyan-400">→</span>
                    <span>竞品B 在「性能表现」维度有显著优势</span>
                  </li>
                </>
              )}
            </ul>
          </div>

          {/* 推荐行动 */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-slate-200">🎯 推荐行动</div>
            <ul className="mt-2 space-y-1 text-[11px] text-slate-200">
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-purple-400">1.</span>
                <span>对标竞品B 性能方案，制定优化路线图</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-purple-400">2.</span>
                <span>启动可扩展性架构升级专项</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="mt-0.5 text-purple-400">3.</span>
                <span>每月更新一次横纵对比矩阵</span>
              </li>
            </ul>
          </div>

          {/* 数据质量 */}
          <div className="rounded-xl border border-white/10 bg-black/30 p-4">
            <div className="text-xs font-semibold text-slate-200">📈 数据质量</div>
            <div className="mt-2 space-y-2 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-200">数据完整度</span>
                <span className="font-mono text-green-300">{quality?.completeness ?? 92}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
                  style={{ width: `${quality?.completeness ?? 92}%` }}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-200">置信度</span>
                <span className="font-mono text-amber-300">{quality?.confidence ?? 78}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10">
                <div
                  className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-400"
                  style={{ width: `${quality?.confidence ?? 78}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Mock 时间轴事件（降级方案） */
function generateMockTimeline() {
  const now = new Date();
  return [
    { date: formatDate(now.getTime() - 7 * 86400000), event: "数据采集启动", status: "completed" },
    { date: formatDate(now.getTime() - 5 * 86400000), event: "横轴维度标定完成", status: "completed" },
    { date: formatDate(now.getTime() - 3 * 86400000), event: "纵轴实体数据入库", status: "completed" },
    { date: formatDate(now.getTime() - 1 * 86400000), event: "交叉分析矩阵生成", status: "completed" },
    { date: formatDate(now.getTime()), event: "报告输出", status: "current" },
    { date: formatDate(now.getTime() + 3 * 86400000), event: "自动化复盘推送", status: "pending" },
  ];
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
}
