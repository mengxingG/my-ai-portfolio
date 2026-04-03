import HomePageClient from "./HomePageClient";
import { fetchAINewsRadarFromNotion, type AINews } from "@/utils/notion";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  let newsData: AINews[] = [];
  try {
    newsData = await fetchAINewsRadarFromNotion();
  } catch (error) {
    console.error("【首页 AI News Radar 拉取失败】:", error);
  }
  return <HomePageClient news={newsData} />;
}
