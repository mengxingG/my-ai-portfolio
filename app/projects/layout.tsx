import Link from "next/link";
import { FontSizeSwitcher } from "@/app/components/FontSizeSwitcher";
import ReflectBackground from "@/components/ReflectBackground";

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050505] text-bento-text">
      <ReflectBackground />
      <div className="site-content-shell relative z-[1] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/"
            className="text-sm font-medium text-bento-muted transition hover:text-cyan-300"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            ← 返回主界面
          </Link>
          <div className="flex items-center gap-4">
            <span
              className="text-xs font-mono uppercase tracking-[0.2em] text-bento-muted/70"
              style={{ fontFamily: '"IBM Plex Mono", "SF Mono", monospace' }}
            >
              项目详情
            </span>
            <FontSizeSwitcher />
          </div>
        </header>
        <main className="py-10">{children}</main>
      </div>
    </div>
  );
}
