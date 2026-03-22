import Link from "next/link";
import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";

export default function ProjectsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/"
            className="text-sm font-medium text-slate-400 transition hover:text-cyan-300"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            ← 返回首页
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500"
              style={{ fontFamily: '"IBM Plex Mono", "SF Mono", monospace' }}
            >
              Projects
            </div>
            <FontSizeSwitcher />
          </div>
        </header>
        <main className="py-10">{children}</main>
      </div>
    </div>
  );
}

