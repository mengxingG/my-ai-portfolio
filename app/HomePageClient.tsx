"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { AINewsWidget } from "@/app/components/AINewsWidget";
import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";
import { MagneticWrap } from "@/app/components/MagneticWrap";
import { TiltCard } from "@/app/components/TiltCard";
import { CosmicPortalHero } from "@/app/components/CosmicPortalHero";
import BreathingParticles from "@/components/BreathingParticles";
import MeteorShower from "@/components/MeteorShower";
import ReflectBackground from "@/components/ReflectBackground";
import { TimelineBento } from "@/components/TimelineBento";
import WallOfLoveBackground from "@/components/WallOfLoveBackground";
import type { AINews } from "@/utils/notion";

type Article = {
  id: string;
  title: string;
  summary: string;
  created_at?: string | null;
};

const HERO_SUBLINE = "4年经验 AI 项目经理 | Vibe Coding 重度实践者";
/** 与 Hero 展示文案一致（仅去掉单独大标题「Mengxing」，其余保留） */
const HERO_BODY =
  "Deep practice in OpenClaw & Claude Code (CC). Building AI-native agents for rapid business validation.";

/** 分词 stagger：保留空格与竖线 */
function splitForStagger(text: string): string[] {
  return text.split(/(\s+)/).filter((p) => p.length > 0);
}

