"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
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
import { AgenticPlexusBackground } from "@/app/components/AgenticPlexusBackground";
import { MagneticWrap } from "@/app/components/MagneticWrap";
import { TiltCard } from "@/app/components/TiltCard";
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
  const [activeFeaturedIndex, setActiveFeaturedIndex] = useState(0);
  const carouselInnerRef = useRef<HTMLDivElement>(null);
  const carouselRotationRef = useRef(0);
  const carouselFocusTimeoutRef = useRef<number | null>(null);

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
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 26 },
    show: {
      opacity: 1,
      y: 0,
      transition: {
        duration: prefersReducedMotion ? 0 : 0.65,
        ease: [0.22, 1, 0.36, 1] as const,
        staggerChildren: prefersReducedMotion ? 0 : 0.08,
        delayChildren: prefersReducedMotion ? 0 : 0.06,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : 18, scale: prefersReducedMotion ? 1 : 0.985 },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: { type: "spring" as const, stiffness: 120, damping: 20, mass: 0.7 },
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
        staggerChildren: prefersReducedMotion ? 0 : 0.11,
        delayChildren: prefersReducedMotion ? 0 : 0.06,
      },
    },
  };

  const staggerListItem = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 28,
      scale: prefersReducedMotion ? 1 : 0.94,
      filter: prefersReducedMotion ? "blur(0px)" : "blur(14px)",
    },
    show: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: { type: "spring" as const, stiffness: 86, damping: 19, mass: 0.72 },
    },
  };

  const sublineWordVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 16,
      filter: prefersReducedMotion ? "blur(0px)" : "blur(10px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring" as const, stiffness: 100, damping: 20, mass: 0.65 },
    },
  };

  const sublineContainerVariants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: prefersReducedMotion ? 0 : 0.035,
        delayChildren: prefersReducedMotion ? 0 : 0.15,
      },
    },
  };

  /** 卡片进入视口：模糊 → 清晰 + spring */
  const cardRevealVariants = {
    hidden: {
      opacity: 0,
      y: prefersReducedMotion ? 0 : 28,
      filter: prefersReducedMotion ? "blur(0px)" : "blur(16px)",
    },
    show: {
      opacity: 1,
      y: 0,
      filter: "blur(0px)",
      transition: { type: "spring" as const, stiffness: 88, damping: 20, mass: 0.75 },
    },
  };

  const featuredProjects = React.useMemo(
    () => [
      {
        id: "knowyourai",
        title: "KnowYourAI.co",
        badge: "Featured",
        badgeClass:
          "border border-amber-500/40 bg-amber-500/10 text-amber-200/90",
        description:
          "面向 AI 产品经理与开发者的知识索引与能力地图项目，聚焦模型能力评测、实用工具链整理与可执行方法论沉淀。",
        tags: ["Product Strategy", "AI Workflow", "Knowledge Base"],
        hasDetail: false,
      },
      {
        id: "agentive",
        title: "AGENTIVE",
        badge: "Featured",
        badgeClass:
          "border border-purple-500/40 bg-purple-500/10 text-purple-200/90",
        description:
          "多 Agent 协同执行框架实践，打通任务拆解、工具调用与审计追踪，提升复杂业务流自动化可控性与交付效率。",
        tags: ["Agents", "Orchestration", "Automation"],
        hasDetail: false,
      },
      {
        id: "syntax",
        title: "SYNTAX",
        badge: "Featured",
        badgeClass: "border border-cyan-500/40 bg-cyan-500/10 text-cyan-200/90",
        description:
          "AI-native 开发效率项目，围绕 Prompt Engineering、代码辅助与自动化验证构建统一研发闭环，缩短从想法到上线的路径。",
        tags: ["Vibe Coding", "PromptOps", "Next.js"],
        hasDetail: false,
      },
      {
        id: "ai-news-radar",
        title: "AI 资讯雷达",
        badge: "Core",
        badgeClass:
          "border border-emerald-500/40 bg-emerald-500/10 text-emerald-200/90",
        description:
          "端到端全自动情报聚合系统：Google/YouTube API 抓取多源数据，GPT-4o mini 清洗去重与双语翻译，Make.com 调度 Coze 每日写入 Notion。",
        tags: ["Coze", "Make.com", "Notion API", "GPT-4o mini", "Automation"],
        ctaHref: "/ai-news",
        ctaText: "👉 实时查看 Notion 情报库",
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
      el.style.transition = "transform 0.58s cubic-bezier(0.22, 1, 0.36, 1)";
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
    <main className="gmx-main relative min-h-screen text-slate-100 antialiased">
      {/* z-0：负 z-index 会把画布压到 body 底色之下，看起来像「背景只剩纯色」 */}
      <AgenticPlexusBackground reducedMotion={Boolean(prefersReducedMotion)} />
      <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
        <div className="absolute inset-0 bg-black/26" />
        <div
          className="agentic-foreground-vignette absolute inset-0 mix-blend-screen"
          style={{
            background:
              "radial-gradient(ellipse 130% 58% at 50% 100%, rgba(192, 132, 252, 0.28) 0%, transparent 56%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <motion.header
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : -18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring" as const, stiffness: 140, damping: 20 }}
          className="liquid-glass-nav sticky top-4 z-[45] flex flex-wrap items-center justify-between gap-4 rounded-2xl px-4 py-4 sm:px-5"
          style={{
            border: navBorder,
            boxShadow: navShadow,
          }}
        >
          <a href="#hero" className="font-semibold tracking-tight text-slate-100" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            龚梦星·Gong Mengxing
          </a>
          <div className="flex items-center gap-4">
            <motion.nav
              ref={navRef}
              initial="hidden"
              animate="show"
              variants={sectionVariants}
              className="flex items-center gap-4 text-sm font-medium text-slate-400"
            >
              <a href="#hero" className="nav-link text-slate-300 hover:text-cyan-300">首页</a>
              <div className="nav-dropdown group relative">
                <button
                  type="button"
                  onClick={() => { setProjectOpen((o) => !o); setKnowledgeOpen(false); }}
                  className="nav-link cursor-pointer border-none bg-transparent text-slate-300 hover:text-cyan-300"
                  aria-expanded={projectOpen}
                  aria-haspopup="true"
                >
                  项目库
                </button>
                <div
                  className={`nav-dropdown-panel liquid-glass-card absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-cyan-500/25 py-1 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${projectOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                >
                  <a href="/projects/core" className="block px-4 py-2.5 text-left text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300">核心项目</a>
                  <a href="/projects/featured" className="block px-4 py-2.5 text-left text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300">特色项目</a>
                </div>
              </div>
              <div className="nav-dropdown group relative">
                <button
                  type="button"
                  onClick={() => { setKnowledgeOpen((o) => !o); setProjectOpen(false); }}
                  className="nav-link cursor-pointer border-none bg-transparent text-slate-300 hover:text-cyan-300"
                  aria-expanded={knowledgeOpen}
                  aria-haspopup="true"
                >
                  知识库
                </button>
                <div
                  className={`nav-dropdown-panel liquid-glass-card absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-cyan-500/25 py-1 shadow-xl transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${knowledgeOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                >
                  <a href="/knowledge/ai" className="block px-4 py-2.5 text-left text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300">AI 知识</a>
                  <a href="/knowledge/insights" className="block px-4 py-2.5 text-left text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300">资讯收集</a>
                </div>
              </div>
              <a href="#about" className="nav-link text-slate-300 hover:text-cyan-300">关于我</a>
            </motion.nav>
            <FontSizeSwitcher />
          </div>
        </motion.header>

        <motion.section
          id="hero"
          className="scroll-mt-20 flex flex-col items-center py-12 text-center sm:py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
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
            className="mt-3 max-w-3xl text-lg font-semibold leading-snug text-slate-100 sm:text-xl md:text-2xl"
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
            className="mt-4 max-w-2xl text-base font-light leading-relaxed text-slate-100 sm:text-lg"
            style={{ fontFamily: '"Geist", "Inter", "SF Pro Text", system-ui, sans-serif' }}
          >
            {HERO_BODY}
          </motion.p>

          <motion.p variants={itemVariants} className="mt-2 text-xs text-slate-500 sm:text-sm">
            Agentic Workflow · Rapid Validation · Production-ready Delivery
          </motion.p>

          <motion.div variants={itemVariants} className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
            <MagneticWrap strength={0.42} padding={48}>
              <motion.a
                href="/resume.pdf"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.04 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring" as const, stiffness: 260, damping: 18 }}
                className="glow-btn glow-btn--primary glow-btn--resume"
              >
                查看简历
              </motion.a>
            </MagneticWrap>
            <MagneticWrap strength={0.38} padding={48}>
              <motion.a
                href="#about"
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                transition={{ type: "spring" as const, stiffness: 240, damping: 18 }}
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
        </motion.section>

        <motion.section
          id="featured"
          className="scroll-mt-20 py-10"
          data-parallax="0.014"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            AI Projects · 个人独立开发项目
          </h2>
          <p className="mt-2 text-sm font-light text-slate-500">
            {featuredSelectionPinned
              ? "已锁定当前项目 · 点击页面空白或其他模块区域恢复自动旋转"
              : "随便点击，了解我的独立开发项目"}
          </p>

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
                    prefersReducedMotion
                      ? undefined
                      : { scale: 1.035, y: -2 }
                  }
                  whileTap={
                    prefersReducedMotion
                      ? undefined
                      : { scale: [1, 0.94, 1.02, 1], transition: { duration: 0.38 } }
                  }
                  transition={{ type: "spring" as const, stiffness: 400, damping: 22 }}
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
                className="holo-card min-w-[86%] snap-center rounded-2xl p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                    {project.title}
                  </h3>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${project.badgeClass}`}>
                    {project.badge}
                  </span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">{project.description}</p>
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
                        className="holo-card rounded-2xl p-5"
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
                          <h3 className="text-base font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                            {project.title}
                          </h3>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-mono uppercase ${project.badgeClass}`}>
                            {project.badge}
                          </span>
                        </div>
                        <p
                          className={`mt-3 text-sm leading-relaxed ${isFocused ? "text-slate-300" : "text-slate-500"}`}
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
            {featuredProjects[activeFeaturedIndex]?.id === "ai-news-radar" ? (
              <div className="holo-card rounded-2xl p-5 sm:p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-lg font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                    AI 资讯雷达 (AI News Radar) —— 端到端全自动情报聚合系统
                  </h3>
                  <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-emerald-200/90">Core Case</span>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-3">
                    <figure className="liquid-glass-card w-full overflow-hidden rounded-xl shadow-[0_12px_24px_rgba(0,0,0,0.28)]">
                      <Image src="/image/news.png" alt="AI News Radar 新闻展示截图" width={1200} height={600} className="h-auto w-full object-contain" />
                    </figure>
                    <p className="text-xs text-slate-400">News 输出预览</p>
                  </div>
                  <div className="space-y-3">
                    <section>
                      <h4 className="text-sm font-semibold text-white">🚀 项目概述</h4>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">这是一个无需人工干预、每日自动运行的 AI 情报系统。通过整合低代码工作流引擎与 LLM，实现从「多源抓取 → 智能过滤清洗 → 双语摘要翻译 → 结构化入库」的完整闭环，显著降低信息噪音。</p>
                    </section>
                    <section>
                      <h4 className="text-sm font-semibold text-white">🛠️ 技术架构</h4>
                      <ol className="mt-2 space-y-1.5 text-sm text-slate-300">
                        <li className="liquid-glass-card rounded-lg px-3 py-2">1. Make.com：Cron Job 定时触发与 API 路由调度</li>
                        <li className="liquid-glass-card rounded-lg px-3 py-2">2. Coze Workflow：多节点工作流串联与逻辑控制</li>
                        <li className="liquid-glass-card rounded-lg px-3 py-2">3. Google Web Search API + YouTube API：多源数据抓取</li>
                        <li className="liquid-glass-card rounded-lg px-3 py-2">4. GPT-4o mini：数据清洗、去重、双语摘要翻译</li>
                        <li className="liquid-glass-card rounded-lg px-3 py-2">5. Notion API：结构化数据库自动写入与展示</li>
                      </ol>
                    </section>
                    <section>
                      <h4 className="text-sm font-semibold text-white">📈 核心痛点与突破</h4>
                      <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                        <li className="liquid-glass-card rounded-lg px-3 py-2">双重去重（Title + Date 组合键 + 语义判重），有效拦截洗稿与重复报道。</li>
                        <li className="liquid-glass-card rounded-lg px-3 py-2">Node.js 时间校准与正则校验，解决 Notion API 对时间戳格式敏感导致的写入崩溃。</li>
                        <li className="liquid-glass-card rounded-lg px-3 py-2">引入 Make.com 作为独立调度层，跨平台触发 Coze，提升稳定性与灵活性。</li>
                      </ul>
                    </section>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="tech-tag">Coze</span><span className="tech-tag">Make.com</span><span className="tech-tag">Notion API</span><span className="tech-tag">GPT-4o mini</span><span className="tech-tag">Automation</span>
                    </div>
                    <p className="text-sm text-slate-300">将每日获取前沿 AI 资讯的耗时从 <span className="font-semibold text-cyan-300">40 分钟/天</span> 缩减至<span className="font-semibold text-purple-300"> 0 分钟/天</span>，构建个人高价值情报知识库。</p>
                    <div><Link href="/ai-news" className="glow-btn glow-btn--primary glow-btn--resume inline-flex">👉 实时查看 Notion 情报库</Link></div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="holo-card min-h-[260px] rounded-2xl border border-dashed border-white/15 p-5 sm:p-6" />
            )}
          </motion.div>
        </motion.section>


        <motion.section
          id="about"
          className="scroll-mt-20 py-10"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            关于我
          </h2>
          <p className="mt-2 text-sm font-light text-slate-500">About · New Paradigm</p>
          <motion.div
            variants={cardRevealVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.22, margin: "-0px 0px -8% 0px" }}
            className="holo-card mt-5 rounded-2xl p-5 sm:p-7"
          >
            <p className="text-sm font-light leading-relaxed text-slate-400">
              我专注将 Agentic Workflow 与业务闭环深度结合，持续用 Vibe Coding + Rapid Validation 模式，把复杂想法快速转化为可运行、可验证、可迭代的商业级 AI 产品。
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="liquid-glass-card rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">Vibe Coding 深度实践</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  能熟练利用 Claude Code (CC) 与 Cursor 完成产品从 0 到 1 的全流程。独立完成需求梳理、UI 设计、前后端开发及 Vercel 自动化部署。
                </p>
              </div>
              <div className="liquid-glass-card rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">AI Agent 提效专家</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  深度使用 OpenClaw、Claude Code 等前沿 Agent 工具优化业务流。具备通过 AI 自动化工作流提升团队 5-10 倍交付效率的实战经验。
                </p>
              </div>
              <div className="liquid-glass-card rounded-xl p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">快速原型验证</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  拥有在 24 小时内将商业想法转化为可运行产品的“极速交付”能力，快速验证需求与价值闭环。
                </p>
              </div>
            </div>
            <div className="liquid-glass-card mt-4 rounded-xl p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">AI-Native Stack</h3>
              <p className="mt-2 text-sm text-slate-400">
                Tools
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Claude Code (CC)", "OpenClaw", "Cursor", "Vercel", "Windsurf"].map((item) => (
                  <span key={item} className="tech-tag">{item}</span>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-400">
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
          className="scroll-mt-20 py-10"
          data-parallax="0.018"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            AI Projects · 核心项目
          </h2>
          <p className="mt-2 text-sm font-light text-slate-500">Flagship · Agentic delivery</p>
          <motion.div
            className="mt-5 space-y-4"
            variants={staggerListContainer}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.18, margin: "0px 0px -8% 0px" }}
          >
            <motion.div variants={staggerListItem}>
              <TiltCard className="block overflow-visible">
                <article className="holo-card overflow-hidden rounded-2xl">
              <div className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-50 sm:text-xl" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                      金融合规智能助手
                    </h3>
                    <p className="mt-1 text-sm font-mono text-slate-500">Financial Compliance Intelligent Assistant</p>
                  </div>
                  <span className="status-badge status-badge--ready">READY</span>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-slate-400">
                  A RAG-based AI agent for intelligent Q&A and audit assistance in financial institutions. 将复杂规则审计时间显著缩短，关键合规问答可溯源到具体条款与解释。
                </p>
              </div>
              <div className="grid gap-3 border-t border-white/5 p-5 sm:grid-cols-3 sm:p-6">
                <div className="liquid-glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">目标用户与痛点</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                    <li>· 合规/内控：法规口径不一致、解释成本高</li>
                    <li>· 业务/产品：需求变更频繁、边界难对齐</li>
                    <li>· 审计：缺少可追溯证据链与可复核记录</li>
                  </ul>
                </div>
                <div className="liquid-glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">核心业务模块</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                    <li>· 法规知识库：条款拆解、版本管理、标签体系</li>
                    <li>· 合规问答：引用到条款/解释口径/案例</li>
                    <li>· 审计工作台：可追溯对话、结论复核与导出</li>
                  </ul>
                </div>
                <div className="liquid-glass-card rounded-xl p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">底层架构设计</h4>
                  <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
                    <li>· RAG：法规切片 + 向量检索 + 结构化引用</li>
                    <li>· Agent：工具调用编排、权限与操作审计</li>
                    <li>· 证据链：来源/版本/置信度/决策日志全记录</li>
                  </ul>
                </div>
              </div>
              <p className="border-t border-white/10 px-5 py-3 text-sm text-slate-300 sm:px-6">
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
          className="scroll-mt-20 py-10"
          data-parallax="0.008"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
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
          className="scroll-mt-20 py-10"
          data-parallax="0.01"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.2 }}
          variants={sectionVariants}
        >
          <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl" style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}>
            AI 知识沉淀
          </h2>
          <p className="mt-2 text-sm font-light text-slate-500">Best Practices &amp; Curation</p>
          <motion.div className="mt-5 grid gap-4 sm:grid-cols-2">
            {articlesLoading ? (
              <>
                {[1, 2].map((i) => (
                  <motion.div
                    key={i}
                    variants={cardRevealVariants}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, amount: 0.15, margin: "0px 0px -8% 0px" }}
                    className="holo-card rounded-2xl p-5"
                  >
                    <div className="knowledge-loading-skeleton h-6 w-3/4 rounded bg-slate-600/50" />
                    <div className="knowledge-loading-skeleton mt-3 h-4 w-full rounded bg-slate-600/40" />
                    <div className="knowledge-loading-skeleton mt-2 h-4 w-5/6 rounded bg-slate-600/40" />
                    <div className="knowledge-loading-skeleton mt-4 h-3 w-24 rounded bg-cyan-500/30" />
                  </motion.div>
                ))}
              </>
            ) : articles.length === 0 ? (
              <div className="holo-card col-span-full rounded-2xl p-5 text-sm text-slate-400">
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
                  transition={{ delay: prefersReducedMotion ? 0 : idx * 0.06 }}
                >
                <TiltCard tiltMax={8} className="block h-full">
                <Link
                  href={`/articles/${article.id}`}
                  prefetch
                  className="holo-card group block h-full rounded-2xl p-5 transition hover:border-purple-500/30"
                >
                  <h3 className="text-lg font-semibold text-slate-50 group-hover:text-cyan-300" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                    {article.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {article.summary}
                  </p>
                  <span className="mt-4 inline-block text-xs font-medium text-cyan-400/90">进入详情 →</span>
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

        <footer className="pt-4 text-xs text-slate-500">
          © {new Date().getFullYear()} 龚梦星 Gong Mengxing · AI 产品经理
        </footer>
      </div>

      <style jsx global>{`
        html { scroll-behavior: smooth; }
        :root { --glow-cyan: #06b6d4; --glow-purple: #b026ff; }
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
          background: rgba(0,0,0,0.4); border: 1px solid rgba(6,182,212,0.5); color: rgb(207 250 254);
          box-shadow: 0 0 0 1px rgba(6,182,212,0.2), 0 0 20px rgba(6,182,212,0.15);
        }
        .glow-btn--primary:hover { box-shadow: 0 0 0 1px rgba(6,182,212,0.5), 0 0 28px rgba(6,182,212,0.35); }
        .glow-btn--resume {
          box-shadow: 0 0 0 1px rgba(6,182,212,0.45), 0 0 30px rgba(6,182,212,0.35), 0 0 50px rgba(176,38,255,0.2);
          animation: resume-pulse 1.8s ease-in-out infinite;
        }
        @keyframes resume-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(6,182,212,0.45), 0 0 30px rgba(6,182,212,0.35), 0 0 50px rgba(176,38,255,0.2); }
          50% { box-shadow: 0 0 0 1px rgba(6,182,212,0.7), 0 0 38px rgba(6,182,212,0.5), 0 0 66px rgba(176,38,255,0.28); }
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
          color: rgb(165 243 252); background: rgba(6,182,212,0.06); border: 1px solid rgba(6,182,212,0.25); border-radius: 9999px;
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
