import { NextResponse } from "next/server";
import {
  archiveKnowledgePageInNotion,
  fetchKnowledgeDetailFromNotion,
  updateKnowledgeItemStudyStatusInNotion,
  updateKnowledgeItemTitleInNotion,
} from "@/lib/notion";
import { notionErrorToRouteBody } from "@/lib/notion-errors";

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
    const { status, body } = notionErrorToRouteBody(error);
    return NextResponse.json(body, { status });
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

    const body = (await req.json().catch(() => null)) as {
      title?: unknown;
      status?: unknown;
    } | null;

    const rawTitle = typeof body?.title === "string" ? body.title : "";
    const rawStatus = typeof body?.status === "string" ? body.status : "";

    if (rawTitle.trim()) {
      const title = await updateKnowledgeItemTitleInNotion(pageId, rawTitle);
      return NextResponse.json({ ok: true, title });
    }

    if (rawStatus.trim()) {
      await updateKnowledgeItemStudyStatusInNotion(pageId, rawStatus);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/knowledge/:id] PATCH failed:", error);
    const { status, body } = notionErrorToRouteBody(error);
    return NextResponse.json(body, { status });
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
    const { status, body } = notionErrorToRouteBody(error);
    return NextResponse.json(body, { status });
  }
}

