"use client";

import { useEffect, useRef, useCallback } from "react";

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

// 星空配色与几何参数（沿用主页的 Canvas 画法）
const CYAN = "#06b6d4";
const PURPLE = "#7c3aed";
const MOUSE_RADIUS = 120;
const MOUSE_REPEL = 0.08;
const CORE_X = 2 / 3;
const CORE_Y = 0.5;
const LINK_DISTANCE_RATIO = 0.28;
const CORE_RADIUS_RATIO = 0.196;
const CORE_INNER_RATIO = 0.084;

function getGMXAnchors(): { x: number; y: number; w: number }[] {
  const anchors: { x: number; y: number; w: number }[] = [];
  const push = (x: number, y: number, w = 1) => anchors.push({ x, y, w });

  [0.28, 0.32, 0.36, 0.4, 0.44, 0.48].forEach((x, i) => push(x, 0.28 + i * 0.015, 1.2));
  [0.46, 0.5, 0.54, 0.58].forEach((x) => push(x, 0.34, 1));
  [0.58, 0.55, 0.5, 0.45, 0.4, 0.36].forEach((x, i) => push(x, 0.42 + i * 0.04, 1.2));

  push(0.34, 0.6, 1.3);
  push(0.32, 0.52, 1.2);
  push(0.28, 0.44, 1.1);

  [0.32, 0.36, 0.4].forEach((y) => push(0.38 + (y - 0.32) * 0.02, 0.3 + y * 0.25, 1));
  push(0.5, 0.48, 1.3);
  [0.6, 0.64, 0.68].forEach((x, i) => push(x, 0.3 + i * 0.18, 1));

  push(0.38, 0.32, 1.1);
  push(0.72, 0.68, 1.1);
  push(0.5, 0.5, 1.4);
  push(0.38, 0.68, 1.1);
  push(0.72, 0.32, 1.1);
  push(0.54, 0.42, 1.05);
  push(0.58, 0.58, 1.05);

  return anchors;
}

export default function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const run = useCallback(() => {
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

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
    };
    const onLeave = () => {
      mouse.active = false;
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerleave", onLeave, { passive: true });

    const drawBg = () => {
      const g = ctx.createRadialGradient(
        w / 2,
        h / 2,
        0,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.8
      );
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

        // 边界约束
        if (p.x < -20 || p.x > w + 20) p.vx *= -0.5;
        if (p.y < -20 || p.y > h + 20) p.vy *= -0.5;
        p.x = Math.max(-20, Math.min(w + 20, p.x));
        p.y = Math.max(-20, Math.min(h + 20, p.y));
      });

      // 画连线
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

      // 绘制粒子
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
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const cleanup = run();
    return () => {
      if (typeof cleanup === "function") cleanup();
    };
  }, [run]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-0 block w-full h-full"
      style={{ pointerEvents: "none" }}
      aria-hidden
    />
  );
}

