"use client";

import { motion, useReducedMotion } from "framer-motion";
import WallOfLoveBackground from "@/components/WallOfLoveBackground";

const DISPLAY_FONT =
  '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' as const;
const BODY_FONT = '"Geist", "Inter", "SF Pro Text", system-ui, sans-serif' as const;

const PILLARS = [
  {
    id: "finance",
    title: "金融 AI 产品 0→1",
    body: "花旗 Pre-Trade 合规智能助手与法规知识库：L0/L1 混合架构、Semantic Cache 月省约 $120K、Golden Dataset 上线门槛（F1>90%）。设计 fail-open 与 Override 机制，P2 试点误报率降至 10%–15%，采纳率 65%–70%。",
    tone: "violet" as const,
  },
  {
    id: "agent",
    title: "Agent 编排与 ChatOps",
    body: "Job Engine 以 OpenClaw 强制 web_search / web_fetch 做可溯源背调；飞书网关分流资讯、采集、简报与背调指令。结合 Coze 工作流、多模型路由（Qwen / Claude / DeepSeek / Gemini）与 Tavily 联网检索，5 款产品均已上线可体验。",
    tone: "cyan" as const,
  },
  {
    id: "vibe",
    title: "Vibe Coding 全链路交付",
    body: "用 Cursor / Claude Code 独立完成 PRD→UI→前后端→部署。Next.js + Python + Notion 数据中台，在 Serverless 约束下设计流式分章与 ChatOps 体验，把复杂想法快速变成可运行、可验证、可迭代的 AI 产品。",
    tone: "emerald" as const,
  },
] as const;

const STACK_GROUPS = [
  {
    label: "AI & Agent",
    tone: "purple" as const,
    items: ["OpenClaw", "Coze", "DeepSeek", "Claude", "Qwen", "Gemini", "Tavily"],
  },
  {
    label: "Product & Delivery",
    tone: "blue" as const,
    items: ["Cursor", "Claude Code", "Vercel AI SDK", "Next.js", "Python", "Node.js"],
  },
  {
    label: "Platform",
    tone: "cyan" as const,
    items: ["Notion", "飞书", "Vercel"],
  },
] as const;

const PILLAR_CARD_CLASS: Record<(typeof PILLARS)[number]["tone"], string> = {
  violet: "about-pillar-card about-pillar-card--violet",
  cyan: "about-pillar-card about-pillar-card--cyan",
  emerald: "about-pillar-card about-pillar-card--emerald",
};

const PILLAR_TITLE_CLASS: Record<(typeof PILLARS)[number]["tone"], string> = {
  violet: "text-violet-200",
  cyan: "text-cyan-200",
  emerald: "text-emerald-200",
};

const STACK_TAG_CLASS: Record<(typeof STACK_GROUPS)[number]["tone"], string> = {
  purple: "about-stack-tag about-stack-tag--purple",
  blue: "about-stack-tag about-stack-tag--blue",
  cyan: "about-stack-tag about-stack-tag--cyan",
};

const SPRING_GENTLE = { type: "spring" as const, stiffness: 102, damping: 20, mass: 0.72 };

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 24, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: SPRING_GENTLE,
  },
};

function AboutPillarCard({
  title,
  body,
  tone,
  reducedMotion,
}: {
  title: string;
  body: string;
  tone: (typeof PILLARS)[number]["tone"];
  reducedMotion: boolean;
}) {
  return (
    <motion.article
      variants={itemVariants}
      whileHover={
        reducedMotion
          ? undefined
          : { y: -6, scale: 1.015, transition: { type: "spring", stiffness: 380, damping: 22 } }
      }
      className={`${PILLAR_CARD_CLASS[tone]} group/pillar`}
    >
      <div className="about-pillar-card__glow pointer-events-none" aria-hidden />
      <div className="about-pillar-card__sheen pointer-events-none" aria-hidden />
      <h3
        className={`relative text-sm font-bold tracking-wide sm:text-[0.9375rem] ${PILLAR_TITLE_CLASS[tone]}`}
        style={{ fontFamily: DISPLAY_FONT }}
      >
        {title}
      </h3>
      <p
        className="relative mt-3 text-[13px] leading-[1.85] text-bento-text/82 sm:text-sm sm:leading-7"
        style={{ fontFamily: BODY_FONT }}
      >
        {body}
      </p>
    </motion.article>
  );
}