export default function HomePageClient({ news }: { news: AINews[] }) {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const [projectOpen, setProjectOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

  /** Framer `useReducedMotion()` 在 SSR 为 null；若客户端为 true 会与服务端 initial 不一致，触发 Hydration 报错 */
  const [motionPreferenceReady, setMotionPreferenceReady] = useState(false);
  useEffect(() => {
    setMotionPreferenceReady(true);
  }, []);
  const hydrateSafeReducedMotion =
    motionPreferenceReady && prefersReducedMotion === true;


  // Motion tokens: unify cadence across homepage sections
  const EASE_STANDARD = [0.22, 1, 0.36, 1] as const;
  const SPRING_GENTLE = { type: "spring" as const, stiffness: 102, damping: 20, mass: 0.72 };
  const SPRING_SNAPPY = { type: "spring" as const, stiffness: 148, damping: 20, mass: 0.7 };
  const DUR_REVEAL = hydrateSafeReducedMotion ? 0 : 0.56;

  useEffect(() => {
    const closeMenus = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setProjectOpen(false);
        setKnowledgeOpen(false);
      }
    };
    document.addEventListener("click", closeMenus);
    return () => document.removeEventListener("click", closeMenus);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function fetchArticles() {
      setArticlesLoading(true);
      try {
        const res = await fetch("/api/articles");
        if (!res.ok) throw new Error("Failed to load articles");
        const list: Article[] = await res.json();
        if (!cancelled) setArticles(list ?? []);
      } catch {
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setArticlesLoading(false);
      }
    }
    fetchArticles();
    return () => { cancelled = true; };
  }, []);

  /** 列表加载后预取详情路由，首点更快；配合服务端缓存与并行拉块 */
  useEffect(() => {
    if (!articles.length) return;
    const limit = 12;
    articles.slice(0, limit).forEach((a) => {
      router.prefetch(`/articles/${a.id}`);
    });
  }, [articles, router]);

  // 轻量级视差滚动：为标记 data-parallax 的区块增加微位移
  useEffect(() => {
    const els = Array.from(
      document.querySelectorAll<HTMLElement>("[data-parallax]")
    );
    if (!els.length) return;
    const onScroll = () => {
      const y = window.scrollY;
      els.forEach((el) => {
        const speed = Number(el.dataset.parallax ?? "0.04");
        el.style.transform = `translateY(${y * speed}px)`;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /**
   * 注意：不要对 fixed 全屏 WebGL/canvas 层做 CSS translate 视差——滚动时边缘会移出视口，
   * 露出下层 body；在系统浅色主题下 body 为白底，就会出现一条灰白色横带。
   * 纵深效果保留 data-parallax 区块微位移即可。
   */

  const sectionVariants = {
    hidden: { opacity: 0, y: hydrateSafeReducedMotion ? 0 : 26 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: DUR_REVEAL,
        ease: EASE_STANDARD,
        staggerChildren: hydrateSafeReducedMotion ? 0 : 0.08,
        delayChildren: hydrateSafeReducedMotion ? 0 : 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: {
      opacity: 0,
      y: hydrateSafeReducedMotion ? 0 : 18,
      scale: hydrateSafeReducedMotion ? 1 : 0.985,
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: SPRING_GENTLE,
    },
  };

  /** 滚动联动导航：描边与阴影（底色与模糊由 .liquid-glass-nav 统一为液态玻璃） */
  const { scrollY } = useScroll();
  const navBorderAlpha = useTransform(scrollY, [0, 100], [0.08, 0.16]);
  const navShadowAlpha = useTransform(scrollY, [0, 100], [0.06, 0.14]);
  const navBorder = useMotionTemplate`1px solid rgba(255, 255, 255, ${navBorderAlpha})`;
  const navShadow = useMotionTemplate`0 12px 40px rgba(0, 0, 0, ${navShadowAlpha})`;

  const sublineParts = React.useMemo(() => splitForStagger(HERO_SUBLINE), []);

  const staggerListContainer = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: hydrateSafeReducedMotion ? 0 : 0.11,
        delayChildren: hydrateSafeReducedMotion ? 0 : 0.06,
      },
    },
  };

  const staggerListItem = {
    hidden: {
      opacity: 0,
      y: hydrateSafeReducedMotion ? 0 : 28,
      scale: hydrateSafeReducedMotion ? 1 : 0.94,
      filter: hydrateSafeReducedMotion ? "blur(0px)" : "blur(14px)",
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: SPRING_GENTLE,
    },
  };

  const sublineWordVariants = {
    hidden: {
      opacity: 0,
      y: hydrateSafeReducedMotion ? 0 : 16,
      filter: hydrateSafeReducedMotion ? "blur(0px)" : "blur(10px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: SPRING_GENTLE,
    },
  };

  const sublineContainerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: hydrateSafeReducedMotion ? 0 : 0.035,
        delayChildren: hydrateSafeReducedMotion ? 0 : 0.15,
      },
    },
  };

  /** 卡片进入视口：模糊 → 清晰 + spring */
  const cardRevealVariants = {
    hidden: {
      opacity: 0,
      y: hydrateSafeReducedMotion ? 0 : 28,
      filter: hydrateSafeReducedMotion ? "blur(0px)" : "blur(16px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: SPRING_GENTLE,
    },
  };

  return (
    <main className="reflect-theme-shell relative min-h-screen text-bento-text antialiased">
      <BreathingParticles />
      <ReflectBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: hydrateSafeReducedMotion ? 0 : -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={SPRING_SNAPPY}
          className="liquid-glass-nav reflect-nav sticky top-4 z-[45] flex flex-wrap items-center justify-between gap-4 rounded-2xl px-4 py-4 sm:px-5"
          style={{
            border: navBorder,
            boxShadow: navShadow,
          }}
        >
          <a href="#hero" className="font-semibold tracking-tight text-bento-text" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            龚梦星·Gong Mengxing
          </a>
          <div className="flex items-center gap-4">
            <motion.nav
              ref={navRef}
              initial="hidden"
              animate="show"
              variants={sectionVariants}
              className="flex items-center gap-4 text-sm font-medium text-bento-muted"
            >
              <a href="#hero" className="nav-link text-bento-muted hover:text-bento-text">首页</a>
              <div className="nav-dropdown group relative">
                <button
                  type="button"
                  onClick={() => { setProjectOpen((o) => !o); setKnowledgeOpen(false); }}
                  className="nav-link cursor-pointer border-none bg-transparent text-bento-muted hover:text-bento-text"
                  aria-expanded={projectOpen}
                  aria-haspopup="true"
                >
                  项目库
                </button>
                <div
                  className={`nav-dropdown-panel liquid-glass-card absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-purple-400/25 py-1 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${projectOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                >
                  <a href="/projects/core" className="block px-4 py-2.5 text-left text-bento-muted hover:bg-purple-500/10 hover:text-bento-text">核心项目</a>
                  <a href="/projects/featured" className="block px-4 py-2.5 text-left text-bento-muted hover:bg-purple-500/10 hover:text-bento-text">特色项目</a>
                </div>
              </div>
              <div className="nav-dropdown group relative">
                <button
                  type="button"
                  onClick={() => { setKnowledgeOpen((o) => !o); setProjectOpen(false); }}
                  className="nav-link cursor-pointer border-none bg-transparent text-bento-muted hover:text-bento-text"
                  aria-expanded={knowledgeOpen}
                  aria-haspopup="true"
                >
                  知识库
                </button>
                <div
                  className={`nav-dropdown-panel liquid-glass-card absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-purple-400/25 py-1 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${knowledgeOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                >
                  <a href="/knowledge" className="block px-4 py-2.5 text-left text-bento-muted hover:bg-purple-500/10 hover:text-bento-text">Learning Dashboard</a>
                  <a href="/knowledge/ai" className="block px-4 py-2.5 text-left text-bento-muted hover:bg-purple-500/10 hover:text-bento-text">AI 知识</a>
                  <a href="/knowledge/insights" className="block px-4 py-2.5 text-left text-bento-muted hover:bg-purple-500/10 hover:text-bento-text">资讯收集</a>
                </div>
              </div>
              <a href="#about" className="nav-link text-bento-muted hover:text-bento-text">关于我</a>
            </motion.nav>
            <FontSizeSwitcher />
          </div>
        </motion.header>

        <motion.section
          id="hero"
          className="reflect-stage reflect-stage--hero relative isolate overflow-hidden scroll-mt-20 flex flex-col items-center py-12 text-center sm:py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
        >
          <CosmicPortalHero />

          <div
            className="pointer-events-none absolute left-1/2 top-0 z-[5] h-[min(520px,60vh)] w-screen max-w-[100vw] -translate-x-1/2"
            aria-hidden
          >
            <MeteorShower />
          </div>

          <motion.div
            className="relative z-10 flex w-full flex-col items-center"
          >
          <motion.div
            variants={itemVariants}
            className="profile-neon-breath relative mb-5 h-24 w-24 shrink-0 overflow-hidden rounded-full border-2 border-white/10 sm:h-28 sm:w-28"
          >
            <Image
              src="/screenshot-20251105-214648.jpg"
              alt="龚梦星 Gong Mengxing"
              fill
              className="object-cover"
              sizes="(max-width: 640px) 96px, 112px"
              priority
            />
          </motion.div>

          {/* 徽章在主标题上方，与圈选示意一致；仅曾删除「Mengxing」大字，未删徽章/英文/按钮 */}
          <motion.div variants={itemVariants} className="neon-purple-breath mt-2 inline-flex items-center rounded-full border border-purple-400/35 bg-purple-500/10 px-4 py-1.5 text-xs font-mono tracking-widest text-purple-200/95">
            4-Year AI PM
          </motion.div>

          <motion.h2
            className="mt-3 max-w-3xl text-lg font-semibold leading-snug text-bento-text sm:text-xl md:text-2xl"
            style={{ fontFamily: '"Geist", "Inter", "SF Pro Text", system-ui, sans-serif' }}
            variants={sublineContainerVariants}
            initial="hidden"
            animate="show"
          >
            {sublineParts.map((part, i) => (
              <motion.span
                key={`sub-${i}-${part === " " ? "sp" : part}`}
                variants={sublineWordVariants}
                className="inline-block"
                style={{ whiteSpace: part.trim() === "" ? "pre" : undefined }}
              >
                {part}
              </motion.span>
            ))}
          </motion.h2>

          <motion.p
            variants={itemVariants}
            className="mt-4 max-w-2xl text-base font-light leading-relaxed text-bento-text/90 sm:text-lg"
            style={{ fontFamily: '"Geist", "Inter", "SF Pro Text", system-ui, sans-serif' }}
          >
            {HERO_BODY}
          </motion.p>

          <motion.p variants={itemVariants} className="mt-2 text-xs text-bento-muted sm:text-sm">
            Agentic Workflow · Rapid Validation · Production-ready Delivery
          </motion.p>

          <motion.div variants={itemVariants} className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <MagneticWrap strength={0.42} padding={48}>
              <motion.a
                href="/resume.pdf"
                whileHover={hydrateSafeReducedMotion ? undefined : { scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING_SNAPPY}
                className="glow-btn glow-btn--primary glow-btn--resume"
              >
                查看简历
              </motion.a>
            </MagneticWrap>
            <MagneticWrap strength={0.38} padding={48}>
              <motion.a
                href="#about"
                whileHover={hydrateSafeReducedMotion ? undefined : { scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                transition={SPRING_SNAPPY}
                className="glow-btn glow-btn--secondary"
              >
                联系我
              </motion.a>
            </MagneticWrap>
            <Link href="/#projects" className="glow-btn glow-btn--secondary">
              核心项目
            </Link>
            <Link href="/#featured" className="glow-btn glow-btn--secondary">
              特色项目
            </Link>
            <Link href="/#insights" className="glow-btn glow-btn--secondary">
              资讯收集
            </Link>
            <Link href="/#knowledge" className="glow-btn glow-btn--secondary">
              AI知识沉淀
            </Link>
            <Link href="/knowledge" className="glow-btn glow-btn--secondary">
              Learning Dashboard
            </Link>
          </motion.div>

          <motion.div
            variants={itemVariants}
            className="liquid-glass-card mt-8 w-full max-w-4xl rounded-2xl p-4 sm:p-5"
          >
            <div className="mb-3 text-center text-[11px] font-mono uppercase tracking-[0.2em] text-slate-400">
              Tech Stack
            </div>
            <motion.div
              className="flex flex-wrap justify-center gap-2 sm:gap-3"
              variants={staggerListContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.4 }}
            >
              {["OpenClaw", "Claude Code (CC)", "Cursor", "Vercel", "Windsurf", "LangChain", "Next.js", "Tailwind CSS"].map((s) => (
                <motion.span key={s} variants={staggerListItem} className="tech-tag">
                  {s}
                </motion.span>
              ))}
            </motion.div>
            <div className="stack-marquee mt-3 border-t border-white/5 pt-3">
              <div className="stack-marquee-track">
                {["OpenClaw", "Claude Code", "Vibe Coding", "Next.js", "Cursor", "LangChain", "Vercel"].map((s) => (
                  <span key={`hm-a-${s}`} className="tech-tag">{s}</span>
                ))}
                {["OpenClaw", "Claude Code", "Vibe Coding", "Next.js", "Cursor", "LangChain", "Vercel"].map((s) => (
                  <span key={`hm-b-${s}`} className="tech-tag">{s}</span>
                ))}
              </div>
            </div>
          </motion.div>
          </motion.div>
        </motion.section>

          <motion.section
          id="featured"
          className="reflect-stage reflect-stage--beam scroll-mt-20 py-10"
          data-parallax="0.014"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >

          <section className="mx-auto max-w-7xl px-4 pb-20 pt-8">
            <span className="reflect-section-kicker">Workflow</span>
            <h2 className="mb-8 mt-3 text-2xl font-bold tracking-tight text-bento-text">
              AI PM 的数字工作流· 个人独立开发项目
            </h2>
            <TimelineBento />
          </section>

        </motion.section>


        <motion.section
          id="about"
          className="reflect-stage scroll-mt-20 py-10"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.62, type: "spring", stiffness: 78, damping: 24, mass: 0.85 }}
        >
          <WallOfLoveBackground />
          <span className="reflect-section-kicker">About</span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            关于我
          </h2>
          <p className="mt-2 text-sm font-light text-bento-muted">About · New Paradigm</p>
          <motion.div
            variants={cardRevealVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.22, margin: "-0px 0px -8% 0px" }}
            className="bento-card mt-5 rounded-2xl p-5 sm:p-7"
          >
            <p className="text-sm font-light leading-relaxed text-bento-muted">
              我专注将 Agentic Workflow 与业务闭环深度结合，持续用 Vibe Coding + Rapid Validation 模式，把复杂想法快速转化为可运行、可验证、可迭代的商业级 AI 产品。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="liquid-glass-card rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-bento-text">Vibe Coding 深度实践</h3>
                <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                  能熟练利用 Claude Code (CC) 与 Cursor 完成产品从 0 到 1 的全流程。独立完成需求梳理、UI 设计、前后端开发及 Vercel 自动化部署。
                </p>
              </div>
              <div className="liquid-glass-card rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-bento-text">AI Agent 提效专家</h3>
                <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                  深度使用 OpenClaw、Claude Code 等前沿 Agent 工具优化业务流。具备通过 AI 自动化工作流提升团队 5-10 倍交付效率的实战经验。
                </p>
              </div>
              <div className="liquid-glass-card rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-bento-text">快速原型验证</h3>
                <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                  拥有在 24 小时内将商业想法转化为可运行产品的“极速交付”能力，快速验证需求与价值闭环。
                </p>
              </div>
            </div>
            <div className="liquid-glass-card mt-4 rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-bento-text">AI-Native Stack</h3>
              <p className="mt-2 text-sm text-bento-muted">
                Tools
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Claude Code (CC)", "OpenClaw", "Cursor", "Vercel", "Windsurf"].map((item) => (
                  <span key={item} className="tech-tag">{item}</span>
                ))}
              </div>
              <p className="mt-3 text-sm text-bento-muted">
                Frameworks
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["LangChain", "Next.js (App Router)", "Tailwind CSS"].map((item) => (
                  <span key={item} className="tech-tag">{item}</span>
                ))}
              </div>
            </div>
          </motion.div>
        </motion.section>

        <motion.section
          id="projects"
          className="reflect-stage reflect-stage--radar scroll-mt-20 py-10"
          data-parallax="0.018"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.62, type: "spring", stiffness: 78, damping: 24, mass: 0.85 }}
        >
          <span className="reflect-section-kicker">Projects</span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            AI Projects · 核心项目
          </h2>
          <p className="mt-2 text-sm font-light text-bento-muted">Flagship · Agentic delivery</p>
          <div className="pointer-events-none absolute left-1/2 top-[22%] z-[-1] h-[700px] w-[980px] -translate-x-1/2 rounded-full bg-purple-700/16 blur-[180px]" />
          <motion.div
            className="mt-5 space-y-4"
            variants={staggerListContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18, margin: "0px 0px -8% 0px" }}
          >
            <motion.div variants={staggerListItem}>
              <TiltCard className="block overflow-visible">
                <article className="bento-card flex flex-col overflow-hidden p-6">
              <div className="flex flex-col">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-bento-text sm:text-xl" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                      金融合规智能助手
                    </h3>
                    <p className="mt-1 text-sm font-mono text-bento-muted">Financial Compliance Intelligent Assistant</p>
                  </div>
                  <span className="status-badge status-badge--ready">READY</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-bento-muted">
                  A RAG-based AI agent for intelligent Q&A and audit assistance in financial institutions. 将复杂规则审计时间显著缩短，关键合规问答可溯源到具体条款与解释。
                </p>
              </div>
              <div className="grid gap-3 border-t border-white/5 p-5 sm:grid-cols-3 sm:p-6">
                <div className="liquid-glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-bento-text">目标用户与痛点</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-bento-muted">
                    <li>· 合规/内控：法规口径不一致、解释成本高</li>
                    <li>· 业务/产品：需求变更频繁、边界难对齐</li>
                    <li>· 审计：缺少可追溯证据链与可复核记录</li>
                  </ul>
                </div>
                <div className="liquid-glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-bento-text">核心业务模块</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-bento-muted">
                    <li>· 法规知识库：条款拆解、版本管理、标签体系</li>
                    <li>· 合规问答：引用到条款/解释口径/案例</li>
                    <li>· 审计工作台：可追溯对话、结论复核与导出</li>
                  </ul>
                </div>
                <div className="liquid-glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-bento-text">底层架构设计</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-bento-muted">
                    <li>· RAG：法规切片 + 向量检索 + 结构化引用</li>
                    <li>· Agent：工具调用编排、权限与操作审计</li>
                    <li>· 证据链：来源/版本/置信度/决策日志全记录</li>
                  </ul>
                </div>
              </div>
              <p className="border-t border-white/10 px-5 py-3 text-sm text-bento-muted sm:px-6">
                ▶ 业务成效：构建 RAG 自动化评测集，合规审查耗时缩减 40%，实现 100% 溯源审计。
              </p>
              <div className="border-t border-white/10 px-5 py-3 sm:px-6">
                <div className="flex flex-wrap gap-2">
                  <span className="tech-tag">Built with AI Agent</span>
                  <span className="tech-tag">NotebookLM-inspired</span>
                  <span className="tech-tag">RAG</span>
                  <span className="tech-tag">LLMOps</span>
                  <span className="tech-tag">Vector DB</span>
                </div>
              </div>
                </article>
              </TiltCard>
            </motion.div>
          </motion.div>
        </motion.section>

        <motion.section
          id="insights"
          className="reflect-stage reflect-stage--nebula scroll-mt-20 py-10"
          data-parallax="0.008"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.62, type: "spring", stiffness: 78, damping: 24, mass: 0.85 }}
        >
          <span className="reflect-section-kicker">Radar</span>
          <motion.div
            variants={cardRevealVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15, margin: "-0px 0px -10% 0px" }}
          >
            <AINewsWidget news={news} />
          </motion.div>
        </motion.section>

        <motion.section
          id="knowledge"
          className="reflect-stage reflect-stage--dome scroll-mt-20 py-10"
          data-parallax="0.01"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.2 }}
          transition={{ duration: 0.62, type: "spring", stiffness: 78, damping: 24, mass: 0.85 }}
        >
          <span className="reflect-section-kicker">Knowledge</span>
          <h2 className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            AI 知识博客园
          </h2>
          <p className="mt-2 text-sm font-light text-bento-muted">Best Practices &amp; Curation</p>
          <motion.div className="mt-5 grid gap-6 sm:grid-cols-2">
            {articlesLoading ? (
              <>
                {[1, 2].map((i) => (
                  <motion.div
                    key={i}
                    variants={cardRevealVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
                    className="bento-card rounded-2xl p-5"
                  >
                    <div className="knowledge-loading-skeleton h-6 w-3/4 rounded bg-purple-400/20" />
                    <div className="knowledge-loading-skeleton mt-3 h-4 w-full rounded bg-purple-300/15" />
                    <div className="knowledge-loading-skeleton mt-2 h-4 w-5/6 rounded bg-purple-300/15" />
                    <div className="knowledge-loading-skeleton mt-4 h-3 w-24 rounded bg-purple-400/25" />
                  </motion.div>
                ))}
              </>
            ) : articles.length === 0 ? (
              <div className="bento-card col-span-full rounded-2xl p-5 text-sm text-bento-muted">
                暂无文章数据，请检查 Notion 数据库连接与字段映射。
              </div>
            ) : (
              articles.map((article, idx) => (
                <motion.div
                  key={article.id}
                  variants={cardRevealVariants}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
                  transition={{ delay: hydrateSafeReducedMotion ? 0 : idx * 0.06 }}
                >
                <TiltCard tiltMax={8} className="block h-full">
                <Link
                  href={`/articles/${article.id}`}
                  prefetch
                  className="bento-card group block h-full rounded-2xl p-5 transition hover:border-purple-500/30"
                >
                  <h3 className="text-lg font-semibold text-bento-text group-hover:text-purple-200" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                    {article.title}
                  </h3>
                  <p className="mt-2 text-sm text-bento-muted">
                    {article.summary}
                  </p>
                  <span className="mt-4 inline-block text-xs font-medium text-purple-200/90">进入详情 →</span>
                </Link>
                </TiltCard>
                </motion.div>
              ))
            )}
          </motion.div>
        </motion.section>

        <motion.div
          className="mt-8 overflow-hidden border-y border-white/10 py-2.5"
          variants={cardRevealVariants}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.35 }}
        >
          <div className="stack-marquee">
            <div className="stack-marquee-track">
              {["OpenClaw", "Claude Code", "Vibe Coding", "Next.js", "Cursor"].map((s) => (
                <span key={`bottom-a-${s}`} className="tech-tag">{s}</span>
              ))}
              {["OpenClaw", "Claude Code", "Vibe Coding", "Next.js", "Cursor"].map((s) => (
                <span key={`bottom-b-${s}`} className="tech-tag">{s}</span>
              ))}
            </div>
          </div>
        </motion.div>

        <footer className="pt-4 text-xs text-bento-muted">
          © {new Date().getFullYear()} 龚梦星 Gong Mengxing · AI 产品经理
        </footer>
      </div>

      <div className="absolute inset-0 z-[-1] overflow-hidden pointer-events-none">
        <div className="absolute top-[1500px] left-[-24%] h-[1180px] w-[1180px] rounded-full bg-purple-800/12 blur-[210px]" />
        <div className="absolute top-[2200px] right-[-26%] h-[1320px] w-[1320px] rounded-full bg-fuchsia-800/12 blur-[230px]" />
      </div>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        :root { --glow-cyan: #a855f7; --glow-purple: #c084fc; }
        .nav-link { position: relative; transition: color 0.2s ease; }
        .nav-link::after {
          content: ""; position: absolute; left: 0; bottom: -2px; width: 0; height: 1px;
          background: linear-gradient(90deg, var(--glow-cyan), var(--glow-purple)); transition: width 0.2s ease;
        }
        .nav-link:hover::after { width: 100%; }
        .glow-btn {
          display: inline-flex; align-items: center; justify-content: center;
          padding: 0.625rem 1.25rem; font-size: 0.875rem; font-weight: 500; border-radius: 9999px;
          transition: box-shadow 0.3s ease, border-color 0.2s ease, transform 0.2s ease;
          font-family: "IBM Plex Mono", "SF Mono", monospace;
        }
        .glow-btn--primary {
          background: rgba(0,0,0,0.4); border: 1px solid rgba(168,85,247,0.5); color: rgb(245 243 255);
          box-shadow: 0 0 0 1px rgba(168,85,247,0.2), 0 0 20px rgba(168,85,247,0.15);
        }
        .glow-btn--primary:hover { box-shadow: 0 0 0 1px rgba(168,85,247,0.5), 0 0 28px rgba(168,85,247,0.35); }
        .glow-btn--resume {
          box-shadow: 0 0 0 1px rgba(168,85,247,0.45), 0 0 30px rgba(168,85,247,0.35), 0 0 50px rgba(176,38,255,0.2);
          animation: resume-pulse 1.8s ease-in-out infinite;
        }
        @keyframes resume-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(168,85,247,0.45), 0 0 30px rgba(168,85,247,0.35), 0 0 50px rgba(176,38,255,0.2); }
          50% { box-shadow: 0 0 0 1px rgba(168,85,247,0.7), 0 0 38px rgba(168,85,247,0.5), 0 0 66px rgba(176,38,255,0.28); }
        }
        .glow-btn--secondary {
          background: rgba(0,0,0,0.3); border: 1px solid rgba(176,38,255,0.4); color: rgb(226 232 240);
          box-shadow: 0 0 0 1px rgba(176,38,255,0.15), 0 0 16px rgba(176,38,255,0.1);
        }
        .glow-btn--secondary:hover { box-shadow: 0 0 0 1px rgba(176,38,255,0.5), 0 0 24px rgba(176,38,255,0.25); }
        .profile-neon-breath {
          box-shadow:
            0 0 0 2px rgba(168, 85, 247, 0.25),
            0 0 24px rgba(168, 85, 247, 0.35),
            0 0 48px rgba(168, 85, 247, 0.15);
          animation: profile-purple-breath 4.5s ease-in-out infinite;
        }
        @keyframes profile-purple-breath {
          0%, 100% {
            box-shadow:
              0 0 0 2px rgba(168, 85, 247, 0.22),
              0 0 20px rgba(168, 85, 247, 0.28),
              0 0 40px rgba(168, 85, 247, 0.12);
          }
          50% {
            box-shadow:
              0 0 0 2px rgba(168, 85, 247, 0.5),
              0 0 36px rgba(168, 85, 247, 0.45),
              0 0 64px rgba(168, 85, 247, 0.22);
          }
        }
        .neon-purple-breath {
          box-shadow: 0 0 0 1px rgba(168,85,247,0.3), 0 0 14px rgba(168,85,247,0.28), 0 0 28px rgba(168,85,247,0.15);
          animation: purple-breath 4s ease-in-out infinite;
        }
        @keyframes purple-breath {
          0%, 100% { box-shadow: 0 0 0 1px rgba(168,85,247,0.3), 0 0 14px rgba(168,85,247,0.28), 0 0 28px rgba(168,85,247,0.15); }
          50% { box-shadow: 0 0 0 1px rgba(168,85,247,0.55), 0 0 22px rgba(168,85,247,0.42), 0 0 44px rgba(168,85,247,0.22); }
        }
        .tech-tag {
          display: inline-block; padding: 0.25rem 0.75rem; font-size: 0.75rem;
          font-family: "IBM Plex Mono", "SF Mono", monospace;
          color: rgb(233 213 255); background: rgba(168,85,247,0.1); border: 1px solid rgba(168,85,247,0.3); border-radius: 9999px;
        }
        .stack-marquee {
          position: relative;
          overflow: hidden;
          mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 8%, black 92%, transparent);
        }
        .stack-marquee-track {
          display: flex;
          gap: 0.5rem;
          width: max-content;
          animation: stack-scroll 32s linear infinite;
          will-change: transform;
        }
        @keyframes stack-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stack-marquee-track { animation: none !important; }
        }
        .status-badge {
          display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.25rem 0.75rem; font-size: 0.75rem; font-weight: 600;
          font-family: "IBM Plex Mono", "SF Mono", monospace; text-transform: uppercase; letter-spacing: 0.1em; border-radius: 9999px;
        }
        .status-badge--ready {
          color: rgb(52 211 153); background: rgba(52,211,153,0.1); border: 1px solid rgba(52,211,153,0.4);
          box-shadow: 0 0 12px rgba(52,211,153,0.3); animation: ready-pulse 2.5s ease-in-out infinite;
        }
        @keyframes ready-pulse {
          0%, 100% { box-shadow: 0 0 12px rgba(52,211,153,0.3); }
          50% { box-shadow: 0 0 20px rgba(52,211,153,0.5); }
        }
        .knowledge-loading-skeleton {
          animation: knowledge-skeleton 1.5s ease-in-out infinite;
        }
        @keyframes knowledge-skeleton {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        @keyframes featured-btn-pin-breathe {
          0%, 100% {
            box-shadow:
              0 0 0 1px rgba(168, 85, 247, 0.5),
              0 0 26px rgba(168, 85, 247, 0.38),
              0 12px 40px rgba(0, 0, 0, 0.35);
          }
          50% {
            box-shadow:
              0 0 0 2px rgba(217, 70, 239, 0.7),
              0 0 44px rgba(168, 85, 247, 0.55),
              0 0 72px rgba(34, 211, 238, 0.14),
              0 12px 40px rgba(0, 0, 0, 0.35);
          }
        }
        .featured-btn--pinned-active {
          animation: featured-btn-pin-breathe 2.2s ease-in-out infinite;
        }
        @media (prefers-reduced-motion: reduce) {
          .featured-btn--pinned-active { animation: none; }
        }
        .featured-carousel-controls button:focus-visible {
          outline: 2px solid rgba(168, 85, 247, 0.65);
          outline-offset: 3px;
        }
      `}</style>
    </main>
  );
}
