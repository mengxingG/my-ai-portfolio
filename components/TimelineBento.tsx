"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FEYNMAN_LEARNING_DEMO_HREF } from "@/lib/feynman-demo-link";

const TIMES = ["05:00", "09:00", "14:00", "15:00", "18:30"] as const;
type TimeId = (typeof TIMES)[number];

const TIME_THEME: Record<TimeId, string> = {
  "05:00": "求职",
  "09:00": "资讯",
  "14:00": "学习",
  "15:00": "面试",
  "18:30": "研究",
};

type FeatureBlock = { title: string; body: string };

type FlowDiagramKind = "ai-news" | "job-engine" | "linear";

type TimelineSectionData = {
  time: TimeId;
  primaryTitle: string;
  tech: readonly string[];
  overview: string;
  flow: string;
  heroImage?: { src: string; alt: string; width: number; height: number };
  features: readonly [FeatureBlock, FeatureBlock, FeatureBlock];
  flowDiagram?: FlowDiagramKind;
  /** linear: 横向流程；ai-news 时忽略 */
  flowSteps?: readonly { label: string; sub?: string }[];
};

const PROSE =
  "text-sm leading-relaxed text-bento-text/90 break-words [overflow-wrap:anywhere]";
const PROSE_TIGHT =
  "text-[13px] leading-relaxed text-bento-text/90 break-words [overflow-wrap:anywhere]";

