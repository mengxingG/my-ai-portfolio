import Link from "next/link";
import { Twitter, Youtube, ExternalLink, Clock, Sparkles } from "lucide-react";
import { fetchAINewsRadarFromNotion, type AINews } from "@/utils/notion";

export default async function AINewsRadar() {
  let newsList: AINews[] = [];
  try {
    newsList = await fetchAINewsRadarFromNotion();
  } catch {
    newsList = [];
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-cyan-500/30">
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
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
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {newsList.map((news) => (
              <div
                key={news.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm transition-all hover:-translate-y-1 hover:border-cyan-500/50 hover:bg-white/10 hover:shadow-[0_0_30px_-5px_rgba(6,182,212,0.3)]"
              >
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {news.source === "X" ? (
                        <div className="flex items-center justify-center rounded-full bg-black p-1.5 ring-1 ring-white/20">
                          <Twitter className="h-4 w-4 text-white" />
                        </div>
                      ) : (
                        <div className="flex items-center justify-center rounded-full bg-red-500/10 p-1.5 ring-1 ring-red-500/30">
                          <Youtube className="h-4 w-4 text-red-500" />
                        </div>
                      )}
                      <span className="text-sm font-semibold text-slate-300">{news.author}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      <span>{news.date || "—"}</span>
                    </div>
                  </div>

                  <h2 className="mb-3 text-lg font-medium leading-snug text-slate-100">{news.title}</h2>

                  {news.originalText ? (
                    <p className="mb-6 line-clamp-3 text-sm italic text-slate-500">
                      &ldquo;{news.originalText}&rdquo;
                    </p>
                  ) : null}
                </div>

                <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
                  <div className="flex flex-wrap gap-2">
                    {news.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 text-xs font-medium text-cyan-400"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <a
                    href={news.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-sm text-slate-400 transition-colors hover:text-cyan-300"
                  >
                    <span>原文</span>
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
