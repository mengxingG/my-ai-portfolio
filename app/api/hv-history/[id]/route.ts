/**
 * GET /api/hv-history/[id] — Markdown 正文 + QA_Data 质检 JSON
 */
import { NextResponse } from "next/server";
import { fetchHvReportDetailByPageId } from "@/lib/hv-analysis/notion-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: RouteCtx) {
  try {
    const { id } = await ctx.params;
    const pageId = String(id ?? "").trim();
    if (!pageId) {
      return NextResponse.json({ error: "Missing page id" }, { status: 400 });
    }

    const { markdown, qaData } = await fetchHvReportDetailByPageId(pageId);

    return NextResponse.json(
      { id: pageId, markdown, qaData },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/hv-history/[id]]", message);
    const status = /Missing NOTION/i.test(message) ? 500 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
