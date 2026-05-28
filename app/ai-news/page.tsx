import { fetchAINewsRadarFromNotion, type AINews } from "@/utils/notion";
import { BackToHomeLink } from "@/app/components/BackToHomeLink";
import AINewsRadarClient from "./AINewsRadarClient";

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
    <div className="min-h-screen bg-[#0a0e17] text-slate-100 antialiased selection:bg-cyan-500/30">
      {newsList.length === 0 ? (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4">
          <p className="text-sm text-slate-500">暂无已发布的资讯。</p>
          <BackToHomeLink />
        </div>
      ) : (
        <AINewsRadarClient news={newsList} />
      )}
    </div>
  );
}
