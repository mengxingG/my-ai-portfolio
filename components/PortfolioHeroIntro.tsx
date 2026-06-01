"use client";

import Image from "next/image";
import { ZCOOL_XiaoWei } from "next/font/google";
import { useEffect, useState } from "react";
import { HeroActionButtons } from "@/components/HeroActionButtons";

/** 站酷小薇：中文展示型艺术字体，适合 Slogan */
const sloganArtFont = ZCOOL_XiaoWei({
  weight: "400",
  subsets: ["latin"],
  display: "swap",
});

const TYPING_ROLES = [
  "AI Product Manager",
  "Vibe Coding Builder",
  "Agentic Workflow Designer",
] as const;

type TypewriterOptions = {
  typeMs?: number;
  deleteMs?: number;
  pauseMs?: number;
};

function useTypewriterNoun(
  words: readonly string[],
  { typeMs = 72, deleteMs = 42, pauseMs = 2400 }: TypewriterOptions = {},
) {
  const [wordIndex, setWordIndex] = useState(0);
  const [charIndex, setCharIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  const currentWord = words[wordIndex] ?? "";

  useEffect(() => {
    const blink = window.setInterval(() => setShowCursor((v) => !v), 530);
    return () => window.clearInterval(blink);
  }, []);

  useEffect(() => {
    if (!isDeleting && charIndex >= currentWord.length) {
      const pause = window.setTimeout(() => setIsDeleting(true), pauseMs);
      return () => window.clearTimeout(pause);
    }

    if (isDeleting && charIndex <= 0) {
      setIsDeleting(false);
      setWordIndex((i) => (i + 1) % words.length);
      return;
    }

    const delay = isDeleting ? deleteMs : typeMs;
    const tick = window.setTimeout(() => {
      setCharIndex((c) => c + (isDeleting ? -1 : 1));
    }, delay);

    return () => window.clearTimeout(tick);
  }, [charIndex, currentWord.length, deleteMs, isDeleting, pauseMs, typeMs, wordIndex, words.length]);

  const displayed = currentWord.slice(0, charIndex);

  return { displayed, showCursor, fullPhrase: `I'm an ${currentWord}` };
}

export function PortfolioHeroIntro() {
  const { displayed, showCursor, fullPhrase } = useTypewriterNoun(TYPING_ROLES);

  return (
    <div className="portfolio-hero-intro mx-auto w-full max-w-3xl text-center">
      {/* 问候 + 头像 */}
      <div className="relative mx-auto mb-8 flex w-full max-w-md flex-col items-center sm:max-w-lg">
        <p
          className="portfolio-hero-intro__greeting relative z-10 mb-2 text-sm font-medium text-white sm:text-base"
          style={{ fontFamily: '"Geist", "Inter", "SF Pro Text", system-ui, sans-serif' }}
        >
          Hello! I Am{" "}
          <span className="font-semibold text-violet-400">龚梦星 Gong Mengxing</span>
        </p>

        <svg
          className="portfolio-hero-intro__arrow pointer-events-none absolute -right-2 top-6 z-10 hidden h-16 w-24 text-white/70 sm:block"
          viewBox="0 0 96 64"
          fill="none"
          aria-hidden
        >
          <path
            d="M8 8 C 40 8, 72 20, 84 52"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M76 48 L84 52 L78 58"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div className="portfolio-hero-intro__avatar-wrap relative mt-6">
          <div
            className="pointer-events-none absolute inset-0 scale-125 rounded-full bg-violet-500/35 blur-2xl"
            aria-hidden
          />
          <div className="relative h-28 w-28 overflow-hidden rounded-full border-2 border-white/10 bg-zinc-900 sm:h-32 sm:w-32">
            <Image
              src="/screenshot-20251105-214648.jpg"
              alt="龚梦星 Gong Mengxing"
              fill
              className="object-cover"
              sizes="128px"
              priority
            />
          </div>
        </div>
      </div>

      {/* 个人 Slogan */}
      <p
        className={`${sloganArtFont.className} portfolio-hero-slogan mx-auto max-w-xl text-[1.65rem] leading-relaxed sm:text-3xl md:text-[2.125rem]`}
      >
        永远对世界保持好奇
      </p>

      {/* 职业身份 · 打字机 */}
      <div className="mt-10 sm:mt-12">
        <p
          className="text-xl font-bold text-white sm:text-2xl md:text-3xl"
          style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
          aria-label={fullPhrase}
        >
          <span>I&apos;m an </span>
          <span className="text-white" aria-hidden>
            {displayed}
          </span>
          <span
            className={`ml-0.5 inline-block font-light text-white ${showCursor ? "opacity-100" : "opacity-0"}`}
            aria-hidden
          >
            |
          </span>
        </p>
      </div>

      <HeroActionButtons />

      <p className="mx-auto mt-8 max-w-2xl text-left text-sm leading-relaxed text-zinc-400 sm:mt-10 sm:text-center sm:text-base sm:leading-7">
        4 年花旗交易系统经验 + AI 产品实践，专注 Agentic Workflow 与业务闭环。用 Vibe Coding 独立交付 5 款上线 AI 产品，从合规 AI 到 OpenClaw 背调引擎，全链路从 PRD 到 Vercel 部署。
      </p>
    </div>
  );
}
