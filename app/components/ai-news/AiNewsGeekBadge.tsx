import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  variant?: "source" | "category";
  className?: string;
};

export function AiNewsGeekBadge({ children, variant = "source", className = "" }: Props) {
  const base =
    variant === "category"
      ? "border-violet-400/35 bg-violet-500/10 text-violet-200 shadow-[0_0_12px_rgba(139,92,246,0.15)]"
      : "border-cyan-400/35 bg-cyan-500/10 text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.12)]";

  return (
    <span
      className={`inline-flex max-w-full items-center truncate rounded-md border px-2 py-0.5 text-[10px] font-medium tracking-wide backdrop-blur-sm ${base} ${className}`}
    >
      {children}
    </span>
  );
}
