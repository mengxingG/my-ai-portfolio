import { NextResponse } from "next/server";
import {
  archiveKnowledgePageInNotion,
  fetchKnowledgeDetailFromNotion,
  updateKnowledgeItemTitleInNotion,
} from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const pageId = String(id ?? "").trim();
    if (!pageId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    await archiveKnowledgePageInNotion(pageId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/knowledge/:id] DELETE failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const pageId = String(id ?? "").trim();
    if (!pageId) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    const body = (await req.json().catch(() => null)) as { title?: unknown } | null;
    const rawTitle = typeof body?.title === "string" ? body.title : "";
    if (!rawTitle.trim()) {
      return NextResponse.json({ error: "title 不能为空" }, { status: 400 });
    }

    const title = await updateKnowledgeItemTitleInNotion(pageId, rawTitle);
    return NextResponse.json({ ok: true, title });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/knowledge/:id] PATCH failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await ctx.params;
    const detail = await fetchKnowledgeDetailFromNotion(id);
    // eslint-disable-next-line no-console
    console.log("[/api/knowledge/:id] detail:", {
      id,
      title: detail.title,
      rawTextLen: detail.rawText.length,
      videoCount: detail.videoLinks.length,
    });
    return NextResponse.json({ item: detail });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/knowledge/:id] fetch failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

