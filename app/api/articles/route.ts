import { NextResponse } from "next/server";
import { fetchPublishedArticlesFromNotion } from "@/utils/notion";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const articles = await fetchPublishedArticlesFromNotion();
    return NextResponse.json(articles);
  } catch (error) {
    console.error("【API 路由通道报错】:", error);
    return NextResponse.json(
      { error: "无法获取 Notion 数据" },
      { status: 500 }
    );
  }
}