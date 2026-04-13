import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  as?: "div" | "a";
  href?: string;
  target?: string;
  rel?: string;
  "aria-label"?: string;
};

/**
 * Feynman-aligned radar card: 16px radius, gradient hairline border, purple hover glow.
 */
export function AiNewsItemCard({
  children,
  className = "",
  as = "div",
  href,
  target,
  rel,
  "aria-label": ariaLabel,
}: Props) {
  const shell =
    "ai-news-radar-card group relative isolate flex flex-col justify-between overflow-hidden rounded-2xl p-5 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5";

  if (as === "a" && href) {
    // 禁止 <a> 包裹 <button>。底层链接触控铺满卡片；卡片内需为按钮包一层 pointer-events-auto。
    return (
      <div className={`${shell} ${className}`}>
        <a
            href={href}
            target={target}
            rel={rel}
            aria-label={ariaLabel}
            className="absolute inset-0 z-[1] rounded-2xl outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-400/70"
          >
            <span className="sr-only">{ariaLabel ?? "查看原文"}</span>
          </a>
        <div className="relative z-[2] min-h-0 flex-1 pointer-events-none">{children}</div>
      </div>
    );
  }
  return (
    <div className={`${shell} ${className}`}>
      {children}
    </div>
  );
}
