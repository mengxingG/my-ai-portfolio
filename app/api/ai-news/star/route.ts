import { NextResponse } from "next/server";
import { createNotionClient } from "@/lib/notion-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Body = {
  pageId?: string;
  isStarred?: boolean;
};

/**
 * 更新情报库单条的 Notion `Starred` checkbox。
 */
export async function POST(request: Request) {
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pageId = typeof body.pageId === "string" ? body.pageId.trim() : "";
  if (!pageId) {
    return NextResponse.json({ error: "pageId is required" }, { status: 400 });
  }

  const isStarred = Boolean(body.isStarred);

  const apiKey = process.env.NOTION_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
  }

  const notion = createNotionClient(apiKey);

  try {
    await notion.pages.update({
      page_id: pageId,
      properties: {
        Starred: { checkbox: isStarred },
      },
    });
    return NextResponse.json({ ok: true, pageId, isStarred });
  } catch (e) {
    console.error("[ai-news/star] Notion update failed:", e);
    return NextResponse.json(
      { error: "Failed to update Notion page" },
      { status: 502 }
    );
  }
}
