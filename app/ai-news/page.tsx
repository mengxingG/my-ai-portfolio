import Link from "next/link";
import { Sparkles } from "lucide-react";
import { fetchAINewsRadarFromNotion, type AINews } from "@/utils/notion";
import AINewsRadarClient from "./AINewsRadarClient";
import StarfieldBackground from "@/app/components/StarfieldBackground";

export default async function AINewsRadar() {
  let newsList: AINews[] = [];
  try {
    newsList = await fetchAINewsRadarFromNotion();
  } catch {
    newsList = [];
  }

  return (
    <div className="relative min-h-screen text-slate-100 antialiased selection:bg-cyan-500/30">
      <StarfieldBackground />
      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-12 border-b border-white/10 pb-8">
          <Link
            href="/"
            className="mb-6 inline-block text-sm font-medium text-slate-400 transition hover:text-cyan-300"
          >
            ← 返回首页
          </Link>
          <div className="flex items-center gap-3">
            <Sparkles className="h-8 w-8 text-cyan-400" />
            <h1 className="text-3xl font-bold tracking-tight text-slate-50 sm:text-4xl">
              AI 资讯雷达
            </h1>
          </div>
          <p className="mt-4 max-w-2xl text-slate-400">
            全自动收集全球顶级 AI 研究员与权威媒体的最新动态，由大模型自动清洗、翻译并生成一句话摘要。
          </p>
        </header>

        {newsList.length === 0 ? (
          <p className="text-sm text-slate-500">暂无已发布的资讯。</p>
        ) : (
          <AINewsRadarClient news={newsList} />
        )}
      </div>
    </div>
  );
}
