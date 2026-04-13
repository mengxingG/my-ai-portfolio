import Link from "next/link";
import { fetchAINewsRadarFromNotion, type AINews } from "@/utils/notion";
import AINewsRadarClient from "./AINewsRadarClient";
import StarfieldBackground from "@/app/components/StarfieldBackground";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AINewsRadar() {
  let newsList: AINews[] = [];
  try {
    newsList = await fetchAINewsRadarFromNotion();
  } catch {
    newsList = [];
  }

  return (
    <div className="relative min-h-screen text-slate-100 antialiased selection:bg-purple-500/30">
      <StarfieldBackground />
      <div className="pointer-events-none fixed inset-0 z-[1]" aria-hidden>
        <div className="absolute inset-0 bg-black/35" />
        <div
          className="absolute inset-0 mix-blend-screen opacity-[0.22]"
          style={{
            background:
              "radial-gradient(ellipse 120% 55% at 50% 0%, rgba(168, 85, 247, 0.35) 0%, transparent 55%), radial-gradient(ellipse 90% 50% at 80% 100%, rgba(192, 132, 252, 0.2) 0%, transparent 50%)",
          }}
        />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-6 flex flex-wrap items-center gap-4 border-b border-purple-500/15 pb-6">
          <Link
            href="/"
            className="text-sm font-medium text-slate-400 transition hover:text-purple-300"
          >
            ← 返回首页
          </Link>
          <h1
            className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl"
            style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
          >
            📡 AI 资讯雷达
          </h1>
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
