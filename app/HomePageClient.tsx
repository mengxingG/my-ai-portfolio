"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionTemplate,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { AINewsWidget } from "@/app/components/AINewsWidget";
import { FeaturedProjectsWaterfall } from "@/components/FeaturedProjectsWaterfall";
import { FeaturedProjectsProgressBar } from "@/components/FeaturedProjectsProgressBar";
import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";
import { PortfolioHeroIntro } from "@/components/PortfolioHeroIntro";
import { HomeTechStack } from "@/components/HomeTechStack";
import { ContactSection } from "@/components/ContactSection";
import { AboutSection } from "@/components/AboutSection";
import { HOMEPAGE_TECH_STACK_NAMES } from "@/lib/featured-project-tech-stack";
import BreathingParticles from "@/components/BreathingParticles";
import ReflectBackground from "@/components/ReflectBackground";
import type { AINews } from "@/utils/notion";


export default function HomePageClient({ news }: { news: AINews[] }) {
  const prefersReducedMotion = useReducedMotion();
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
      <div className="site-content-shell relative z-10 mx-auto w-full px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
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
              initial="hidden"
              animate="show"
              variants={sectionVariants}
              className="flex items-center gap-4 text-sm font-medium text-bento-muted"
            >
              <a href="#hero" className="nav-link text-bento-muted hover:text-bento-text">首页</a>
              <a href="#featured-projects" className="nav-link text-bento-muted hover:text-bento-text">特色项目</a>
              <a href="#insights" className="nav-link text-bento-muted hover:text-bento-text">资讯收集</a>
              <a href="#about" className="nav-link text-bento-muted hover:text-bento-text">关于我</a>
              <a href="#contact" className="nav-link text-bento-muted hover:text-bento-text">联系我</a>
            </motion.nav>
            <FontSizeSwitcher />
          </div>
        </motion.header>

        <motion.section
          id="hero"
          className="reflect-stage reflect-stage--hero relative isolate overflow-hidden scroll-mt-20 flex flex-col items-center py-10 text-center sm:py-14 md:py-16"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.25 }}
          variants={sectionVariants}
        >
          <motion.div className="relative z-10 flex w-full flex-col items-center">
            <motion.div variants={itemVariants} className="w-full">
              <PortfolioHeroIntro />
            </motion.div>

          <motion.div
            variants={itemVariants}
            className="mt-8 -mx-4 w-[calc(100%+2rem)] sm:mt-10 sm:-mx-6 sm:w-[calc(100%+3rem)]"
          >
            <HomeTechStack
              items={HOMEPAGE_TECH_STACK_NAMES}
              reducedMotion={hydrateSafeReducedMotion}
            />
          </motion.div>
          </motion.div>
        </motion.section>

        <motion.section
          id="featured-projects"
          className="reflect-stage reflect-stage--beam scroll-mt-20 overflow-x-clip py-10"
          data-parallax="0.012"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={sectionVariants}
        >
          <section className="w-full pb-16 pt-8">
            <span className="reflect-section-kicker">Featured</span>
            <h2
              className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl"
              style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
            >
              AI PM 的数字工作流· 个人独立开发项目
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-light text-bento-muted">
              面试教练 ｜ 岗位采集背调 ｜ 费曼学习 ｜ 深度研究 ｜ AI 资讯
            </p>
            <FeaturedProjectsProgressBar />
            <FeaturedProjectsWaterfall className="mt-10 sm:mt-14" />
            <div className="mt-8 flex justify-center sm:mt-10">
              <Link href="/projects/featured" className="glow-btn glow-btn--secondary text-sm">
                查看全部特色项目 →
              </Link>
            </div>
          </section>
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

        <AboutSection />

        <ContactSection />

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
          mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
          -webkit-mask-image: linear-gradient(to right, transparent, black 6%, black 94%, transparent);
        }
        .stack-marquee-track {
          display: flex;
          align-items: center;
          gap: 0.625rem;
          width: max-content;
          padding-block: 0.125rem;
          animation: stack-scroll 36s linear infinite;
          will-change: transform;
        }
        @keyframes stack-scroll {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .stack-marquee-track { animation: none !important; }
        }
        .contact-social-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 3.25rem;
          height: 3.25rem;
          border-radius: 9999px;
          border: 1px solid rgba(168, 85, 247, 0.45);
          background: rgba(0, 0, 0, 0.35);
          box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.15), 0 0 22px rgba(168, 85, 247, 0.22);
          transition: border-color 0.2s ease, box-shadow 0.25s ease, transform 0.2s ease;
        }
        .contact-social-btn:hover {
          border-color: rgba(192, 132, 252, 0.65);
          box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.35), 0 0 28px rgba(168, 85, 247, 0.38);
          transform: translateY(-2px);
        }
        .contact-social-btn--pending {
          opacity: 0.72;
          cursor: default;
        }
        .contact-social-btn--pending:hover {
          transform: none;
          box-shadow: 0 0 0 1px rgba(168, 85, 247, 0.15), 0 0 22px rgba(168, 85, 247, 0.22);
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
      `}</style>
    </main>
  );
}