export function AboutSection() {
  const reducedMotion = useReducedMotion() === true;

  return (
    <motion.section
      id="about"
      className="reflect-stage scroll-mt-20 py-10"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.62, type: "spring", stiffness: 78, damping: 24, mass: 0.85 }}
    >
      <WallOfLoveBackground />
      <span className="reflect-section-kicker">About</span>
      <h2
        className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl lg:text-[2rem]"
        style={{ fontFamily: DISPLAY_FONT }}
      >
        关于我
      </h2>
      <p
        className="mt-2 text-sm font-medium tracking-wide text-violet-300/70 sm:text-base"
        style={{ fontFamily: BODY_FONT }}
      >
        About · AI Product Manager
      </p>

      <motion.div
        className="about-shell bento-card mt-6 rounded-2xl p-5 sm:mt-8 sm:p-7 lg:p-8"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.12 }}
        variants={containerVariants}
      >
        <motion.p
          variants={itemVariants}
          className="about-intro text-[15px] font-normal leading-[1.9] text-bento-text/90 sm:text-base sm:leading-8 lg:text-[1.0625rem]"
          style={{ fontFamily: BODY_FONT }}
        >
          <span className="font-semibold text-violet-200/95">4 年花旗 Pre-Trade 系统与 AI 产品经验</span>
          ，Vibe Coding 重度实践者。在花旗主导 AI 合规智能助手 0→1，将风险识别从 T+1 前移至交易前 1 秒内；推动大模型基建与应用团队建立分层问责协议，跨团队问题定位从 3–5 天缩短至 1 天。离职后独立上线{" "}
          <span className="font-semibold text-cyan-200/90">5 款 AI 产品</span>
          （InterviewOS、Job Engine、费曼学习、横纵分析法、AI HOT News）——不只是画 PRD 的 PM，我能把 OpenClaw Agent 做到飞书会话里，也能把产品部署到 Vercel 上。
        </motion.p>

        <motion.div
          variants={containerVariants}
          className="mt-6 grid gap-4 sm:mt-8 sm:grid-cols-3 sm:gap-5"
        >
          {PILLARS.map((pillar) => (
            <AboutPillarCard
              key={pillar.id}
              title={pillar.title}
              body={pillar.body}
              tone={pillar.tone}
              reducedMotion={reducedMotion}
            />
          ))}
        </motion.div>

        <motion.div
          variants={itemVariants}
          whileHover={reducedMotion ? undefined : { scale: 1.005 }}
          className="about-stack-card mt-5 sm:mt-6"
        >
          <h3
            className="text-sm font-bold tracking-wide text-bento-text sm:text-[0.9375rem]"
            style={{ fontFamily: DISPLAY_FONT }}
          >
            AI-Native Stack
          </h3>
          <div className="mt-5 space-y-5">
            {STACK_GROUPS.map((group) => (
              <div key={group.label}>
                <p
                  className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bento-muted/90"
                  style={{ fontFamily: BODY_FONT }}
                >
                  {group.label}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {group.items.map((item, index) => (
                    <motion.span
                      key={item}
                      initial={{ opacity: 0, scale: 0.92 }}
                      whileInView={{ opacity: 1, scale: 1 }}
                      viewport={{ once: true }}
                      transition={{ delay: reducedMotion ? 0 : index * 0.04, ...SPRING_GENTLE }}
                      whileHover={
                        reducedMotion ? undefined : { scale: 1.06, y: -2 }
                      }
                      className={STACK_TAG_CLASS[group.tone]}
                    >
                      {item}
                    </motion.span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </motion.section>
  );
}
