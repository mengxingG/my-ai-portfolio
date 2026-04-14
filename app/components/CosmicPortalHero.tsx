"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import Particles from "@tsparticles/react";
import { initParticlesEngine } from "@tsparticles/react";
import { loadSlim } from "@tsparticles/slim";
import type { ISourceOptions } from "@tsparticles/engine";

type CosmicPortalHeroProps = {
  className?: string;
  particleCount?: number;
};

/**
 * Hero 顶部传送门：强发光地平线 + 半圆弧 + 轻量粒子漂浮。
 * 粒子参数使用可复现公式，避免 SSR/CSR 随机不一致。
 */
export function CosmicPortalHero({
  className = "",
  particleCount = 30,
}: CosmicPortalHeroProps) {
  const [particlesReady, setParticlesReady] = useState(false);

  useEffect(() => {
    initParticlesEngine(async (engine) => {
      await loadSlim(engine);
    }).then(() => setParticlesReady(true));
  }, []);

  const particleOptions = useMemo<ISourceOptions>(
    () => ({
      fullScreen: { enable: false },
      detectRetina: true,
      fpsLimit: 60,
      particles: {
        number: {
          value: particleCount,
          density: { enable: true, width: 900, height: 400 },
        },
        color: { value: ["#ffffff", "#f5d0fe", "#ddd6fe"] },
        opacity: {
          value: { min: 0.05, max: 0.34 },
          animation: {
            enable: true,
            speed: 0.18,
            minimumValue: 0.04,
            sync: false,
          },
        },
        size: {
          value: { min: 0.8, max: 2.8 },
        },
        move: {
          enable: true,
          speed: { min: 0.08, max: 0.3 },
          direction: "top",
          random: true,
          outModes: { default: "out" },
          drift: { min: -0.2, max: 0.2 },
        },
      },
      interactivity: { events: { onHover: { enable: false }, resize: { enable: true } } },
      background: { color: "transparent" },
    }),
    [particleCount]
  );

  return (
    <section
      aria-hidden
      className={`pointer-events-none absolute left-0 top-0 -z-10 h-[640px] w-full overflow-hidden ${className}`}
      style={{
        maskImage:
          "linear-gradient(to bottom, black 0%, black 56%, rgba(0,0,0,0.12) 72%, transparent 88%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, black 0%, black 56%, rgba(0,0,0,0.12) 72%, transparent 88%)",
      }}
    >
      <div className="absolute inset-0 bg-[#020205]" />
      <div className="absolute inset-0 bg-[radial-gradient(88%_50%_at_50%_20%,rgba(24,12,52,0.16)_0%,rgba(5,4,12,0.08)_44%,rgba(2,2,5,0)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(2,2,8,0)_0%,rgba(2,2,8,0)_46%,rgba(2,2,8,0.34)_100%)]" />

      {/* Portal dome body (more compact, closer to reference) */}
      <div className="absolute left-1/2 top-[182px] h-[324px] w-[650px] max-w-[90vw] -translate-x-1/2 overflow-hidden rounded-[999px_999px_420px_420px]">
        <div className="absolute inset-0 mix-blend-screen bg-[radial-gradient(ellipse_at_50%_118%,rgba(248,232,255,0.9)_0%,rgba(216,180,254,0.52)_14%,rgba(168,85,247,0.25)_34%,rgba(88,28,135,0.14)_54%,rgba(0,0,0,0)_84%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_100%,rgba(221,214,254,0.2)_0%,rgba(139,92,246,0.08)_36%,rgba(0,0,0,0)_78%)] mix-blend-lighten" />
        <motion.div
          className="absolute left-1/2 bottom-[-8px] h-[154px] w-[226px] -translate-x-1/2 rounded-[999px_999px_0_0] border border-[#f3e8ff]/30 bg-[radial-gradient(ellipse_at_50%_100%,rgba(248,232,255,0.42)_0%,rgba(192,132,252,0.14)_46%,rgba(0,0,0,0)_90%)] mix-blend-screen"
          animate={{ opacity: [0.34, 0.5, 0.34], y: [0, -1, 0] }}
          transition={{ duration: 5.4, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Mercator-like longitudinal lines via SVG */}
        <svg
          className="absolute inset-0 h-full w-full opacity-22 mix-blend-screen"
          viewBox="0 0 1000 620"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="meridianFade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.00)" />
              <stop offset="22%" stopColor="rgba(221,214,254,0.2)" />
              <stop offset="72%" stopColor="rgba(221,214,254,0.1)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </linearGradient>
            <mask id="domeMask">
              <rect width="100%" height="100%" fill="black" />
              <ellipse cx="500" cy="590" rx="385" ry="320" fill="white" />
            </mask>
          </defs>
          <g mask="url(#domeMask)">
            {Array.from({ length: 11 }).map((_, idx) => {
              const x = 180 + idx * 64;
              const curve = (idx - 5) * 8;
              return (
                <path
                  key={`m-${idx}`}
                  d={`M ${x} 20 Q ${x + curve} 300 ${x} 610`}
                  stroke="url(#meridianFade)"
                  strokeWidth="1"
                  fill="none"
                />
              );
            })}
          </g>
        </svg>
      </div>

      {/* Crisp luminous edge with pulse */}
      <motion.div
        className="absolute left-1/2 top-[508px] h-px w-[640px] max-w-[86vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#f7ecff] to-transparent mix-blend-screen"
        animate={{ opacity: [0.76, 1, 0.76], y: [0, -0.5, 0] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute left-1/2 top-[506px] h-[7px] w-[700px] max-w-[90vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#d8b4fe]/28 to-transparent blur-[6px] mix-blend-screen"
        animate={{ opacity: [0.14, 0.28, 0.14] }}
        transition={{ duration: 4.6, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
      />
      <motion.div
        className="absolute left-1/2 top-[507px] h-[2px] w-[520px] max-w-[72vw] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-[#faf5ff]/70 to-transparent blur-[1px] mix-blend-screen"
        animate={{ opacity: [0.18, 0.32, 0.18] }}
        transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />

      {/* Broad supporting glow around edge */}
      <div className="absolute left-1/2 top-[496px] h-[132px] w-[800px] max-w-[106vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_32%,rgba(168,85,247,0.11)_0%,rgba(126,34,206,0.04)_34%,rgba(0,0,0,0)_88%)] opacity-22 blur-[114px] mix-blend-screen" />

      {/* Reflection */}
      <div className="absolute left-1/2 top-[534px] h-[96px] w-[480px] max-w-[72vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(216,180,254,0.18)_0%,rgba(168,85,247,0.06)_32%,rgba(0,0,0,0)_90%)] opacity-30 blur-[76px] mix-blend-screen" />
      <div className="absolute left-1/2 top-[560px] h-[120px] w-[660px] max-w-[84vw] -translate-x-1/2 bg-[linear-gradient(to_bottom,rgba(168,85,247,0.06),rgba(2,2,5,0))] opacity-12 blur-[30px]" />
      <div className="absolute left-1/2 top-[580px] h-[66px] w-[360px] max-w-[62vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_50%_0%,rgba(233,213,255,0.13)_0%,rgba(0,0,0,0)_88%)] opacity-26 blur-[56px] mix-blend-screen" />

      {/* keep text contrast safe in center */}
      <div className="absolute left-1/2 top-[84px] h-[280px] w-[56vw] min-w-[320px] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center,rgba(2,2,8,0.75)_0%,rgba(2,2,8,0.47)_56%,rgba(2,2,8,0)_100%)]" />

      {/* Open-source particle layer (tsParticles), tinted to reference purple palette */}
      {particlesReady ? (
        <div
          className="absolute left-1/2 top-[206px] h-[250px] w-[580px] max-w-[82vw] -translate-x-1/2 [mask-image:radial-gradient(ellipse_at_50%_92%,black_0%,black_72%,transparent_100%)]"
        >
          <Particles options={particleOptions} className="h-full w-full" />
        </div>
      ) : null}

      {/* subtle grain to avoid flat gradients */}
      <div className="absolute inset-0 opacity-[0.08] mix-blend-soft-light bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.26)_0_0.4px,transparent_0.6px),radial-gradient(circle_at_70%_60%,rgba(221,214,254,0.2)_0_0.35px,transparent_0.55px)] [background-size:3px_3px,4px_4px]" />
    </section>
  );
}
