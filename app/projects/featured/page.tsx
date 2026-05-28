import Link from "next/link";
import { FeaturedProjectsWaterfall } from "@/components/FeaturedProjectsWaterfall";

export const metadata = {
  title: "特色项目 · 龚梦星",
  description: "AI PM 独立开发项目：Job Engine、AI News Radar、费曼学习、InterviewOS、横纵分析法",
};

export default function FeaturedProjectsPage() {
  return (
    <div className="min-w-0">
      <div className="mb-12 border-b border-white/10 pb-8">
        <p className="text-sm font-medium tracking-wide text-purple-400/95">Portfolio</p>
        <h1
          className="mt-2 text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl"
          style={{ fontFamily: '"Geist", "SF Pro Display", system-ui, sans-serif' }}
        >
          特色项目
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          个人独立开发的 Agentic Workflow 产品矩阵：飞书 ChatOps、OpenClaw 背调、Notion 数据中台与 Next.js 极客风前端。
        </p>
        <Link
          href="/#featured-projects"
          className="mt-4 inline-block text-sm font-medium text-cyan-300/90 transition hover:text-cyan-200 hover:underline"
        >
          ← 返回首页特色项目区块
        </Link>
      </div>

      <FeaturedProjectsWaterfall />
    </div>
  );
}
