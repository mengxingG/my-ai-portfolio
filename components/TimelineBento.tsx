"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FEYNMAN_LEARNING_DEMO_HREF } from "@/lib/feynman-demo-link";

const TIMES = ["09:00", "10:30", "14:00", "15:00", "16:00", "18:30", "20:00"] as const;
type TimeId = (typeof TIMES)[number];

const TIME_THEME: Record<TimeId, string> = {
  "09:00": "资讯",
  "10:30": "日程",
  "14:00": "学习",
  "15:00": "面试",
  "16:00": "面试",
  "18:30": "调研",
  "20:00": "策划",
};

type FeatureBlock = { title: string; body: string };

type FlowDiagramKind = "dual-engine" | "linear";

type TimelineSectionData = {
  time: TimeId;
  primaryTitle: string;
  tech: readonly string[];
  overview: string;
  flow: string;
  heroImage?: { src: string; alt: string; width: number; height: number };
  features: readonly [FeatureBlock, FeatureBlock, FeatureBlock];
  flowDiagram?: FlowDiagramKind;
  /** linear: 横向流程；dual-engine 时忽略 */
  flowSteps?: readonly { label: string; sub?: string }[];
};

const PROSE =
  "text-sm leading-relaxed text-bento-text/90 break-words [overflow-wrap:anywhere]";
const PROSE_TIGHT =
  "text-[13px] leading-relaxed text-bento-text/90 break-words [overflow-wrap:anywhere]";