const TIMELINE_SECTIONS: readonly TimelineSectionData[] = [
  {
    time: "05:00",
    primaryTitle: "Job Engine - 全自动求职与背调引擎",
    tech: [
      "Python",
      "DrissionPage",
      "Playwright",
      "DeepSeek API",
      "Notion API (Headless CMS)",
      "OpenClaw",
      "飞书 WebSocket 网关",
      "Next.js",
    ],
    overview:
      "飞书是整套求职 OS 的**唯一操作台**：`feishu_gateway.py` 维持 WebSocket 长连接，统一接收底部菜单与自然语言。网关按优先级分流——AI 资讯菜单转发 Node、爬虫指令后台串行 subprocess、今日简报读 Notion 回推卡片；只有带公司名的背调句式才唤醒 **OpenClaw**（`job-insight` 技能强制 web_search / web_fetch，结论须附 URL）。岗位数据经 9 大渠道爬虫写入 `openclaw_jobs.json`，由 `openclaw_bridge` 完成 DeepSeek 评分后同步 Notion；背调报告则字段级写入 Notion Block，飞书只推极简摘要。",
    flow:
      "🌟 飞书指令入口 ➔ 意图路由（资讯 / 抓取 / 简报 / 背调）➔ 爬虫+桥接+Notion 或 OpenClaw 溯源+AI 报告 ➔ 飞书卡片回执 ➔ Next.js 看板",
    flowDiagram: "job-engine",
    heroImage: {
      src: "/image/positons.png",
      alt: "Job Engine - 飞书 ChatOps 与岗位简报",
      width: 1200,
      height: 600,
    },
    features: [
      {
        title: "特性 1：飞书 ChatOps — 唯一指令入口",
        body: "手机飞书即可驱动全流程：底部菜单（背调指南 / 抓取官网指南 / 今日简报）+ 文本暗号（「抓取字节跳动」「全面抓取」）。网关 `do_p2_im_message_receive_v1` 先去重 message_id，再最高优先级转发 AI 资讯菜单至 Node，其余进入 `route_intent`。爬虫在 daemon 线程 + subprocess 中串行执行，**不阻塞**长连接；全局互斥锁保证同一时刻仅一个抓取批次，避免 Cron 并发 OOM。",
      },
      {
        title: "特性 2：OpenClaw — 可溯源的深度背调引擎",
        body: "菜单「深度背调」仅展示用法；须自然语言带公司名（如「帮我背调一下 字节跳动」）才后台唤醒 OpenClaw `job-insight` 技能，多轮 web_fetch 抓取新闻/博客/访谈，失败则降级备用新闻源。DeepSeek 将外部情报与 Notion 岗位 JD 合成 Markdown 报告，经 `replace_report_blocks` 锚点写入岗位页；飞书只推送两条核心情报 + Notion 链接，长篇不进聊天窗。",
      },
      {
        title: "特性 3：采集 → 评分 → Notion → 简报闭环",
        body: "9 平台爬虫（DrissionPage / Playwright）产出统一 JSON → `openclaw_bridge` 调用 DeepSeek 五维匹配评分 → `notion_sync` 增量入库。「今日简报」按 Notion **入库时间**筛 24h 新岗位（不限分数），AI 提炼匹配点后推飞书卡片，并提示可用 OpenClaw 背调。Next.js / Electron 看板从 Notion 递归渲染 Block 树，展示岗位与背调长文。",
      },
    ],
  },
  {
    time: "09:00",
    primaryTitle: "AI News Radar · 每日 AI 资讯",
    tech: [
      "Next.js",
      "FastAPI",
      "AI HOT",
      "Notion API",
      "Express",
      "Python",
      "飞书 SDK",
    ],
    overview:
      "与 Job Engine **共用同一飞书门卫** `feishu_gateway.py`：6 条 AI 资讯底部菜单最高优先级命中，POST 本地 Node `:3001` 拉 AI HOT 数据并渲染 interactive 卡片，**绝不误入**背调/爬虫路由。Web 端「精选 / 全部 / AI 日报」三视图：精选与全量走 Notion（Engine A 经 `fetch-news` 入库）；日报直连 AI HOT `/daily` 接口。",
    flow:
      "🌟 Engine A 入库 ➔ Notion / 日报 API ➔ /ai-news 阅读 | 飞书 6 菜单暗号 ➔ Python 门卫 ➔ Node 卡片 ➔ 飞书推送",
    flowDiagram: "ai-news",
    heroImage: {
      src: "/image/news-dashboard.png",
      alt: "AI News Radar 控制台界面",
      width: 1200,
      height: 600,
    },
    features: [
      {
        title: "特性 1：三视图与官方日报",
        body: "精选 / 全部 AI 动态从 Notion 读取（Engine A + Engine B 入库），支持分类筛选与时间轴展示；AI 日报 Tab 调用 AI HOT /dailies 归档与 /daily/{date} 正文，杂志排版，不依赖 Notion 拼日报。",
      },
      {
        title: "特性 2：Engine A 入库与标星闭环",
        body: "lib/cron-fetch-news 调用 ai-news-update /api/news，按北京时区今/昨过滤、URL 去重写入 Notion；npm run fetch-news 本地执行。前端标星写回 Notion，便于筛高价值资讯。",
      },
      {
        title: "特性 3：飞书微服务（Python 门卫 × Node 渲染）",
        body: "feishu_gateway.py 保持唯一 WebSocket 长连接；命中「看今日日报 / 看精选条目 / 模型发布」等 6 条暗号后，POST 本地 feishu-local-api 生成卡片，再推回飞书。start_feishu.sh / stop_feishu.sh 一键 nohup 双引擎，日志分写 node_api.log 与 gateway.log。",
      },
    ],
  },
  {
    time: "14:00",
    primaryTitle: "费曼学习工具 - 深度学习引擎",
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
    primaryTitle: "InterviewOS - AI 面试教练",
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
    time: "18:30",
    primaryTitle: "横纵分析法 (HV-Analysis) - 深度研究引擎",
    tech: [
      "DeepSeek",
      "Tavily",
      "Claude Sonnet",
      "Next.js",
      "Notion API",
      "TransformStream",
      "Puppeteer",
    ],
    overview:
      "数字生命卡兹克提出的横纵分析法深度研究引擎：纵轴沿时间追溯产品/公司/概念的完整生命史，横轴在当下截面与竞品系统性对比，在交汇处产出独到判断。配置研究对象与视角后，AI 自动联网检索、分章流式生成万字级 Markdown 报告，并经由 14 条军规 QA 审计与 Actor-Critic 定向修复闭环，最终一键归档至 Notion。",
    flow:
      "🌟 研究闭环：检索规划 + Tavily 预采集 ➔ 分章流水线（定义 → 纵向 → 横向 → 交汇）➔ 14 条军规 QA 审计 ➔ Auto-Refine 定向修复 ➔ 手动存入 Notion 研报库",
    flowDiagram: "linear",
    flowSteps: [
      { label: "定题", sub: "对象 · 类型 · 竞品" },
      { label: "检索", sub: "Tavily 多源" },
      { label: "纵轴", sub: "时间叙事" },
      { label: "横轴", sub: "竞品对比" },
      { label: "沉淀", sub: "QA · Notion" },
    ],
    heroImage: {
      src: "/images/hv-analysis/hv-page.png",
      alt: "横纵分析法 HV-Analysis 深度研究配置界面",
      width: 1920,
      height: 1080,
    },
    features: [
      {
        title: "特性 1：分章流式流水线（突破 Token 上限）",
        body: "采用 TransformStream 分章顺序生成：一句话定义 → 纵向 6k–15k 字 → 横向 3k–10k 字 → 横纵交汇洞察，单章独立 streamText，总篇幅可达 1–3 万字而不截断。前端实时打字机渲染，DONE 后即刻可导出 PDF。",
      },
      {
        title: "特性 2：Actor-Critic 质检与定向修复",
        body: "报告生成后自动执行 14 条军规 QA（叙事体、竞品深度、套话禁区、万字体量等）。未通过项一键触发 Auto-Refine：将审计意见与初稿提交 Claude，流式重写完整 Markdown 并 re-QA，形成执行者-评估者闭环。",
      },
      {
        title: "特性 3：Notion 研报库与历史舱",
        body: "用户确认后手动「存入 Notion」，元数据（type / Motivation / Competitors / Model / Score / QA_Data）与正文分块写入 hvSearch 数据库。左侧「历史研报舱」按时间倒序拉取，点击即可恢复正文与质检结果。",
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
  "05:00": {
    caseStudyHref: "#",
    startHref: "https://interview.mengxing-ai.it.com/job-analysis?tab=monitor",
  },
  "09:00": {
    caseStudyHref: "/projects/ai-news-radar",
    startHref: "/ai-news",
  },
  "14:00": {
    caseStudyHref: "/projects/feynman-hub",
    startHref: FEYNMAN_LEARNING_DEMO_HREF,
  },
  "15:00": {
    caseStudyHref: "#",
    startHref: "https://interview.mengxing-ai.it.com/",
  },
  "18:30": {
    caseStudyHref: "/tools/hv-analysis",
    startHref: "/tools/hv-analysis",
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

/** 05:00 Job Engine：飞书 ChatOps × OpenClaw × Notion 全链路 */
function JobEngineFlowDiagram() {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bento-muted/70">
        飞书 × OpenClaw · 全链路
      </p>
      <div className="flex justify-center">
        <div className="rounded-2xl border border-violet-500/30 bg-violet-950/25 px-4 py-3 text-center">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-300/95">
            飞书 · ChatOps 入口
          </p>
          <p className="mt-1 text-[11px] text-bento-text/90">菜单 + 自然语言 · WebSocket 长连接</p>
        </div>
      </div>
      <div className="flex justify-center text-bento-muted/50">
        <span className="text-lg leading-none">↓</span>
      </div>
      <div className="rounded-2xl border border-white/15 bg-white/[0.06] p-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">
          feishu_gateway.py · 意图路由
        </p>
        <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
          去重 → AI 资讯优先转发 Node → route_intent（抓取 / 简报 / 背调 / 引导）
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 p-3">
          <p className="text-[10px] font-semibold text-emerald-400/90">路径 A · 岗位采集</p>
          <p className="mt-2 text-[10px] leading-snug text-bento-text/85">
            9 平台爬虫串行 → openclaw_jobs.json → openclaw_bridge → DeepSeek 评分 → Notion
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 ring-1 ring-amber-500/20">
          <p className="text-[10px] font-semibold text-amber-300/95">路径 B · OpenClaw 背调</p>
          <p className="mt-2 text-[10px] leading-snug text-bento-text/85">
            job-insight · web 溯源 → DeepSeek 报告 → Notion Block 锚点写入 → 飞书摘要卡片
          </p>
        </div>
        <div className="rounded-xl border border-cyan-500/25 bg-cyan-950/20 p-3">
          <p className="text-[10px] font-semibold text-cyan-400/90">路径 C · 今日简报</p>
          <p className="mt-2 text-[10px] leading-snug text-bento-text/85">
            Notion 24h 入库筛选 → AI 提炼匹配点 → 飞书早报（可引导 OpenClaw 背调）
          </p>
        </div>
      </div>
      <div className="flex justify-center text-bento-muted/50">
        <span className="text-lg leading-none">↓</span>
      </div>
      <div className="flex justify-center">
        <div className="rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-center text-[11px] text-bento-text/90">
          Next.js / Electron 看板 · Notion Headless CMS 渲染
        </div>
      </div>
    </div>
  );
}

/** 09:00 AI News Radar：Web 阅读 + 飞书双引擎 */
function AiNewsRadarFlowDiagram() {
  return (
    <div className="mt-6 space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bento-muted/70">
        共用 feishu_gateway · Engine A + AI HOT 双源数据流
      </p>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-2">
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">
            Engine A · ai-news-update
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            HN / Polymarket / YouTube → fetch-news 入库
          </p>
        </div>
        <div
          className="hidden shrink-0 items-center justify-center px-1 text-bento-muted/40 sm:flex"
          aria-hidden
        >
          +
        </div>
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">
            AI HOT 日报 / 飞书菜单
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            官方日报 · 分类 · 飞书 6 菜单卡片
          </p>
        </div>
        <div
          className="hidden shrink-0 items-center justify-center px-1 text-bento-muted/40 sm:flex"
          aria-hidden
        >
          →
        </div>
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-white/15 bg-white/[0.06] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-cyan-400/90">
            Notion 精选库
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            今/昨去重 · 标星 · Headless CMS
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2 text-bento-muted/50 sm:gap-3">
        <span className="text-lg leading-none">↓</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {["fetch-news", "/ai-news 三视图", "日报 30 期", "飞书菜单卡片"].map(
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
      <div className="flex flex-wrap items-center justify-center gap-2 text-bento-muted/50 sm:gap-3">
        <span className="text-lg leading-none">↓</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:justify-between sm:gap-2">
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
            Python 飞书门卫
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            WebSocket · 6 条菜单暗号 · 最高优先级
          </p>
        </div>
        <div
          className="hidden shrink-0 items-center justify-center px-1 text-bento-muted/40 sm:flex"
          aria-hidden
        >
          →
        </div>
        <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-emerald-500/25 bg-emerald-950/20 p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
            Node 卡片引擎
          </p>
          <p className="mt-2 text-[11px] leading-snug text-bento-text/90">
            :3001 · aihot-router · interactive 卡片
          </p>
        </div>
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
        {data.flowDiagram === "job-engine" ? <JobEngineFlowDiagram /> : null}
        {data.flowDiagram === "ai-news" ? <AiNewsRadarFlowDiagram /> : null}
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
    case "05:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["05:00"]} />;
    case "09:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["09:00"]} />;
    case "14:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["14:00"]} />;
    case "15:00":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["15:00"]} />;
    case "18:30":
      return <SuperDetailBentoCard data={SECTION_BY_TIME["18:30"]} />;
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
      <div className="relative mx-auto w-full">
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
