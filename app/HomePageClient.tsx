"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { FEYNMAN_LEARNING_DEMO_HREF } from "@/lib/feynman-demo-link";
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

/** 从 computed transform 读出 rotateY（度），用于 CSS transition 途中再次点击时对齐角度 */
function readRotateYDegFromElement(el: HTMLElement | null, fallback: number): number {
  if (!el) return fallback;
  const t = getComputedStyle(el).transform;
  if (!t || t === "none") return fallback;
  try {
    const m = new DOMMatrix(t);
    const deg = (Math.atan2(m.m13, m.m11) * 180) / Math.PI;
    return Number.isFinite(deg) ? deg : fallback;
  } catch {
    return fallback;
  }
}

export default function HomePageClient({ news }: { news: AINews[] }) {
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const [projectOpen, setProjectOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);
  const [carouselPaused, setCarouselPaused] = useState(false);
  /** 点击特色项目按钮后锁定：轮播停转，直到在页面上点击非豁免区域（空白/其他模块） */
  const [featuredSelectionPinned, setFeaturedSelectionPinned] = useState(false);
  // Default to the newest featured project (Feynman Hub)
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const carouselInnerRef = useRef<HTMLDivElement>(null);
  const carouselRotationRef = useRef(0);
  const carouselFocusTimeoutRef = useRef<number | null>(null);

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
    if (!featuredSelectionPinned) return;
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest("[data-featured-pin-exempt]")) return;
      setFeaturedSelectionPinned(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [featuredSelectionPinned]);

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

  const featuredProjects = React.useMemo(
    () => [
      {
        id: "feynman-hub",
        title: "Feynman 陪伴学习",
        badge: "Featured",
        badgeClass: "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200/90",
        description:
          "类 NotebookLM 的双模态智能学习系统：费曼学习法 + AI 模拟面试 + 间隔复习。专为 ADHD 友好设计，学习数据写回 Notion 知识库。",
        tags: ["Gemini 2.5", "DeepSeek", "Next.js", "Notion API", "Mermaid.js"],
        hasDetail: true,
      },
      {
        id: "ai-news-radar",
        title: "AI News Radar",
        badge: "FEATURED",
        badgeClass: "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200/90",
        description:
          "双引擎驱动的自动化情报聚合平台：FastAPI 深挖社区共识，Coze 狙击领袖动态，Notion Headless CMS 闭环。",
        tags: ["Next.js", "FastAPI", "Coze", "Make.com", "Notion API", "Python"],
        metricsFooter: "异构双引擎 · Make.com 中枢调度 · Notion 实时推流 · Next.js 直连",
        ctaHref: "/ai-news",
        ctaText: "体验 Demo →",
        hasDetail: true,
      },
    ],
    []
  );

  const carouselStep = 360 / featuredProjects.length;
  const normalizeAngle = (deg: number) => {
    const wrapped = ((deg + 180) % 360 + 360) % 360;
    return wrapped - 180;
  };

  const nearestFeaturedIndex = useCallback((rotationDeg: number) => {
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    featuredProjects.forEach((_, idx) => {
      const dist = Math.abs(normalizeAngle(idx * carouselStep + rotationDeg));
      if (dist < bestDist) {
        best = idx;
        bestDist = dist;
      }
    });
    return best;
  }, [carouselStep, featuredProjects]);

  const syncFeaturedIndexIfChanged = useCallback(
    (deg: number) => {
      const next = nearestFeaturedIndex(deg);
      setActiveFeaturedIndex((prev) => (prev === next ? prev : next));
    },
    [nearestFeaturedIndex]
  );

  useEffect(() => () => {
    if (carouselFocusTimeoutRef.current != null) {
      window.clearTimeout(carouselFocusTimeoutRef.current);
    }
  }, []);

  useEffect(() => {
    const el = carouselInnerRef.current;
    if (!el) return;
    el.style.transform = `rotateY(${carouselRotationRef.current}deg)`;
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;
    let rafId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      const el = carouselInnerRef.current;
      const focusing = carouselFocusTimeoutRef.current != null;
      const allowSpin =
        !featuredSelectionPinned && !carouselPaused && !focusing;
      if (allowSpin && el) {
        const next = carouselRotationRef.current + dt * 0.008;
        carouselRotationRef.current = next;
        el.style.transform = `rotateY(${next}deg)`;
        syncFeaturedIndexIfChanged(next);
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [
    carouselPaused,
    featuredSelectionPinned,
    prefersReducedMotion,
    syncFeaturedIndexIfChanged,
  ]);

  const focusCarouselProject = (idx: number) => {
    const el = carouselInnerRef.current;
    const base = -idx * carouselStep;
    const current = readRotateYDegFromElement(el, carouselRotationRef.current);
    carouselRotationRef.current = current;
    const candidates = [base - 720, base - 360, base, base + 360, base + 720];
    const target = candidates.reduce((best, c) =>
      Math.abs(c - current) < Math.abs(best - current) ? c : best
    );
    if (carouselFocusTimeoutRef.current != null) {
      window.clearTimeout(carouselFocusTimeoutRef.current);
      carouselFocusTimeoutRef.current = null;
    }
    if (prefersReducedMotion) {
      carouselRotationRef.current = target;
      if (el) {
        el.style.transition = "none";
        el.style.transform = `rotateY(${target}deg)`;
      }
      syncFeaturedIndexIfChanged(target);
      return;
    }
    if (el) {
      el.style.transition = "none";
      el.style.transform = `rotateY(${current}deg)`;
      void el.offsetHeight;
      el.style.transition = "transform 0.54s cubic-bezier(0.22, 1, 0.36, 1)";
      requestAnimationFrame(() => {
        el.style.transform = `rotateY(${target}deg)`;
      });
    }
    carouselFocusTimeoutRef.current = window.setTimeout(() => {
      carouselFocusTimeoutRef.current = null;
      carouselRotationRef.current = target;
      if (el) {
        el.style.transition = "none";
        el.style.transform = `rotateY(${target}deg)`;
      }
      syncFeaturedIndexIfChanged(target);
    }, 600);
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

          {false && (
          <>
          <div
            className="featured-carousel-controls mt-4 flex flex-wrap gap-2.5"
            data-featured-pin-exempt
          >
            {featuredProjects.map((project, idx) => {
              const active = activeFeaturedIndex === idx;
              const lockedActive = featuredSelectionPinned && active;
              return (
                <motion.button
                  key={`featured-btn-${project.id}`}
                  type="button"
                  onClick={() => {
                    setFeaturedSelectionPinned(true);
                    focusCarouselProject(idx);
                  }}
                  aria-pressed={lockedActive}
                  whileHover={
                    hydrateSafeReducedMotion
                      ? undefined
                      : { scale: 1.035, y: -2 }
                  }
                  whileTap={
                    hydrateSafeReducedMotion
                      ? undefined
                      : { scale: [1, 0.94, 1.02, 1], transition: { duration: 0.38 } }
                  }
                  transition={SPRING_SNAPPY}
                  className={[
                    "group relative isolate overflow-hidden rounded-2xl px-4 py-2.5 text-left shadow-lg transition-[box-shadow,background-color] duration-300 sm:min-w-[11rem]",
                    "border border-white/[0.12] bg-gradient-to-br from-white/[0.08] via-purple-500/[0.06] to-cyan-500/[0.05]",
                    "before:pointer-events-none before:absolute before:inset-0 before:rounded-2xl before:p-px",
                    "before:bg-gradient-to-r before:from-fuchsia-400/50 before:via-purple-400/40 before:to-cyan-400/45 before:opacity-80 before:[mask:linear-gradient(#fff_0_0)_content-box,linear-gradient(#fff_0_0)] before:[mask-composite:xor] before:[-webkit-mask-composite:xor]",
                    lockedActive ? "featured-btn--pinned-active" : "",
                    active
                      ? "border-purple-400/55 bg-gradient-to-br from-purple-500/25 via-fuchsia-500/15 to-cyan-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.45),0_0_28px_rgba(168,85,247,0.35),0_12px_40px_rgba(0,0,0,0.35)] before:opacity-100"
                      : "text-slate-200 hover:border-purple-400/40 hover:shadow-[0_0_24px_rgba(168,85,247,0.22)] hover:before:opacity-100",
                  ].join(" ")}
                >
                  <span className="relative z-10 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-purple-200/80">
                        {lockedActive
                          ? "● 已锁定选中"
                          : active
                            ? "● 当前展示"
                            : "切换视图"}
                      </span>
                      <span
                        className="truncate text-sm font-semibold tracking-tight sm:text-base"
                        style={{ fontFamily: '"Geist", "Inter", system-ui, sans-serif' }}
                      >
                        {project.title}
                      </span>
                    </span>
                    <span
                      className={[
                        "shrink-0 rounded-lg px-2 py-1 text-xs font-bold tabular-nums transition-colors duration-300",
                        lockedActive
                          ? "bg-fuchsia-500/35 text-white ring-1 ring-fuchsia-300/50"
                          : active
                            ? "bg-white/20 text-white"
                            : "bg-white/5 text-purple-200/90 group-hover:bg-purple-500/25 group-hover:text-white",
                      ].join(" ")}
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                  </span>
                </motion.button>
              );
            })}
          </div>

          <div
            className="mt-5 flex snap-x gap-3 overflow-x-auto pb-2 md:hidden"
            data-featured-pin-exempt
          >
            {featuredProjects.map((project) => (
              <article
                key={`featured-mobile-${project.id}`}
                className="bento-card flex min-w-[86%] snap-center flex-col p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-bento-text" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                    {project.title}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${project.badgeClass}`}>
                    {project.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-bento-muted">{project.description}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {project.tags.map((tag) => (
                    <span key={`${project.id}-${tag}`} className="tech-tag">{tag}</span>
                  ))}
                </div>
                {project.ctaHref ? (
                  <div className="pt-5">
                    <Link href={project.ctaHref} className="glow-btn glow-btn--primary glow-btn--resume inline-flex">
                      {project.ctaText}
                    </Link>
                  </div>
                ) : null}
                {"metricsFooter" in project && project.metricsFooter ? (
                  <p className="mt-4 text-[11px] leading-relaxed text-bento-muted">{project.metricsFooter}</p>
                ) : null}
              </article>
            ))}
          </div>

          <div
            className="relative mt-6 hidden md:block [contain:layout_paint]"
            style={{ perspective: "1600px" }}
            data-featured-pin-exempt
          >
            <div className="relative mx-auto h-[500px] w-full max-w-6xl">
              <div
                ref={carouselInnerRef}
                className="absolute inset-0 will-change-transform [transform-style:preserve-3d] [backface-visibility:hidden]"
              >
                {featuredProjects.map((project, idx) => {
                  const radius = 380;
                  const isFocused = idx === activeFeaturedIndex;
                  /** 后侧卡片压低透明度，避免叠在前景上时「透字」；锁定选中时前景再用实底 */
                  const rearOpacity = featuredSelectionPinned ? 0.34 : 0.62;

                  return (
                    <div
                      key={`featured-3d-${project.id}`}
                      className="absolute left-1/2 top-1/2 w-[380px] -translate-x-1/2 -translate-y-1/2"
                      style={{ transform: `rotateY(${idx * carouselStep}deg) translateZ(${radius}px)` }}
                    >
                      <motion.article
                        onMouseEnter={() => setCarouselPaused(true)}
                        onMouseLeave={() => setCarouselPaused(false)}
                        className="bento-card flex flex-col p-6"
                        style={{
                          pointerEvents: isFocused ? "auto" : "none",
                          opacity: isFocused ? 1 : rearOpacity,
                          isolation: "isolate",
                          boxShadow: isFocused
                            ? "0 0 0 1px rgba(168,85,247,0.5), 0 0 32px rgba(168,85,247,0.38), 0 0 72px rgba(168,85,247,0.16), inset 0 1px 0 rgba(255,255,255,0.06)"
                            : undefined,
                          filter: isFocused ? "none" : "brightness(0.88) saturate(0.92)",
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="text-base font-semibold text-bento-text" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                            {project.title}
                          </h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${project.badgeClass}`}>
                            {project.badge}
                          </span>
                        </div>
                        <p
                          className="mt-3 text-sm leading-relaxed text-bento-muted"
                        >
                          {project.description}
                        </p>
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {project.tags.map((tag) => (
                            <span key={`${project.id}-desktop-${tag}`} className="tech-tag">{tag}</span>
                          ))}
                        </div>
                        {project.ctaHref ? (
                          <div className="pt-5">
                            <Link href={project.ctaHref} className="glow-btn glow-btn--primary glow-btn--resume inline-flex">
                              {project.ctaText}
                            </Link>
                          </div>
                        ) : null}
                        {"metricsFooter" in project && project.metricsFooter ? (
                          <p className="mt-4 text-[11px] leading-relaxed text-bento-muted">{project.metricsFooter}</p>
                        ) : null}
                      </motion.article>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <motion.div
            className="mt-5"
            variants={staggerListItem}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2, margin: "0px 0px -10% 0px" }}
          >
            {featuredProjects[activeFeaturedIndex]?.id === "feynman-hub" ? (
              <div className="bento-card flex flex-col p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3
                    className="text-lg font-semibold text-bento-text"
                    style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
                  >
                    费曼学习工具 —— NotebookLM 风格的双模态学习系统
                  </h3>
                  <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-bento-muted">
                    FEATURED
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <section>
                      <h4 className="text-sm font-semibold text-bento-text">🚀 项目概述</h4>
                      <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                        学了就忘？面试答不上来？这个工具让你用费曼技巧真正理解知识，再用 AI 面试官检验你是不是真懂了。
                        学习数据自动沉淀到 Notion，薄弱环节精准复习。宠物陪伴，学习过程不枯燥。
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                     🌟 上传 PDF/视频 → AI 用大白话帮你拆解核心概念 → 你用费曼技巧复述检验理解 → AI 面试官递增难度考核 → 评分报告精准标出知识盲点 → 薄弱环节自动进入间隔复习
                      </p>
                    </section>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs font-semibold text-bento-text">学 + 考 闭环</div>
                        <div className="mt-1 text-xs leading-relaxed text-bento-muted">
                          费曼学习验证理解，AI 面试官检验你能不能在压力下讲清楚。答错的知识点自动进入复习队列。
                        </div>
                      </div>
                      <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs font-semibold text-bento-text">Notion 原生集成</div>
                        <div className="mt-1 text-xs leading-relaxed text-bento-muted">
                          学习数据直接写回你的 Notion 知识库，不用在另一个 App 里管理笔记。掌握度、复习计划、费曼笔记全部沉淀。
                        </div>
                      </div>
                      <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 p-3">
                        <div className="text-xs font-semibold text-bento-text">ADHD 友好设计</div>
                        <div className="mt-1 text-xs leading-relaxed text-bento-muted">
                          「只学 5 分钟」一键启动，正计时不倒计时，宠物伴侣只奖励不惩罚。启动门槛低到不会引发抗拒。
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["Gemini 2.5", "DeepSeek", "Next.js", "Notion API", "Mermaid.js"].map((t) => (
                        <span key={`fh-${t}`} className="tech-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link
                        href="/projects/feynman-hub"
                        className="glow-btn glow-btn--primary glow-btn--resume inline-flex"
                      >
                        查看 Case Study →
                      </Link>
                      <Link href={FEYNMAN_LEARNING_DEMO_HREF} className="glow-btn glow-btn--secondary inline-flex">
                        体验 Demo →
                      </Link>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <figure className="w-full overflow-hidden rounded-2xl border border-white/12 bg-black/25 shadow-[0_12px_36px_rgba(0,0,0,0.38)]">
                      <Image
                        src="/images/feynman-hub/learning-fullview.png"
                        alt="费曼学习工具 学习页面：双栏布局与费曼对话"
                        width={1920}
                        height={1080}
                        className="h-auto w-full object-contain"
                        sizes="(max-width: 1024px) 100vw, min(560px, 45vw)"
                      />
                    </figure>
                    <p className="text-xs text-bento-muted">Learning 双栏布局全貌</p>
                    <p className="text-[11px] text-bento-muted">
                      6 个 API 路由 · 双模型协作 · Notion 双表数据流 · 两周独立开发
                    </p>
                  </div>
                </div>
              </div>
            ) : featuredProjects[activeFeaturedIndex]?.id === "ai-news-radar" ? (
              <div className="bento-card flex flex-col p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3
                    className="text-lg font-semibold text-bento-text"
                    style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
                  >
                    AI News Radar —— 双引擎驱动的自动化情报聚合平台
                  </h3>
                  <span className="shrink-0 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-bento-muted">
                    FEATURED
                  </span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <section>
                      <h4 className="text-sm font-semibold text-bento-text">🚀 项目概述</h4>
                      <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                        每天被海量 AI 噪音淹没？这是一个运行在云端的全自动情报雷达。系统采用创新的&ldquo;异构双引擎&rdquo;架构：利用
                        FastAPI 引擎深度挖掘社区高分共识，结合 Coze 节点精准狙击行业领袖一手动态。每天自动清洗、打分并结构化存入私人
                        Notion 数据库，将信息焦虑转化为高密度的洞察资产。
                      </p>
                      <p className="mt-2 text-sm leading-relaxed text-bento-muted">
                        🌟 核心业务流：社区深度解析 (FastAPI 9:30 AM) + 领袖动态狙击 (Coze 10:42 AM) ➔
                        大模型多维去噪与打分 ➔ 统一写入 Notion 数据库 ➔ Next.js 前端实时渲染
                      </p>
                    </section>

                    <div className="grid gap-2 sm:grid-cols-3">
                      <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 px-4 py-4">
                        <div className="text-xs font-semibold text-bento-text">
                          特性 1：异构双引擎（重装运算 + 敏捷狙击）
                        </div>
                        <div className="mt-1.5 text-xs leading-[1.6] text-bento-muted">
                          拒绝单一工具的妥协。Coze 绕过 X API 限制，定点狙击大佬快讯；但面对 YouTube 动辄十万字的字幕与 Hacker
                          News 的深水区辩论，其算力与时长极易触顶。因此引入 Python 自建微服务作为&ldquo;重装引擎&rdquo;，负责高并发抓取与重度大模型打分运算。Python
                          挖深共识，Coze 抢占先机，互为表里。
                        </div>
                      </div>
                      <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 px-4 py-4">
                        <div className="text-xs font-semibold text-bento-text">特性 2：优雅降级与抗脆弱设计</div>
                        <div className="mt-1.5 text-xs leading-[1.6] text-bento-muted">
                         当面临 YouTube 字幕解析受阻或严格反爬限制时，系统自动触发yt-dlp 底层回退或安全跳过策略。用微服务容错机制吞吐异常，确保每日 AI 简报「局部可降级，全局不宕机」。
                        </div>
                      </div>
                      <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 px-4 py-4">
                        <div className="text-xs font-semibold text-bento-text">特性 3：Notion 原生 CMS 闭环</div>
                        <div className="mt-1.5 text-xs leading-[1.6] text-bento-muted">
                          通过 Make.com 自动化桥接，将 Notion 打造为灵活的 Headless
                          CMS。数据抓取即入库，前端页面秒级同步更新。
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {["Next.js", "FastAPI", "Coze", "Make.com", "Notion API", "Python"].map((t) => (
                        <span key={`anr-${t}`} className="tech-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-1">
                      <Link href="/projects/ai-news-radar" className="glow-btn glow-btn--primary glow-btn--resume inline-flex">
                        查看 Case Study →
                      </Link>
                      <Link href="/ai-news" className="glow-btn glow-btn--secondary inline-flex">
                        体验 Demo →
                      </Link>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <figure className="w-full overflow-hidden rounded-2xl border border-white/12 bg-black/25 shadow-[0_12px_36px_rgba(0,0,0,0.38)]">
                      <Image
                        src="/image/news-dashboard.png"
                        alt="AI News Radar界面"
                        width={1200}
                        height={600}
                        className="h-auto w-full object-contain"
                        sizes="(max-width: 1024px) 100vw, min(560px, 45vw)"
                      />
                    </figure>
                    <p className="text-xs text-bento-muted">
                      自动化流转全貌：Make.com 调度台 · FastAPI 云端引擎 · Notion 数据库实时推流
                    </p>
                    <p className="text-[11px] text-bento-muted">
                      Next.js · FastAPI · Coze · Make.com · Notion API · Python
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bento-card flex min-h-[260px] flex-col p-6" />
            )}
          </motion.div>
          </>
          )}
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
