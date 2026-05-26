/** 与 /api/hv-qa 响应对齐的前端类型 */

export type HvQaItem = {
  id: string;
  title: string;
  pass: boolean;
  reason: string;
};

export type HvQaResult = {
  overallScore: number;
  items: HvQaItem[];
  meta?: {
    modelId: string;
    reportChars: number;
    passCount: number;
    parseFallback?: string;
    qaFailed?: boolean;
  };
};

export type QaInspectorStatus = "idle" | "loading" | "done" | "error";

export function getQaScoreVerdict(score: number): {
  label: string;
  tone: "excellent" | "good" | "fair" | "poor";
} {
  if (score >= 90) return { label: "优秀 — 符合横纵分析法交付标准", tone: "excellent" };
  if (score >= 75) return { label: "良好 — 少量条目建议修订后发布", tone: "good" };
  if (score >= 60) return { label: "待改进 — 存在明显方法论缺口", tone: "fair" };
  return { label: "需重写 — 多项军规未达标", tone: "poor" };
}
