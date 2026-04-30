"use client";

import Image from "next/image";
import Link from "next/link";
import { FEYNMAN_LEARNING_DEMO_HREF } from "@/lib/feynman-demo-link";

const featureCardClass =
  "flex h-full flex-col rounded-xl border border-white/10 bg-white/[0.04] p-3 md:p-3.5";

const figureClass =
  "w-full overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] shadow-[0_12px_36px_rgba(0,0,0,0.28)]";

const titleClass =
  "text-xl font-bold leading-tight tracking-tight text-bento-text md:text-2xl";

const proseMuted =
  "text-sm leading-relaxed text-bento-muted break-words [overflow-wrap:anywhere]";

const proseMutedTight =
  "text-xs leading-[1.65] text-bento-muted break-words [overflow-wrap:anywhere]";

const proseCaption =
  "text-xs leading-relaxed text-bento-muted break-words [overflow-wrap:anywhere]";

const proseCaptionTiny =
  "text-[11px] leading-relaxed text-bento-muted break-words [overflow-wrap:anywhere]";

/** 弹窗内详情：AI News Radar — 单栏全宽，正文自动换行 */
export function NewsRadarModalBody() {
  const techItems = [
    "Next.js",
    "FastAPI",
    "Coze",
    "Make.com",
    "Notion API",
    "Python",
  ] as const;

  return (
    <div className="min-w-0 max-w-full space-y-5 text-left lg:space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/projects/ai-news-radar"
          className="glow-btn glow-btn--primary glow-btn--resume inline-flex text-sm"
        >
          查看 Case Study →
        </Link>
        <Link href="/ai-news" className="glow-btn glow-btn--secondary inline-flex text-sm">
          体验 Demo →
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3
          id="workflow-modal-title"
          className={`min-w-0 max-w-full flex-1 ${titleClass} break-words [overflow-wrap:anywhere]`}
          style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
        >
          AI News Radar —— 双引擎驱动的自动化情报聚合平台
        </h3>
        <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-bento-muted">
          FEATURED
        </span>
      </div>

      <section className="min-w-0">
        <h4 className="text-sm font-semibold text-bento-text">🚀 项目概述</h4>
        <p className={`mt-2 ${proseMuted}`}>
         全自动情报雷达系统，采用创新的「异构双引擎」架构：利用
          FastAPI 引擎深度挖掘社区高分共识，结合 Coze 节点精准狙击行业领袖一手动态。每天自动清洗、打分并结构化存入私人
          Notion 数据库，将信息焦虑转化为高密度的洞察资产。
        </p>
        <p className={`mt-3 ${proseMuted}`}>
          🌟 核心业务流：社区深度解析 (FastAPI 9:30 AM) + 领袖动态狙击 (Coze 10:42 AM) ➔
          大模型多维去噪与打分 ➔ 统一写入 Notion 数据库 ➔ Next.js 前端实时渲染
        </p>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2.5 lg:gap-3">
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            特性 1：异构双引擎（重装运算 + 敏捷狙击）
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            拒绝单一工具的妥协。Coze 绕过 X API 限制，定点狙击大佬快讯；但面对 YouTube 动辄十万字的字幕与
            Hacker News 的深水区辩论，其算力与时长极易触顶。因此引入 Python 自建微服务作为「重装引擎」，负责高并发抓取与重度大模型打分运算。Python
            挖深共识，Coze 抢占先机，互为表里。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            特性 2：优雅降级与抗脆弱设计
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            深度定制健壮的开源基座，直面真实世界的网络泥潭。当面临 YouTube 字幕解析受阻或严格反爬限制时，系统自动触发
            yt-dlp 底层回退或安全跳过策略。用微服务容错机制吞吐异常，确保每日 AI 简报「局部可降级，全局不宕机」。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            特性 3：Notion 原生 CMS 闭环
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            告别传统数据库的繁重维护。通过 Make.com 自动化桥接，将 Notion 打造为灵活的 Headless
            CMS。数据抓取即入库，前端页面秒级同步更新，完美适配 Rapid Validation 理念。
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-3 border-t border-white/10 pt-5">
        <figure className={figureClass}>
          <Image
            src="/image/news-dashboard.png"
            alt="AI News Radar界面"
            width={1200}
            height={600}
            className="h-auto w-full max-w-full object-contain"
            sizes="(max-width: 1280px) 100vw, min(720px, 70vw)"
          />
        </figure>
        <p className={proseCaption}>
          自动化流转全貌：Make.com 调度台 · FastAPI 云端引擎 · Notion 数据库实时推流
        </p>
        <p className={proseCaptionTiny}>
          Next.js · FastAPI · Coze · Make.com · Notion API · Python
        </p>
        <div className="flex flex-wrap gap-1.5">
          {techItems.map((t) => (
            <span key={`anr-modal-${t}`} className="tech-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 弹窗内详情：InterviewOS */
export function InterviewOSModalBody() {
  const techItems = [
    "DeepSeek",
    "Gemini",
    "Next.js",
    "Notion API",
    "Vercel",
  ] as const;

  return (
    <div className="min-w-0 max-w-full space-y-5 text-left lg:space-y-6">
      <div className="flex flex-wrap gap-2">
        <a
          href="https://interview.mengxing-ai.it.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="glow-btn glow-btn--primary glow-btn--resume inline-flex text-sm"
        >
          在线体验 →
        </a>
        <Link href="/projects/interview-os" className="glow-btn glow-btn--secondary inline-flex text-sm">
          Case Study (架构设计)
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3
          id="workflow-modal-title"
          className={`min-w-0 max-w-full flex-1 ${titleClass} break-words [overflow-wrap:anywhere]`}
          style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
        >
          InterviewOS - 全链路 AI 面试教练
        </h3>
        <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-bento-muted">
          FEATURED
        </span>
      </div>

      <section className="min-w-0">
        <h4 className="text-sm font-semibold text-bento-text">🚀 项目概述</h4>
        <p className={`mt-2 ${proseMuted}`}>
          全链路 AI 面试教练：左侧 JD 解码与简历对齐，右侧高压追问与五维评分。
          用 AI 深度拆解岗位需求，再由 AI 面试官进行极限压力测试；核心故事库、评分雷达与复盘报告全部沉淀至 Notion。
        </p>
        <p className={`mt-3 ${proseMuted}`}>
          🌟 全链路闭环：JD 深度解码 ➔ 简历自动化匹配 ➔ 多模态 AI 模拟面试 ➔ 逻辑漏洞高压追问 ➔ 五维雷达评分与 Notion 复盘
        </p>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2.5 lg:gap-3">
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            高压追问与五维评分
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            摒弃无效的八股文问答。AI 基于 Substance/Structure 等五个维度打分，并针对回答漏洞进行真实的高压追问 (Pushback)。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            故事库与 JD 精准匹配
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            简历不盲投。系统自动拆解 JD 核心要求，从你的 Notion 故事库中提取高光素材，提供定制化对齐建议。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            Notion 原生闭环
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            告别「阅后即焚」的聊天框。JD 记录、面试转录稿、AI 深度复盘报告自动写回 Notion，构建长期成长的进度仪表盘。
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-3 border-t border-white/10 pt-5">
        <figure className={figureClass}>
          <Image
            src="/images/interview-prep.png"
            alt="InterviewOS 全链路 AI 面试教练界面"
            width={1200}
            height={600}
            className="h-auto w-full max-w-full object-contain"
            sizes="(max-width: 1280px) 100vw, min(720px, 70vw)"
          />
        </figure>
        <p className={proseCaption}>InterviewOS 全链路 AI 面试教练界面</p>
        <p className={proseCaptionTiny}>
          DeepSeek · Gemini · Next.js · Notion API · Vercel
        </p>
        <div className="flex flex-wrap gap-1.5">
          {techItems.map((t) => (
            <span key={`ios-modal-${t}`} className="tech-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 弹窗内详情：费曼学习工具 */
export function FeynmanModalBody() {
  const techItems = [
    "Gemini 2.5",
    "DeepSeek",
    "Next.js",
    "Notion API",
    "Mermaid.js",
  ] as const;

  return (
    <div className="min-w-0 max-w-full space-y-5 text-left lg:space-y-6">
      <div className="flex flex-wrap gap-2">
        <Link
          href="/projects/feynman-hub"
          className="glow-btn glow-btn--primary glow-btn--resume inline-flex text-sm"
        >
          查看 Case Study →
        </Link>
        <Link
          href={FEYNMAN_LEARNING_DEMO_HREF}
          className="glow-btn glow-btn--secondary inline-flex text-sm"
        >
          体验 Demo →
        </Link>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <h3
          id="workflow-modal-title"
          className={`min-w-0 max-w-full flex-1 ${titleClass} break-words [overflow-wrap:anywhere]`}
          style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
        >
          费曼学习工具 —— NotebookLM 风格的双模态学习系统
        </h3>
        <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-bento-muted">
          FEATURED
        </span>
      </div>

      <section className="min-w-0">
        <h4 className="text-sm font-semibold text-bento-text">🚀 项目概述</h4>
        <p className={`mt-2 ${proseMuted}`}>
          学了就忘？面试答不上来？这个工具让你用费曼技巧真正理解知识，再用 AI 面试官检验你是不是真懂了。
          学习数据自动沉淀到 Notion，薄弱环节精准复习。宠物陪伴，学习过程不枯燥。
        </p>
        <p className={`mt-3 ${proseMuted}`}>
          🌟 上传 PDF/视频 → AI 用大白话帮你拆解核心概念 → 你用费曼技巧复述检验理解 → AI
          面试官递增难度考核 → 评分报告精准标出知识盲点 → 薄弱环节自动进入间隔复习
        </p>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2.5 lg:gap-3">
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            学 + 考 闭环
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            费曼学习验证理解，AI 面试官检验你能不能在压力下讲清楚。答错的知识点自动进入复习队列。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            Notion 原生集成
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            学习数据直接写回你的 Notion 知识库，不用在另一个 App 里管理笔记。掌握度、复习计划、费曼笔记全部沉淀。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            ADHD 友好设计
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            「只学 5 分钟」一键启动，正计时不倒计时，宠物伴侣只奖励不惩罚。启动门槛低到不会引发抗拒。
          </div>
        </div>
      </div>

      <div className="min-w-0 space-y-3 border-t border-white/10 pt-5">
        <figure className={figureClass}>
          <Image
            src="/images/feynman-hub/learning-fullview.png"
            alt="费曼学习工具 学习页面：双栏布局与费曼对话"
            width={1920}
            height={1080}
            className="h-auto w-full max-w-full object-contain"
            sizes="(max-width: 1280px) 100vw, min(720px, 70vw)"
          />
        </figure>
        <p className={proseCaption}>Learning 双栏布局全貌</p>
        <p className={proseCaptionTiny}>
          6 个 API 路由 · 双模型协作 · Notion 双表数据流 · 两周独立开发
        </p>
        <div className="flex flex-wrap gap-1.5">
          {techItems.map((t) => (
            <span key={`fh-modal-${t}`} className="tech-tag">
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
