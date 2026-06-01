"use client";

import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CONTACT_LINKS } from "@/lib/contact-links";

const SPRING_SNAPPY = { type: "spring" as const, stiffness: 148, damping: 20, mass: 0.7 };

const BTN_CLASS =
  "glow-btn inline-flex shrink-0 items-center justify-center whitespace-nowrap !px-3.5 !py-1.5 !text-xs sm:!px-4 sm:!py-2";

type HeroBtnProps = {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  resume?: boolean;
};

function HeroBtn({ href, children, variant = "secondary", resume }: HeroBtnProps) {
  const reduced = useReducedMotion() === true;
  const className = [
    BTN_CLASS,
    variant === "primary" ? "glow-btn--primary" : "glow-btn--secondary",
    resume ? "glow-btn--resume" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <motion.a
      href={href}
      whileHover={reduced ? undefined : { scale: 1.03 }}
      whileTap={{ scale: 0.98 }}
      transition={SPRING_SNAPPY}
      className={className}
    >
      {children}
    </motion.a>
  );
}

export function HeroActionButtons({ className = "" }: { className?: string }) {
  return (
    <div
      className={[
        "mt-10 flex w-full justify-center sm:mt-12",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="grid grid-cols-2 justify-items-center gap-x-4 gap-y-3 sm:grid-cols-4 sm:gap-x-5">
        <HeroBtn href={CONTACT_LINKS.resume} variant="primary" resume>
          查看简历
        </HeroBtn>
        <HeroBtn href="#contact">联系我</HeroBtn>
        <HeroBtn href="/#featured-projects">特色项目</HeroBtn>
        <HeroBtn href="/#insights">资讯收集</HeroBtn>
      </div>
    </div>
  );
}
