import type { PrdNavItem } from "@/components/projects/ProjectPrdLayout";

const prdNav = (
  requiredChildren?: readonly { id: string; label: string }[],
): readonly PrdNavItem[] => [
  { id: "top", label: "概览" },
  {
    id: "overview",
    label: "一、产品概述",
    children: [{ id: "ai-boundary", label: "AI 能力边界" }],
  },
  { id: "features", label: "二、功能定义" },
  {
    id: "metrics",
    label: "三、效果展示",
    children: requiredChildren ?? [
      { id: "data-requirements", label: "数据要求" },
      { id: "bad-cases", label: "Bad Case 定义" },
    ],
  },
  { id: "tech", label: "四、技术选择" },
  { id: "lessons", label: "五、学到的经验" },
  { id: "roadmap", label: "六、将来迭代计划" },
];

export const AI_NEWS_PRD_NAV = prdNav();
export const FEYNMAN_PRD_NAV = prdNav();
export const INTERVIEW_OS_PRD_NAV = prdNav();
export const HV_ANALYSIS_PRD_NAV = prdNav();
