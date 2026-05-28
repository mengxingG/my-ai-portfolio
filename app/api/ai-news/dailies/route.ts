import { NextResponse } from "next/server";
import {
  AIHOT_DAILY_ARCHIVE_TAKE,
  fetchAihotDailiesArchive,
} from "@/lib/aihot-daily-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const takeRaw = searchParams.get("take");
    const take = takeRaw ? Number(takeRaw) : AIHOT_DAILY_ARCHIVE_TAKE;
    const items = await fetchAihotDailiesArchive(
      Number.isFinite(take) ? take : AIHOT_DAILY_ARCHIVE_TAKE,
    );
    return NextResponse.json({
      count: items.length,
      take: Number.isFinite(take) ? take : AIHOT_DAILY_ARCHIVE_TAKE,
      items,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
