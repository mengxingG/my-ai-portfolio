import Link from "next/link";
import { ArrowLeft } from "lucide-react";

type Props = {
  className?: string;
  label?: string;
};

/** 返回作品集首页 `/` */
export function BackToHomeLink({ className = "", label = "返回主界面" }: Props) {
  return (
    <Link
      href="/"
      className={[
        "inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-cyan-200",
        className,
      ].join(" ")}
    >
      <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
      {label}
    </Link>
  );
}
