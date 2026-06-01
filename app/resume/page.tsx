import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import ReflectBackground from "@/components/ReflectBackground";
import { ResumeMarkdown } from "@/components/ResumeMarkdown";
import { getResumeMarkdown } from "@/lib/resume-markdown";
import { RESUME_PDF_PATH } from "@/lib/resume-data";

export const metadata = {
  title: "简历 · 龚梦星",
  description:
    "龚梦星 AI 产品经理简历：花旗 AI 合规产品经验 + 5 款独立 AI 产品全链路交付。",
};

export default function ResumePage() {
  const markdown = getResumeMarkdown();

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050505] text-bento-text">
      <ReflectBackground />
      <div className="site-content-shell relative z-[1] mx-auto w-full px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-white/10 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-bento-muted transition hover:text-cyan-300"
          >
            ← 返回主界面
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={RESUME_PDF_PATH}
              download="龚梦星_AI产品经理_简历.pdf"
              className="glow-btn glow-btn--primary inline-flex items-center gap-2 !px-4 !py-2 !text-sm"
            >
              <Download className="h-4 w-4" aria-hidden />
              下载 PDF
            </a>
            <a
              href={RESUME_PDF_PATH}
              target="_blank"
              rel="noopener noreferrer"
              className="glow-btn glow-btn--secondary inline-flex items-center gap-2 !px-4 !py-2 !text-sm"
            >
              <ExternalLink className="h-4 w-4" aria-hidden />
              新窗口打开 PDF
            </a>
          </div>
        </header>

        <article id="resume-content" className="mx-auto max-w-5xl print:max-w-none">
          <ResumeMarkdown markdown={markdown} />
        </article>

        <p className="mx-auto mt-8 max-w-5xl text-center text-xs text-zinc-600 print:hidden">
          内容源：resume/resume.md · 网页版与 PDF 同步更新
        </p>
      </div>
    </div>
  );
}
