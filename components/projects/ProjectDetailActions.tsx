import Link from "next/link";

const btnBase =
  "inline-flex h-10 box-border items-center justify-center rounded-xl px-5 text-center text-sm font-medium leading-none transition-all duration-300 ease-out sm:h-11";

const btnBack = `${btnBase} border border-blue-500/40 bg-blue-500/12 text-blue-100 hover:border-blue-400/55 hover:bg-blue-500/22 hover:text-white`;

const btnStart = `${btnBase} border border-blue-400/50 bg-blue-600/28 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-300/60 hover:bg-blue-500/38 hover:shadow-[0_0_28px_rgba(59,130,246,0.28)]`;

type ProjectDetailActionsProps = {
  startHref: string;
  startExternal?: boolean;
  className?: string;
};

export function ProjectDetailActions({
  startHref,
  startExternal,
  className = "",
}: ProjectDetailActionsProps) {
  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`.trim()}>
      <Link href="/" className={btnBack}>
        返回主界面
      </Link>
      {startExternal ? (
        <a href={startHref} target="_blank" rel="noopener noreferrer" className={btnStart}>
          开始使用
        </a>
      ) : (
        <Link href={startHref} className={btnStart}>
          开始使用
        </Link>
      )}
    </div>
  );
}