const TIMELINE_SECTIONS: readonly TimelineSectionData[] = [
  {
    time: "09:00",
    primaryTitle: "每日 AI 资讯模块 (AI News Radar)",
    tech: [
      "Next.js",
      "FastAPI",
      "Coze",
      "Make.com",
      "Notion API",
      "Python",
    ],
    overview:
      "全自动情报雷达，系统采用创新的「异构双引擎」架构：利用 FastAPI 引擎深度挖掘社区高分共识，结合 Coze 节点精准狙击行业领袖一手动态。每天自动清洗、打分并结构化存入私人 Notion 数据库，将信息焦虑转化为高密度的洞察资产。",
    flow:
      "🌟 核心业务流：社区深度解析 (FastAPI) + 领袖动态狙击 (Coze) ➔ 大模型多维去噪与打分 ➔ 统一写入 Notion 数据库 ➔ Next.js 前端实时渲染",
    flowDiagram: "dual-engine",
    heroImage: {
      src: "/image/news-dashboard.png",
      alt: "AI News Radar 控制台界面",
      width: 1200,
      height: 600,
    },
    features: [
      {
        title: "特性 1：异构双引擎（重装运算 + 敏捷狙击）",
        body: "拒绝单一工具的妥协。Coze 绕过 X API 限制，定点狙击大佬快讯；但面对 YouTube 动辄十万字的字幕与 Hacker News 的深水区辩论，其算力与时长极易触顶。因此引入 Python 自建微服务作为「重装引擎」，负责高并发抓取与重度大模型打分运算。Python 挖深共识，Coze 抢占先机，互为表里。",
      },
      {
        title: "特性 2：优雅降级与抗脆弱设计",
        body: "深度定制健壮的开源基座，直面真实世界的网络泥潭。当面临 YouTube 字幕解析受阻或严格反爬限制时，系统自动触发 yt-dlp 底层回退或安全跳过策略。用微服务容错机制吞吐异常，确保每日 AI 简报「局部可降级，全局不宕机」。",
      },
      {
        title: "特性 3：Notion 原生 CMS 闭环",
        body: "告别传统数据库的繁重维护。通过 Make.com 自动化桥接，将 Notion 打造为灵活的 Headless CMS。数据抓取即入库，前端页面秒级同步更新，完美适配 Rapid Validation 理念。",
      },
    ],
  },
  {
    time: "10:30",
    primaryTitle: "日程规划 & Deadline 督促",
    tech: ["Next.js", "Notion API", "Agent", "规划中"],
    overview:
      "把模糊需求压成可验证任务清单，并与日历、Deadline 对齐（规划中的日程 Agent）。会议与交付依赖可视化，减少「以为对齐了其实漏了」的沟通税。",
    flow:
      "🌟 目标形态：自然语言/剪贴板输入 ➔ 结构化任务与依赖 ➔ 日历与 Notion 双向同步 ➔ 按优先级推送可执行拆解",
    flowDiagram: "linear",
    flowSteps: [
      { label: "捕获", sub: "语音 / 剪贴板 / 会议笔记" },
      { label: "结构化", sub: "依赖与优先级" },
      { label: "同步", sub: "日历 · Notion" },
      { label: "督促", sub: "Deadline Agent" },
    ],
    features: [
      {
        title: "特性 1：会议与交付可视化",
        body: "会议与交付依赖可视化，减少「以为对齐了其实漏了」的沟通税。",
      },
      {
        title: "特性 2：Agent 优先级拆解",
        body: "Agent 按优先级拆解子任务，输出顺序与粗估工时。",
      },
      {
        title: "特性 3：个人 OKR 每日锚点",
        body: "与 Notion / 日历联动后，可作为个人 OKR 的每日锚点。",
      },
    ],
  },
  {
    time: "14:00",
    primaryTitle: "费曼学习工具",
    tech: ["Gemini 2.5", "DeepSeek", "Next.js", "Notion API", "Mermaid.js"],
    overview:
      "NotebookLM 风格的双模态学习：左侧材料解析与概念地图，右侧费曼对话与递增追问。学了就忘？先用大白话讲清楚，再用 AI 面试官在压力下验收；掌握度、盲点与复习队列全部写回 Notion。",
    flow:
      "🌟 双模态闭环：PDF / 视频入库 ➔ 多模态解析 + 概念拆解 ➔ 费曼复述 ➔ AI 面试官加压考核 ➔ 盲点进入间隔复习 ➔ Notion 掌握度画像",
    flowDiagram: "linear",
    flowSteps: [
      { label: "材料", sub: "PDF · 视频" },
      { label: "拆解", sub: "概念图 · 大纲" },
      { label: "费曼", sub: "双栏对话" },
      { label: "面试", sub: "DeepSeek 考官" },
      { label: "沉淀", sub: "Notion 双表" },
    ],
    heroImage: {
      src: "/images/feynman-hub/learning-fullview.png",
      alt: "费曼学习工具 双栏学习界面",
      width: 1920,
      height: 1080,
    },
    features: [
      {
        title: "特性 1：学 + 考闭环",
        body: "费曼学习验证理解，AI 面试官检验你能不能在压力下讲清楚。答错的知识点自动进入复习队列。",
      },
      {
        title: "特性 2：Notion 原生集成",
        body: "学习数据直接写回你的 Notion 知识库，不用在另一个 App 里管理笔记。掌握度、复习计划、费曼笔记全部沉淀。",
      },
      {
        title: "特性 3：ADHD 友好设计",
        body: "「只学 5 分钟」一键启动，正计时不倒计时，宠物伴侣只奖励不惩罚。启动门槛低到不会引发抗拒。",
      },
    ],
  },
  {
    time: "15:00",
    primaryTitle: "InterviewOS - 全链路 AI 面试教练",
    tech: ["DeepSeek", "Gemini", "Next.js", "Notion API", "Vercel"],
    overview:
      "全链路 AI 面试教练：左侧 JD 解码与简历对齐，右侧高压追问与五维评分。怕背八股文没用？先用 AI 深度拆解岗位需求，再由硅谷级 AI 面试官进行极限压力测试；核心故事库、评分雷达与复盘报告全部沉淀至 Notion。",
    flow:
      "🌟 全链路闭环：JD 深度解码 ➔ 简历自动化匹配 ➔ 多模态 AI 模拟面试 ➔ 逻辑漏洞高压追问 ➔ 五维雷达评分与 Notion 复盘",
    flowDiagram: "linear",
    flowSteps: [
      { label: "靶心", sub: "JD 解码" },
      { label: "弹药", sub: "故事库匹配" },
      { label: "实战", sub: "模拟面试" },
      { label: "施压", sub: "高压追问" },
      { label: "沉淀", sub: "Notion 双表" },
    ],
    heroImage: {
      src: "/image/interview-prep.png",
      alt: "InterviewOS 全链路 AI 面试教练界面",
      width: 1200,
      height: 600,
    },
    features: [
      {
        title: "特性 1：高压追问与五维评分",
        body: "摒弃无效的八股文问答。AI 基于 Substance/Structure 等五个维度打分，并针对回答漏洞进行真实的高压追问 (Pushback)。",
      },
      {
        title: "特性 2：故事库与 JD 精准匹配",
        body: "简历不盲投。系统自动拆解 JD 核心要求，从你的 Notion 故事库中提取高光素材，提供定制化对齐建议。",
      },
      {
        title: "特性 3：Notion 原生闭环",
        body: "告别「阅后即焚」的聊天框。JD 记录、面试转录稿、AI 深度复盘报告自动写回 Notion，构建长期成长的进度仪表盘。",
      },
    ],
  },
  {
    time: "16:00",
    primaryTitle: "TechSpar 面试教练",
    tech: ["LangGraph", "DeepSeek", "Next.js", "Notion API"],
    overview:
      "TechSpar 模拟真实技术面试：情景出题、多轮追问与工具调用均在 LangGraph 状态机内编排，可观测、可回放。每场结束输出结构化评分与薄弱项标注，写入 Notion；下一场自动携带长期记忆与个性化题单，形成「面—评—练」闭环。",
    flow:
      "🌟 教练过程：岗位画像 / 题库抽样 ➔ 多轮对话 + 工具 ➔ 实时评分维度 ➔ 报告与盲点标签 ➔ Notion 复盘库 ➔ 下次会话预热",
    flowDiagram: "linear",
    flowSteps: [
      { label: "定景", sub: "岗位 · 栈 · 难度" },
      { label: "对练", sub: "LangGraph 多轮" },
      { label: "工具", sub: "检索 · 代码沙箱" },
      { label: "评分", sub: "结构化维度" },
      { label: "复盘", sub: "Notion + 题单" },
    ],
    features: [
      {
        title: "特性 1：结构化评分与盲点标注",
        body: "结构化评分与薄弱项标注，避免「面完就忘」。",
      },
      {
        title: "特性 2：LangGraph 状态机编排",
        body: "多轮对话与工具调用在状态机内编排，保证流程可控、可观测、可回放。",
      },
      {
        title: "特性 3：长期记忆复盘",
        body: "跨场次沉淀问答要点与薄弱项，为下一轮模拟提供上下文与个性化题单。",
      },
    ],
  },
  {
    time: "18:30",
    primaryTitle: "AI 产品调研学习",
    tech: ["Perplexity", "Hacker News", "X", "Notion API", "Deep Research"],
    overview:
      "围绕目标赛道进行系统化调研：追踪产品迭代、竞品能力边界、用户吐槽与行业机会点。把碎片信息转成可执行洞察，服务后续产品策略与需求优先级判断。",
    flow:
      "🌟 调研闭环：主题定义与检索策略 ➔ 多源信号采集（社区/媒体/产品更新）➔ 观点聚类与证据交叉验证 ➔ 洞察沉淀到 Notion ➔ 输出下一步实验假设",
    flowDiagram: "linear",
    flowSteps: [
      { label: "定题", sub: "目标市场 · 关键问题" },
      { label: "采集", sub: "社区 · 媒体 · 动态" },
      { label: "聚类", sub: "机会点 · 风险点" },
      { label: "验证", sub: "证据交叉检查" },
      { label: "沉淀", sub: "Notion 调研库" },
    ],
    features: [
      {
        title: "特性 1：多源调研信号融合",
        body: "把论坛讨论、产品更新日志、用户反馈和行业文章统一纳入调研视角，避免单一信息源导致偏差。",
      },
      {
        title: "特性 2：证据链式洞察沉淀",
        body: "每条结论都保留来源链接和置信度标注，方便后续复盘与团队沟通，降低“拍脑袋决策”风险。",
      },
      {
        title: "特性 3：直连产品实验假设",
        body: "调研不止于阅读，输出可执行假设与优先级建议，直接进入下一轮需求验证与原型实验。",
      },
    ],
  },
  {
    time: "20:00",
    primaryTitle: "Superpowers · Agentic Skills",
    tech: ["Claude", "Cursor", "Next.js", "Notion API"],
    overview:
      "晚间用 Superpowers 把脑暴落成用户故事与里程碑，再把可复用套路沉淀为 Agentic Skills：与 Claude / Cursor 工作流对齐，从 Skill 定义、工具描述到仓库内 `.cursor/rules` 一体贯通，缩短「想法 → 可运行 PR」的路径。",
    flow:
      "🌟 Agentic 工作流：头脑风暴落盘 ➔ 里程碑与实验假设 ➔ Skill 规格与工具链 ➔ Cursor / Claude 侧加载 ➔ 复用到下一个功能切片",
    flowDiagram: "linear",
    flowSteps: [
      { label: "脑暴", sub: "Superpowers" },
      { label: "拆解", sub: "里程碑 · 实验" },
      { label: "沉淀", sub: "Skill 规格" },
      { label: "挂载", sub: "Cursor · Claude" },
      { label: "交付", sub: "PR · 回归" },
    ],
    features: [
      {
        title: "特性 1：Superpowers 大纲与验证",
        body: "Superpowers 侧重大纲与假设验证，适合头脑风暴后落盘。",
      },
      {
        title: "特性 2：Agentic Skills 工作流对齐",
        body: "Agentic Skills 与 Claude / Cursor 工作流对齐，减少重复造轮子。",
      },
      {
        title: "特性 3：可执行收敛",
        body: "把一天的输入收敛成「明天能开干」的条目。",
      },
    ],
  },
];

