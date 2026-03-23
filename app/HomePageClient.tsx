"use client";

import React, { useEffect, useRef, useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AINewsWidget } from "@/app/components/AINewsWidget";
import type { AINews } from "@/utils/notion";

type Article = {
  id: string;
  title: string;
  summary: string;
  created_at?: string | null;
};

const CYAN = "#06b6d4";
const PURPLE = "#7c3aed";
const GOLD = "#eab308";
const MOUSE_RADIUS = 120;
const MOUSE_REPEL = 0.08;
// 核心位置：界面右侧 2/3 处
const CORE_X = 2 / 3;
const CORE_Y = 0.5;

// 连线距离与核心半径（核心半径已 +40%）
const LINK_DISTANCE_RATIO = 0.28;
const CORE_RADIUS_RATIO = 0.196;
const CORE_INNER_RATIO = 0.084;

// 引力锚点：G, M, X 的抽象几何拓扑（归一化 0.25~0.75，占界面 1/2）
function getGMXAnchors(): { x: number; y: number; w: number }[] {
  const anchors: { x: number; y: number; w: number }[] = [];
  const push = (x: number, y: number, w = 1) => anchors.push({ x, y, w });
  // G 形（更多锚点，更密）
  [0.28, 0.32, 0.36, 0.4, 0.44, 0.48].forEach((x, i) => push(x, 0.28 + i * 0.015, 1.2));
  [0.46, 0.5, 0.54, 0.58].forEach((x) => push(x, 0.34, 1));
  [0.58, 0.55, 0.5, 0.45, 0.4, 0.36].forEach((x, i) => push(x, 0.42 + i * 0.04, 1.2));
  push(0.34, 0.6, 1.3);
  push(0.32, 0.52, 1.2);
  push(0.28, 0.44, 1.1);
  // M 形
  [0.32, 0.36, 0.4].forEach((y, i) => push(0.38 + i * 0.02, 0.3 + y * 0.25, 1));
  push(0.5, 0.48, 1.3);
  [0.6, 0.64, 0.68].forEach((x, i) => push(x, 0.3 + i * 0.18, 1));
  // X 形
  push(0.38, 0.32, 1.1);
  push(0.72, 0.68, 1.1);
  push(0.5, 0.5, 1.4);
  push(0.38, 0.68, 1.1);
  push(0.72, 0.32, 1.1);
  push(0.54, 0.42, 1.05);
  push(0.58, 0.58, 1.05);
  return anchors;
}

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  layer: number;
  r: number;
  opacity: number;
  twinklePhase: number;
  anchorIdx: number;
  isCore: boolean;
};

import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";

