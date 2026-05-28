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
    "AI HOT API",
    "Notion API",
    "Express",
    "Python",
    "飞书 SDK",
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
          AI News Radar —— AI HOT 三视图 + 飞书菜单卡片引擎
        </h3>
        <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wide text-bento-muted">
          FEATURED
        </span>
      </div>

      <section className="min-w-0">
        <h4 className="text-sm font-semibold text-bento-text">🚀 项目概述</h4>
        <p className={`mt-2 ${proseMuted}`}>
          对接 AI HOT 官方 API 的情报雷达：Web 端「精选 / 全部 / AI 日报」三视图，精选与全量走 Notion
          CMS，日报固定拉取最近 30 期官方杂志排版。飞书底部 6 条菜单暗号由 Job Engine 长连接门卫转发本地 Node
          卡片引擎，推送 interactive 消息，支持 nohup 24 小时值守。
        </p>
        <p className={`mt-3 ${proseMuted}`}>
          🌟 核心流：AI HOT 精选入库 (fetch-news) ➔ Notion ➔ /ai-news | 日报直连 API | 飞书暗号 ➔ Python
          门卫 ➔ Node :3001 ➔ 飞书卡片
        </p>
      </section>

      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-2.5 lg:gap-3">
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            特性 1：AI HOT 三视图与官方日报
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            精选 / 全部从 Notion 渲染；AI 日报 Tab 调用官方 /dailies 与 /daily/日期 接口，五大版块杂志排版，与
            AI HOT 产品体验一致，不再用 Notion 条目拼日报。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            特性 2：精选入库与标星
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            npm run fetch-news 拉取 AI HOT 精选（今/昨、URL 去重）写入 Notion；前端支持标星写回，便于筛选高价值资讯。无
            Vercel Cron，适合本地或自建调度。
          </div>
        </div>
        <div className={`min-w-0 ${featureCardClass}`}>
          <div className="text-xs font-semibold leading-snug text-bento-text break-words">
            特性 3：飞书 Python 门卫 × Node 渲染
          </div>
          <div className={`mt-2 ${proseMutedTight}`}>
            与 Job Engine 共用 feishu_gateway.py：6 条菜单在消息入口最高优先级转发 feishu-local-api，不进入 OpenClaw
            背调/爬虫 route_intent。tools/aihot-router 映射英文 category（ai-models / ai-products / industry）。start_feishu.sh
            一键 nohup Python 门卫 + Node 卡片引擎。
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
          AI HOT API · Notion 精选库 · /ai-news 三视图 · 飞书菜单卡片双引擎
        </p>
        <p className={proseCaptionTiny}>
          Next.js · AI HOT API · feishu_gateway · Node :3001 · Notion API
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