const SECTION_BY_TIME = Object.fromEntries(
  TIMELINE_SECTIONS.map((s) => [s.time, s])
) as Record<TimeId, TimelineSectionData>;

/** 左侧卡片底部：Case Study / 开始使用（09、14 为已上线项目，其余为站内占位） */
const TIMELINE_NAV_LINKS: Record<
  TimeId,
  { caseStudyHref: string; startHref: string }
> = {
  "09:00": {
    caseStudyHref: "/projects/ai-news-radar",
    startHref: "/ai-news",
  },
  "10:30": {
    caseStudyHref: "/projects/featured",
    startHref: "/#featured",
  },
  "14:00": {
    caseStudyHref: "/projects/feynman-hub",
    startHref: FEYNMAN_LEARNING_DEMO_HREF,
  },
  "15:00": {
    caseStudyHref: "#",
    startHref: "https://interview.mengxing-ai.it.com/",
  },
  "16:00": {
    caseStudyHref: "/projects/featured",
    startHref: "/#featured",
  },
  "18:30": {
    caseStudyHref: "/projects/featured",
    startHref: "/#featured",
  },
  "20:00": {
    caseStudyHref: "/projects/featured",
    startHref: "/#featured",
  },
};

const navLinkBtnClass =
  "inline-flex min-h-[2rem] flex-1 items-center justify-center rounded-lg border px-2 py-1.5 text-center text-[10px] font-medium leading-tight transition-colors sm:text-[11px]";

