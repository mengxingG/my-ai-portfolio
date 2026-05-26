/**
 * GET /api/hv-history — 从 Notion HV 报告库拉取历史列表（按创建时间倒序）
 *
 * 每项含 id, title, target, createdAt；若存在 QA_Data 则附带 overallScore（0–100）。
 */
import { NextResponse } from "next/server";
import { fetchHvHistoryList } from "@/lib/hv-analysis/notion-history";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limitRaw = Number(searchParams.get("limit") ?? "50");
    const limit = Number.isFinite(limitRaw)
      ? Math.min(100, Math.max(1, Math.round(limitRaw)))
      : 50;

    const items = await fetchHvHistoryList(limit);

    return NextResponse.json(
      { items },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/hv-history]", message);
    const status = /Missing NOTION|NOTION_DATABASE_ID_HV_ANALYSIS/i.test(message)
      ? 500
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
