import { NextResponse } from "next/server";
import { fetchAINewsRadarFromNotion } from "@/utils/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await fetchAINewsRadarFromNotion();
    return NextResponse.json(items);
  } catch (error) {
    console.error("【API 路由通道报错（AI News Radar）】:", error);
    return NextResponse.json(
      { error: "无法获取 AI News Radar 数据" },
      { status: 500 }
    );
  }
}