const EASE_STANDARD = [0.22, 1, 0.36, 1] as const;
const DUR_FAST = 0.28;
const DUR_REVEAL = 0.32;

function TechPill({ label }: { label: string }) {
  return (
    <span className="inline-flex rounded-full border border-white/[0.12] bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium tracking-wide text-bento-muted">
      {label}
    </span>
  );
}

/** 09:00 异构双引擎 + 合流示意 */
function DualEngineFlowDiagram() {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bento-muted/70">
        异构双引擎 · 数据合流
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-2">
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B5CF6]">
            FastAPI 重装引擎
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            HN / YouTube 字幕 · 重计算 · 多维打分
          </p>
        </div>
        <div
          className="hidden shrink-0 items-center justify-center px-1 text-bento-muted/40 sm:flex"
          aria-hidden
        >
          +
        </div>
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#8B5CF6]">
            Coze 敏捷通道
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            X / 领袖动态 · 搜索节点 · 低延迟触达
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-bento-muted/50 sm:gap-3">
        <span className="text-lg leading-none">↓</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["DeepSeek 清洗", "Make 调度", "Notion 入库", "Next 渲染"].map(
          (label) => (
            <div
              key={label}
              className="rounded-xl border border-white/[0.14] bg-white/[0.06] px-2 py-2 text-center text-[10px] font-medium leading-tight text-bento-text/90"
            >
              {label}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function LinearFlowSteps({
  steps,
}: {
  steps: readonly { label: string; sub?: string }[];
}) {
  return (
    <div className="mt-6 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <div className="flex min-w-min items-stretch gap-2">
        {steps.map((s, i) => (
          <div key={`${s.label}-${i}`} className="flex items-stretch">
            <div className="flex w-[4.75rem] shrink-0 flex-col justify-center rounded-xl border border-white/15 bg-white/[0.06] px-2 py-2.5 text-center sm:w-[5.5rem]">
              <p className="text-[11px] font-semibold leading-tight text-bento-text">
                {s.label}
              </p>
              {s.sub ? (
                <p className="mt-1 text-[9px] leading-snug text-bento-text/85">
                  {s.sub}
                </p>
              ) : null}
            </div>
            {i < steps.length - 1 ? (
              <div
                className="flex w-4 shrink-0 items-center justify-center text-bento-muted/35"
                aria-hidden
              >
                →
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function HeroVisual({
  heroImage,
  label,
}: {
  heroImage?: TimelineSectionData["heroImage"];
  label: string;
}) {
  if (heroImage) {
    return (
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_12px_40px_rgba(139,92,246,0.1)]">
        <Image
          src={heroImage.src}
          alt={heroImage.alt}
          width={heroImage.width}
          height={heroImage.height}
          className="h-auto w-full max-w-full object-contain"
          sizes="(max-width: 1024px) 100vw, min(960px, 68vw)"
        />
      </div>
    );
  }
  return (
    <div className="flex min-h-[200px] w-full items-center justify-center rounded-2xl border border-dashed border-white/12 bg-gradient-to-br from-[#8B5CF6]/[0.06] via-transparent to-transparent px-4 py-10 text-center">
      <p className="max-w-xs text-[12px] leading-relaxed text-bento-text/80">
        架构 / 产品预览占位 · {label}
      </p>
    </div>
  );
}

function SuperDetailBentoCard({ data }: { data: TimelineSectionData }) {
  return (
    <div className="bento-card flex min-h-[min(600px,70vh)] w-full flex-col sm:min-h-[600px]">
      <div className="min-h-0 flex-1 px-8 pb-8 pt-8 sm:px-10 sm:pt-10">
        <p className={PROSE}>{data.overview}</p>
        <p className={`mt-3 ${PROSE}`}>{data.flow}</p>
        <div className="mt-5 flex flex-wrap gap-1.5">
          {data.tech.map((t) => (
            <TechPill key={`${data.time}-detail-${t}`} label={t} />
          ))}
        </div>
        {data.flowDiagram === "dual-engine" ? <DualEngineFlowDiagram /> : null}
        {data.flowDiagram === "linear" && data.flowSteps?.length ? (
          <LinearFlowSteps steps={data.flowSteps} />
        ) : null}
        <div className="mt-8 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
          <table className="w-full border-collapse">
            <tbody>
              {data.features.map((f, idx) => (
                <tr
                  key={f.title}
                  className={idx < data.features.length - 1 ? "border-b border-white/[0.08]" : ""}
                >
                  <th className="w-[38%] px-4 py-3 text-left align-top text-[13px] font-semibold leading-snug text-bento-text sm:px-5 sm:text-sm">
                    {f.title}
                  </th>
                  <td className="px-4 py-3 align-top sm:px-5">
                    <p className={PROSE_TIGHT}>{f.body}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-8 mb-8">
          <HeroVisual heroImage={data.heroImage} label={TIME_THEME[data.time]} />
        </div>
      </div>
    </div>
  );
}

/** 左侧导航：时间与标题 + 底部 Case Study / 开始使用 */
function NavigatorBriefCard({
  data,
  active,
  onSelect,
}: {
  data: TimelineSectionData;
  active: boolean;
  onSelect: () => void;
}) {
  const theme = TIME_THEME[data.time];
  const { caseStudyHref, startHref } = TIMELINE_NAV_LINKS[data.time];
  const linkIdle =
    "border-white/[0.08] bg-white/[0.03] text-bento-muted/85 hover:border-white/15 hover:bg-white/[0.06] hover:text-bento-text";
  const linkActive =
    "border-[#8B5CF6]/35 bg-[#8B5CF6]/[0.12] text-bento-text hover:border-[#8B5CF6]/45 hover:bg-[#8B5CF6]/[0.16]";

  return (
    <div
      role="group"
      className={[
        "w-full rounded-2xl border px-3.5 py-3 transition-[background-color,border-color,box-shadow] duration-300 sm:px-4 sm:py-3.5",
        active
          ? "border-bento-glow/80 bg-white/[0.07] shadow-[0_0_16px_rgba(139,92,246,0.12)]"
          : "border-transparent bg-white/[0.03] hover:border-white/[0.08] hover:bg-white/[0.04]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        aria-label={`${data.time} ${theme}：${data.primaryTitle}`}
        className="w-full text-left"
      >
        <p
          className={[
            "font-mono text-[11px] tabular-nums tracking-tight sm:text-xs",
            active ? "text-bento-text" : "text-bento-text/75",
          ].join(" ")}
        >
          {data.time}
          <span className="mx-1.5 text-bento-muted/35">·</span>
          <span className="font-sans text-[10px] font-medium uppercase tracking-wider sm:text-[11px]">
            {theme}
          </span>
        </p>
        <h3
          className={[
            "mt-1.5 text-left text-[13px] font-semibold leading-snug tracking-tight sm:text-sm",
            active ? "text-bento-text" : "text-bento-text/80",
          ].join(" ")}
        >
          {data.primaryTitle}
        </h3>
      </button>
      <div className="mt-2.5 flex gap-2">
        {caseStudyHref.startsWith("http") ? (
          <a
            href={caseStudyHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${navLinkBtnClass} ${active ? linkActive : linkIdle}`}
          >
            Case Study
          </a>
        ) : (
          <Link
            href={caseStudyHref}
            className={`${navLinkBtnClass} ${active ? linkActive : linkIdle}`}
          >
            Case Study
          </Link>
        )}
        {startHref.startsWith("http") ? (
          <a
            href={startHref}
            target="_blank"
            rel="noopener noreferrer"
            className={`${navLinkBtnClass} ${active ? linkActive : linkIdle}`}
          >
            开始使用
          </a>
        ) : (
          <Link
            href={startHref}
            className={`${navLinkBtnClass} ${active ? linkActive : linkIdle}`}
          >
            开始使用
          </Link>
        )}
      </div>
    </div>
  );
}

/**
 * 右侧放映机：严格按 activeTime 单路渲染，避免条件链合并或陈旧 state 叠层。
 */
function renderViewerForTime(time: TimeId): ReactNode {
  switch (time) {
    case "09:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["09:00"]} />;
    case "10:30":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["10:30"]} />;
    case "14:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["14:00"]} />;
    case "15:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["15:00"]} />;
    case "16:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["16:00"]} />;
    case "18:30":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["18:30"]} />;
    case "20:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["20:00"]} />;
  }
}

type TimelineBentoProps = {
  className?: string;
};

/**
 * 左：时间轴 + 轻量导航 · 右：黏性详情（switch 严格单路渲染）；
 * 3 秒自动轮播；点击左侧后锁定，失焦后恢复轮播。
 */
export function TimelineBento({ className = "" }: TimelineBentoProps) {
  const [activeTime, setActiveTime] = useState<TimeId>("09:00");
  const [isNavLocked, setIsNavLocked] = useState(false);

  useEffect(() => {
    if (isNavLocked) return;
    const id = window.setInterval(() => {
      setActiveTime((prev) => {
        const idx = TIMES.indexOf(prev);
        return TIMES[(idx + 1) % TIMES.length];
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [isNavLocked]);

  return (
    <div className={`w-full ${className.trim()}`}>
      <div className="relative mx-auto max-w-7xl">
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:gap-10 xl:gap-12">
          {/* 左侧：中轴 + 导航（1/3） */}
          <div className="flex min-w-0 w-full flex-col gap-3 sm:gap-4 lg:sticky lg:top-32 lg:z-10 lg:h-[calc(100dvh-16rem)] lg:w-1/3 lg:max-h-[calc(100dvh-16rem)] lg:flex-shrink-0">
            <div className="relative flex min-h-0 flex-1 gap-3 lg:overflow-y-auto lg:pr-1">
              {/* 垂直微光主轴 */}
              <div
                className="pointer-events-none absolute bottom-2 left-[0.9rem] top-2 w-px bg-gradient-to-b from-[#8B5CF6]/55 via-[#8B5CF6]/20 to-white/[0.08]"
                style={{
                  boxShadow:
                    "0 0 12px rgba(139, 92, 246, 0.25), 0 0 24px rgba(139, 92, 246, 0.08)",
                }}
                aria-hidden
              />

              {/* 单列：节点与时间轴对齐，卡片高密度堆叠便于首屏全览 */}
              <div
                className="flex min-w-0 flex-1 flex-col gap-2.5"
                onBlurCapture={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setIsNavLocked(false);
                  }
                }}
              >
                {TIMES.map((time) => {
                  const data = SECTION_BY_TIME[time];
                  const active = activeTime === time;
                  return (
                    <div key={time} className="relative flex gap-2.5">
                      <div className="relative flex w-7 shrink-0 justify-center pt-[1.125rem] sm:w-8">
                        <motion.span
                          className="relative z-[1] block h-2 w-2 rounded-full border-2 bg-bento-bg sm:h-2.5 sm:w-2.5"
                          animate={{
                            scale: active ? [1, 1.52, 1.38] : 1,
                            borderColor: active
                              ? "rgba(167, 139, 250, 1)"
                              : "rgba(255,255,255,0.2)",
                            boxShadow: active
                              ? [
                                  "0 0 0 2px rgba(139, 92, 246, 0.22), 0 0 10px rgba(139, 92, 246, 0.35)",
                                  "0 0 0 4px rgba(139, 92, 246, 0.38), 0 0 18px rgba(139, 92, 246, 0.6)",
                                  "0 0 0 3px rgba(139, 92, 246, 0.3), 0 0 14px rgba(139, 92, 246, 0.5)",
                                ]
                              : "0 0 0 0 rgba(139, 92, 246, 0)",
                          }}
                          transition={{
                            duration: active ? 1.8 : DUR_FAST,
                            ease: EASE_STANDARD,
                            repeat: active ? Infinity : 0,
                          }}
                          aria-hidden
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <NavigatorBriefCard
                          data={data}
                          active={active}
                          onSelect={() => {
                            setActiveTime(time);
                            setIsNavLocked(true);
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：黏性放映机（2/3），内部滚动、隐藏滚动条 */}
          <div className="flex min-h-0 w-full flex-col lg:sticky lg:top-32 lg:z-10 lg:h-[calc(100dvh-16rem)] lg:w-2/3 lg:max-w-none lg:flex-1">
            <div
              className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain max-h-[calc(100vh-6rem)] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:h-full lg:max-h-full lg:pl-1 xl:pl-3"
              aria-live="polite"
              aria-atomic="true"
            >
              <div className="relative w-full">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={activeTime}
                    initial={{ opacity: 0, y: 28 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -28 }}
                    transition={{ duration: DUR_REVEAL, ease: EASE_STANDARD }}
                    className="w-full"
                  >
                    {renderViewerForTime(activeTime)}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
