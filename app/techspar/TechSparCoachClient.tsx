"use client";

import Link from "next/link";
import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";
import BreathingParticles from "@/components/BreathingParticles";
import ReflectBackground from "@/components/ReflectBackground";

export default function TechSparCoachClient() {
  return (
    <main className="reflect-theme-shell relative min-h-screen text-bento-text antialiased">
      <BreathingParticles />
      <ReflectBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
        <header className="liquid-glass-nav reflect-nav sticky top-4 z-[45] flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/[0.08] px-4 py-4 shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur sm:px-5">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-bento-text transition hover:text-purple-200"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            ← 返回首页
          </Link>
          <div className="flex items-center gap-4">
            <span
              className="hidden text-xs font-mono uppercase tracking-[0.2em] text-purple-200/75 sm:inline"
              style={{ fontFamily: '"IBM Plex Mono", "SF Mono", monospace' }}
            >
              TechSpar
            </span>
            <FontSizeSwitcher />
          </div>
        </header>

        <section className="relative isolate mt-10 sm:mt-14">
          <div className="pointer-events-none absolute -left-[12%] top-[-18%] h-[420px] w-[420px] rounded-full bg-purple-600/14 blur-[120px]" />
          <div className="pointer-events-none absolute right-[-8%] top-[20%] h-[360px] w-[360px] rounded-full bg-fuchsia-500/10 blur-[100px]" />

          <div className="relative">
            <div className="reflect-section-kicker mb-4 inline-flex">模拟面试</div>
            <h1
              className="text-3xl font-semibold tracking-tight text-bento-text sm:text-4xl"
              style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
            >
              TechSpar 面试教练
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bento-muted sm:text-base">
              结构化行为题与技术追问、STAR 拆解与复盘建议。本页为独立入口，视觉与首页一致的紫色深空主题。
            </p>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1fr_320px]">
              <div className="liquid-glass-card rounded-2xl border border-purple-400/20 bg-gradient-to-br from-white/[0.06] via-purple-500/[0.05] to-cyan-500/[0.04] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)] sm:p-8">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90">
                  开始练习
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-bento-muted">
                  完整「资料 + 费曼 / 面试官」流程在 Learning 工作台。你可从下方进入，带上当前知识条目后继续模拟面试。
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/learning"
                    className="inline-flex items-center justify-center rounded-xl border border-purple-400/35 bg-purple-500/15 px-5 py-2.5 text-sm font-semibold text-purple-100 transition hover:bg-purple-500/25"
                  >
                    进入 Learning 面试模式
                  </Link>
                  <Link
                    href="/knowledge"
                    className="inline-flex items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-white/[0.08]"
                  >
                    Learning Dashboard
                  </Link>
                </div>
              </div>

              <aside className="liquid-glass-card rounded-2xl border border-white/10 bg-black/25 p-6">
                <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200/85">
                  能力维度
                </h2>
                <ul className="mt-4 space-y-3 text-sm text-bento-muted">
                  <li className="flex gap-2">
                    <span className="text-purple-300/90">·</span>
                    <span>系统设计表述与权衡</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-300/90">·</span>
                    <span>项目深挖与指标闭环</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-purple-300/90">·</span>
                    <span>协作、冲突与复盘</span>
                  </li>
                </ul>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