export default function HomePageClient({ news }: { news: AINews[] }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLDivElement>(null);
  const [projectOpen, setProjectOpen] = useState(false);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [articlesLoading, setArticlesLoading] = useState(true);

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

  useEffect(() => {
    const cursorEl = cursorRef.current;
    if (!cursorEl) return;

    // 粗指针设备（手机/平板）直接不启用自定义光标
    const mq = window.matchMedia?.("(pointer: coarse)");
    if (mq?.matches) {
      cursorEl.style.display = "none";
      return;
    }

    let rafId = 0;
    let lastX = -1e4;
    let lastY = -1e4;
    let hot = false;

    const setHot = (nextHot: boolean) => {
      if (hot === nextHot) return;
      hot = nextHot;
      cursorEl.classList.toggle("cursor-star--active", hot);
    };

    const onMove = (e: PointerEvent) => {
      lastX = e.clientX;
      lastY = e.clientY;

      if (!rafId) {
        rafId = window.requestAnimationFrame(() => {
          rafId = 0;
          cursorEl.style.transform = `translate3d(${lastX}px, ${lastY}px, 0) translate3d(-50%, -50%, 0)`;
        });
      }

      const el = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      const clickable = !!el?.closest("a[href],button,[role='button']");
      setHot(clickable);
    };

    const onLeave = () => setHot(false);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, []);

  const runCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const anchors = getGMXAnchors();
    let rafId = 0;
    let running = true;
    const mouse = { x: -1e4, y: -1e4, active: false };

    const setSize = () => {
      const dpr = Math.min(window.devicePixelRatio ?? 1, 2);
      const width = window.innerWidth;
      const height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      return { w: width, h: height };
    };

    let { w, h } = setSize();

    const toX = (nx: number) => nx * w;
    const toY = (ny: number) => ny * h;
    // 星座放大 40%，中心在 (CORE_X, CORE_Y)
    const mapAnchor = (ax: number, ay: number) => ({
      nx: Math.max(0.05, Math.min(0.98, CORE_X + (ax - 0.5) * 1.4)),
      ny: Math.max(0.1, Math.min(0.9, CORE_Y + (ay - 0.5) * 1.4)),
    });

    const particles: Particle[] = [];
    const FAR_COUNT = 80;
    const MID_COUNT = 55;
    const CORE_COUNT = 45;

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const initParticles = () => {
      particles.length = 0;
      const minDim = Math.min(w, h);
      const coreRadiusPx = minDim * CORE_RADIUS_RATIO;
      const coreInnerPx = minDim * CORE_INNER_RATIO;

      for (let i = 0; i < FAR_COUNT; i++) {
        particles.push({
          x: rand(0, w),
          y: rand(0, h),
          vx: rand(-0.12, 0.12),
          vy: rand(-0.12, 0.12),
          layer: 0,
          r: rand(0.5, 1.5),
          opacity: rand(0.5, 0.95),
          twinklePhase: rand(0, Math.PI * 2),
          anchorIdx: -1,
          isCore: false,
        });
      }
      for (let i = 0; i < MID_COUNT; i++) {
        const ax = anchors[i % anchors.length];
        const { nx, ny } = mapAnchor(ax.x, ax.y);
        const jitter = 0.025;
        particles.push({
          x: toX(nx + rand(-jitter, jitter)),
          y: toY(ny + rand(-jitter, jitter)),
          vx: rand(-0.18, 0.18),
          vy: rand(-0.18, 0.18),
          layer: 1,
          r: rand(1.2, 2.4),
          opacity: rand(0.55, 0.98),
          twinklePhase: rand(0, Math.PI * 2),
          anchorIdx: i % anchors.length,
          isCore: false,
        });
      }
      const coreCx = toX(CORE_X);
      const coreCy = toY(CORE_Y);
      for (let i = 0; i < CORE_COUNT; i++) {
        const angle = rand(0, Math.PI * 2);
        const dist = rand(0, coreRadiusPx);
        particles.push({
          x: coreCx + Math.cos(angle) * dist,
          y: coreCy + Math.sin(angle) * dist,
          vx: rand(-0.08, 0.08),
          vy: rand(-0.08, 0.08),
          layer: 2,
          r: rand(1.4, 3),
          opacity: rand(0.75, 1),
          twinklePhase: rand(0, Math.PI * 2),
          anchorIdx: -1,
          isCore: dist < coreInnerPx,
        });
      }
    };

    initParticles();
    const handleResize = () => {
      const dims = setSize();
      w = dims.w;
      h = dims.h;
      initParticles();
    };
    window.addEventListener("resize", handleResize);

    const onMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave, { passive: true });

    const drawBg = () => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.8);
      g.addColorStop(0, "#0c1222");
      g.addColorStop(0.4, "#0a1628");
      g.addColorStop(0.7, "#061018");
      g.addColorStop(1, "#030508");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    };

    const tick = (t: number) => {
      if (!running) return;
      const time = t * 0.001;

      drawBg();

      // 鼠标排斥 + 引力锚点 + 核心引力
      const coreCx = toX(CORE_X);
      const coreCy = toY(CORE_Y);
      const mouseR2 = MOUSE_RADIUS * MOUSE_RADIUS;

      particles.forEach((p) => {
        if (mouse.active) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < mouseR2 && d2 > 1) {
            const d = Math.sqrt(d2);
            const f = (1 - d / MOUSE_RADIUS) * MOUSE_REPEL;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
          }
        }

        if (p.layer === 1 && p.anchorIdx >= 0) {
          const a = anchors[p.anchorIdx];
          const { nx, ny } = mapAnchor(a.x, a.y);
          const ax = toX(nx);
          const ay = toY(ny);
          const dx = ax - p.x;
          const dy = ay - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 2) {
            const pull = 0.002 * a.w;
            p.vx += (dx / dist) * pull;
            p.vy += (dy / dist) * pull;
          }
        }

        if (p.layer === 2) {
          const dx = coreCx - p.x;
          const dy = coreCy - p.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1) {
            const strength = p.isCore ? 0.012 : 0.004;
            p.vx += (dx / dist) * strength;
            p.vy += (dy / dist) * strength;
          }
        }

        p.vx *= 0.98;
        p.vy *= 0.98;
        p.x += p.vx;
        p.y += p.vy;

        // 视差：远景移动更慢（通过速度衰减已体现）；边界约束
        if (p.x < -20 || p.x > w + 20) p.vx *= -0.5;
        if (p.y < -20 || p.y > h + 20) p.vy *= -0.5;
        p.x = Math.max(-20, Math.min(w + 20, p.x));
        p.y = Math.max(-20, Math.min(h + 20, p.y));
      });

      // 连线：同层或近层，距离 < linkDistance 则画线（透明度随距离渐变）
      const linkDistance = Math.min(w, h) * LINK_DISTANCE_RATIO;
      const linkPairs: [Particle, Particle][] = [];
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i];
          const b = particles[j];
          if (a.layer !== b.layer && Math.abs(a.layer - b.layer) > 1) continue;
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < linkDistance) linkPairs.push([a, b]);
        }
      }

      linkPairs.forEach(([a, b]) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        const d = Math.hypot(dx, dy);
        const alpha = (1 - d / linkDistance) * 0.38;
        if (alpha < 0.02) return;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
        grad.addColorStop(0, `rgba(6, 182, 212, ${alpha})`);
        grad.addColorStop(0.5, `rgba(124, 58, 237, ${alpha * 0.8})`);
        grad.addColorStop(1, `rgba(234, 179, 8, ${alpha * 0.6})`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });

      // 绘制粒子：远景闪烁（更密更亮），中景/近景发光
      particles.forEach((p) => {
        const twinkle = p.layer === 0 ? 0.55 + 0.45 * Math.sin(time * 2.2 + p.twinklePhase) : 1;
        const op = Math.max(0.15, Math.min(1, p.opacity * twinkle));

        if (p.layer === 0) {
          ctx.fillStyle = `rgba(180, 220, 255, ${op})`;
          ctx.shadowColor = "rgba(6, 182, 212, 0.6)";
          ctx.shadowBlur = p.r * 2;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
          return;
        }

        if (p.layer === 2 && p.isCore) {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
          g.addColorStop(0, `rgba(6, 182, 212, ${op * 0.9})`);
          g.addColorStop(0.5, `rgba(124, 58, 237, ${op * 0.4})`);
          g.addColorStop(1, "rgba(6, 182, 212, 0)");
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
          ctx.fill();
        }

        const color = p.layer === 2 ? (p.isCore ? CYAN : PURPLE) : CYAN;
        const hex = color === CYAN ? "6, 182, 212" : "124, 58, 237";
        ctx.fillStyle = `rgba(${hex}, ${op})`;
        ctx.shadowColor = color;
        ctx.shadowBlur = p.layer === 2 ? 8 : 4;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const onVisibility = () => {
      running = document.visibilityState === "visible";
      if (!running) cancelAnimationFrame(rafId);
      else rafId = requestAnimationFrame(tick);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const cleanup = runCanvas();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [runCanvas]);

  return (
    <main className="gmx-main relative min-h-screen text-slate-100 antialiased">
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-[-10] block w-full h-full"
        style={{ pointerEvents: "none" }}
        aria-hidden
      />
      {/* 星尘样式鼠标光标：默认小且偏暗；悬停到可点击元素时放大并提亮 */}
      <div ref={cursorRef} className="cursor-star" aria-hidden />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-6">
          <a href="#hero" className="font-semibold tracking-tight text-slate-100" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            龚梦星·Gong Mengxing
          </a>
          <div className="flex items-center gap-4">
            <nav ref={navRef} className="flex items-center gap-6 text-sm font-medium text-slate-400">
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
                  className={`nav-dropdown-panel absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-cyan-500/20 bg-slate-900/95 py-1 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${projectOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
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
                  className={`nav-dropdown-panel absolute left-0 top-full z-50 mt-1 min-w-[10rem] rounded-lg border border-cyan-500/20 bg-slate-900/95 py-1 shadow-xl backdrop-blur-xl transition-all duration-200 group-hover:opacity-100 group-hover:pointer-events-auto ${knowledgeOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
                >
                  <a href="/knowledge/ai" className="block px-4 py-2.5 text-left text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300">AI 知识</a>
                  <a href="/knowledge/insights" className="block px-4 py-2.5 text-left text-slate-300 hover:bg-cyan-500/10 hover:text-cyan-300">资讯收集</a>
                </div>
              </div>
              <a href="#about" className="nav-link text-slate-300 hover:text-cyan-300">关于我</a>
            </nav>
            <FontSizeSwitcher />
          </div>
        </header>

        <section id="hero" className="scroll-mt-20 py-16 sm:py-20">
          <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-50 sm:text-4xl md:text-5xl" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            4年经验 AI 项目经理 | Vibe Coding 重度实践者
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-400">
            擅长利用 AI Agent 构建商业级闭环，极低成本验证产品假设。
          </p>
          <p className="mt-2 text-sm text-slate-500">Agentic Workflow · Rapid Validation · Production-ready Delivery</p>
          <div className="mt-10 flex flex-wrap gap-4">
            <a href="/resume.pdf" className="glow-btn glow-btn--primary glow-btn--resume">查看简历</a>
            <a href="/#projects" className="glow-btn glow-btn--secondary">核心项目</a>
            <a href="/#featured" className="glow-btn glow-btn--secondary">特色项目</a>
            <a href="/#knowledge" className="glow-btn glow-btn--secondary">AI知识沉淀</a>
            <a href="/#insights" className="glow-btn glow-btn--secondary">资讯收集</a>
          </div>
          <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-black/20 p-3 backdrop-blur-xl">
            <div className="mb-2 text-[11px] font-mono uppercase tracking-widest text-cyan-300/90">
              Latest Tech Stack
            </div>
            <div className="stack-marquee">
              <div className="stack-marquee-track">
                {["Claude Code (CC)", "OpenClaw", "Cursor", "Vercel", "Windsurf", "LangChain", "Next.js App Router", "Tailwind CSS"].map((s) => (
                  <span key={`a-${s}`} className="tech-tag">{s}</span>
                ))}
                {["Claude Code (CC)", "OpenClaw", "Cursor", "Vercel", "Windsurf", "LangChain", "Next.js App Router", "Tailwind CSS"].map((s) => (
                  <span key={`b-${s}`} className="tech-tag">{s}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="scroll-mt-20 py-12">
          <h2 className="text-xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            关于我
          </h2>
          <p className="mt-2 text-sm text-slate-500">About · New Paradigm</p>
          <div className="holo-card mt-6 rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-xl">
            <p className="text-sm leading-relaxed text-slate-400">
              我专注将 Agentic Workflow 与业务闭环深度结合，持续用 Vibe Coding + Rapid Validation 模式，把复杂想法快速转化为可运行、可验证、可迭代的商业级 AI 产品。
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-cyan-500/15 bg-black/20 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">Vibe Coding 深度实践</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  能熟练利用 Claude Code (CC) 与 Cursor 完成产品从 0 到 1 的全流程。独立完成需求梳理、UI 设计、前后端开发及 Vercel 自动化部署。
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-black/20 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">AI Agent 提效专家</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  深度使用 OpenClaw、Claude Code 等前沿 Agent 工具优化业务流。具备通过 AI 自动化工作流提升团队 5-10 倍交付效率的实战经验。
                </p>
              </div>
              <div className="rounded-xl border border-cyan-500/15 bg-black/20 p-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">快速原型验证</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  拥有在 24 小时内将商业想法转化为可运行产品的“极速交付”能力，快速验证需求与价值闭环。
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-cyan-500/15 bg-black/20 p-4">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">AI-Native Stack</h3>
              <p className="mt-2 text-sm text-slate-400">
                Tools
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["Claude Code (CC)", "OpenClaw", "Cursor", "Vercel", "Windsurf"].map((item) => (
                  <span key={item} className="tech-tag">{item}</span>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-400">
                Frameworks
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {["LangChain", "Next.js (App Router)", "Tailwind CSS"].map((item) => (
                  <span key={item} className="tech-tag">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="projects" className="scroll-mt-20 py-12">
          <h2 className="text-xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            核心项目展示
          </h2>
          <p className="mt-2 text-sm text-slate-500">Flagship Projects</p>
          <div className="mt-8 space-y-6">
            <article className="holo-card rounded-2xl border border-cyan-500/20 bg-black/20 overflow-hidden backdrop-blur-xl">
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-50 sm:text-xl" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                      金融合规智能助手
                    </h3>
                    <p className="mt-1 text-sm font-mono text-slate-500">Financial Compliance Intelligent Assistant</p>
                  </div>
                  <span className="status-badge status-badge--ready">READY</span>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-slate-400">
                  A RAG-based AI agent for intelligent Q&A and audit assistance in financial institutions. 将复杂规则审计时间显著缩短，关键合规问答可溯源到具体条款与解释。
                </p>
              </div>
              <div className="grid gap-4 border-t border-white/10 p-6 sm:grid-cols-3 sm:p-8">
                <div className="holo-card-inner rounded-xl border border-cyan-500/15 bg-black/20 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">目标用户与痛点</h4>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                    <li>· 合规/内控：法规口径不一致、解释成本高</li>
                    <li>· 业务/产品：需求变更频繁、边界难对齐</li>
                    <li>· 审计：缺少可追溯证据链与可复核记录</li>
                  </ul>
                </div>
                <div className="holo-card-inner rounded-xl border border-cyan-500/15 bg-black/20 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">核心业务模块</h4>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                    <li>· 法规知识库：条款拆解、版本管理、标签体系</li>
                    <li>· 合规问答：引用到条款/解释口径/案例</li>
                    <li>· 审计工作台：可追溯对话、结论复核与导出</li>
                  </ul>
                </div>
                <div className="holo-card-inner rounded-xl border border-cyan-500/15 bg-black/20 p-4">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">底层架构设计</h4>
                  <ul className="mt-3 space-y-1.5 text-sm text-slate-300">
                    <li>· RAG：法规切片 + 向量检索 + 结构化引用</li>
                    <li>· Agent：工具调用编排、权限与操作审计</li>
                    <li>· 证据链：来源/版本/置信度/决策日志全记录</li>
                  </ul>
                </div>
              </div>
              <p className="border-t border-white/10 px-6 py-4 text-sm text-slate-300 sm:px-8">
                ▶ 业务成效：构建 RAG 自动化评测集，合规审查耗时缩减 40%，实现 100% 溯源审计。
              </p>
              <div className="border-t border-white/10 px-6 py-4 sm:px-8">
                <div className="flex flex-wrap gap-2">
                  <span className="tech-tag">Built with AI Agent</span>
                  <span className="tech-tag">NotebookLM-inspired</span>
                  <span className="tech-tag">RAG</span>
                  <span className="tech-tag">LLMOps</span>
                  <span className="tech-tag">Vector DB</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section id="featured" className="scroll-mt-20 py-12">
          <h2 className="text-xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            特色项目展示
          </h2>
          <p className="mt-2 text-sm text-slate-500">Featured Projects</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            <article className="holo-card rounded-2xl border border-cyan-500/20 bg-black/20 p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                  NotebookLM 工作流实践
                </h3>
                <span className="shrink-0 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-amber-200/90">Experiment</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                多源资料导入、结构化知识图与 RAG pipeline 的端到端产品化实践，输出可复用的工作流模板。
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="tech-tag">Built with AI Agent</span>
                <span className="tech-tag">NotebookLM</span>
                <span className="tech-tag">RAG</span>
              </div>
            </article>
            <article className="holo-card rounded-2xl border border-cyan-500/20 bg-black/20 p-5 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                  Agent 决策逻辑设计
                </h3>
                <span className="shrink-0 rounded-full border border-purple-500/40 bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono uppercase text-purple-200/90">Design</span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                多工具、多角色、多阶段的 Agent 决策图设计，兼顾自动化执行与可解释、可审计的边界控制。
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="tech-tag">Built with AI Agent</span>
                <span className="tech-tag">Agents</span>
                <span className="tech-tag">Workflow</span>
              </div>
            </article>
          </div>
        </section>

        <section id="knowledge" className="scroll-mt-20 py-12">
          <h2 className="text-xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            AI 知识沉淀
          </h2>
          <p className="mt-2 text-sm text-slate-500">Best Practices &amp; Curation</p>
          <div className="mt-8 grid gap-6 sm:grid-cols-2">
            {articlesLoading ? (
              <>
                {[1, 2].map((i) => (
                  <div key={i} className="holo-card rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-xl">
                    <div className="knowledge-loading-skeleton h-6 w-3/4 rounded bg-slate-600/50" />
                    <div className="knowledge-loading-skeleton mt-3 h-4 w-full rounded bg-slate-600/40" />
                    <div className="knowledge-loading-skeleton mt-2 h-4 w-5/6 rounded bg-slate-600/40" />
                    <div className="knowledge-loading-skeleton mt-6 h-3 w-24 rounded bg-cyan-500/30" />
                  </div>
                ))}
              </>
            ) : (
              articles.map((article) => (
                <Link
                  key={article.id}
                  href={`/articles/${article.id}`}
                  prefetch
                  className="holo-card group block rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-xl transition hover:border-cyan-400/30"
                >
                  <h3 className="text-lg font-semibold text-slate-50 group-hover:text-cyan-300" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
                    {article.title}
                  </h3>
                  <p className="mt-2 text-sm text-slate-400">
                    {article.summary}
                  </p>
                  <span className="mt-4 inline-block text-xs font-medium text-cyan-400/90">进入详情 →</span>
                </Link>
              ))
            )}
          </div>
        </section>

        <section id="insights" className="scroll-mt-20 py-12">
          <h2 className="text-xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            资讯收集
          </h2>
          <p className="mt-2 text-sm text-slate-500">Industry News &amp; Technical Radar</p>
          <AINewsWidget news={news} />
        </section>

        <footer className="border-t border-white/10 pt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} 龚梦星 Gong Mengxing · AI 产品经理
        </footer>
      </div>

      <a
        href="#"
        className="chat-fab"
        aria-label="小龙虾 AI 助手"
        title="小龙虾 AI 助手"
      >
        <svg className="chat-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </a>

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
          transition: box-shadow 0.3s ease, border-color 0.2s ease;
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
        .holo-card {
          box-shadow: 0 0 0 1px rgba(6,182,212,0.12), 0 0 0 1px rgba(176,38,255,0.08), 0 0 24px rgba(6,182,212,0.08), 0 0 48px rgba(176,38,255,0.05);
          animation: holo-pulse 4s ease-in-out infinite;
        }
        @keyframes holo-pulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(6,182,212,0.12), 0 0 0 1px rgba(176,38,255,0.08), 0 0 24px rgba(6,182,212,0.08), 0 0 48px rgba(176,38,255,0.05); }
          50% { box-shadow: 0 0 0 1px rgba(6,182,212,0.2), 0 0 0 1px rgba(176,38,255,0.12), 0 0 32px rgba(6,182,212,0.12), 0 0 56px rgba(176,38,255,0.08); }
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
          animation: stack-scroll 24s linear infinite;
        }
        @keyframes stack-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
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
        .chat-fab {
          position: fixed; right: 1.5rem; bottom: 1.5rem; z-index: 50;
          display: flex; align-items: center; justify-content: center;
          width: 3.5rem; height: 3.5rem; border-radius: 50%;
          background: rgba(6,182,212,0.15); border: 1px solid rgba(6,182,212,0.5);
          color: rgb(165 243 252); cursor: pointer; transition: transform 0.2s ease;
          box-shadow: 0 0 0 2px rgba(6,182,212,0.2), 0 0 24px rgba(6,182,212,0.25), 0 0 48px rgba(6,182,212,0.15);
          animation: chat-fab-breathe 2.5s ease-in-out infinite;
        }
        .chat-fab:hover { transform: scale(1.05); }
        .chat-fab-icon { width: 1.5rem; height: 1.5rem; }
        @keyframes chat-fab-breathe {
          0%, 100% { box-shadow: 0 0 0 2px rgba(6,182,212,0.2), 0 0 24px rgba(6,182,212,0.25), 0 0 48px rgba(6,182,212,0.15); }
          50% { box-shadow: 0 0 0 2px rgba(6,182,212,0.4), 0 0 32px rgba(6,182,212,0.4), 0 0 64px rgba(6,182,212,0.25); }
        }
        .knowledge-loading-skeleton {
          animation: knowledge-skeleton 1.5s ease-in-out infinite;
        }
        @keyframes knowledge-skeleton {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 1; }
        }

        .cursor-star {
          position: fixed;
          left: 0;
          top: 0;
          z-index: 60;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          pointer-events: none;
          opacity: 1;
          mix-blend-mode: screen;
          transform: translate3d(-50%, -50%, 0) scale(1);
          filter: drop-shadow(0 0 26px rgba(6,182,212,0.75)) drop-shadow(0 0 36px rgba(176,38,255,0.45));
          transition: opacity 120ms ease, transform 120ms ease, filter 120ms ease;
          animation: cursor-star-glow 1.6s ease-in-out infinite;
        }

        .cursor-star::before,
        .cursor-star::after {
          content: "";
          position: absolute;
          left: 50%;
          top: 50%;
          width: 2.4px;
          height: 2.4px;
          border-radius: 9999px;
          transform: translate(-50%, -50%);
          background: rgba(165,243,252,0.95);
          box-shadow:
            0 0 28px rgba(6,182,212,0.98),
            -4px -3px 0 rgba(165,243,252,0.86),
            -3px -6px 0 rgba(6,182,212,0.7),
            4px -4px 0 rgba(176,38,255,0.7),
            6px -1px 0 rgba(165,243,252,0.78),
            3px 6px 0 rgba(6,182,212,0.7),
            -4px 4px 0 rgba(176,38,255,0.6),
            -2px 3px 0 rgba(165,243,252,0.64);
        }

        .cursor-star::after {
          background: rgba(176,38,255,0.9);
          box-shadow:
            0 0 32px rgba(176,38,255,0.96),
            -7px 1px 0 rgba(165,243,252,0.5),
            -4px 7px 0 rgba(165,243,252,0.66),
            2px 7px 0 rgba(165,243,252,0.48),
            7px 4px 0 rgba(176,38,255,0.62),
            5px -7px 0 rgba(176,38,255,0.44);
          opacity: 1;
        }

        @keyframes cursor-star-glow {
          0%, 100% { filter: drop-shadow(0 0 26px rgba(6,182,212,0.75)) drop-shadow(0 0 36px rgba(176,38,255,0.45)); }
          50% { filter: drop-shadow(0 0 32px rgba(6,182,212,0.9)) drop-shadow(0 0 46px rgba(176,38,255,0.55)); }
        }

        .cursor-star--active {
          width: 26px;
          height: 26px;
          opacity: 1;
          transform: translate3d(-50%, -50%, 0) scale(2.1);
          filter: drop-shadow(0 0 28px rgba(6,182,212,0.98)) drop-shadow(0 0 44px rgba(176,38,255,0.78));
        }

        .gmx-main { cursor: default; }
        @media (pointer: fine) {
          .gmx-main { cursor: none; }
        }
      `}</style>
    </main>
  );
}
