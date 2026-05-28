import { NextResponse } from "next/server";
import {
  fetchAihotDailyByDate,
  isValidAihotDailyDate,
} from "@/lib/aihot-daily-api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ date: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const { date } = await context.params;
    if (!isValidAihotDailyDate(date)) {
      return NextResponse.json({ error: "日期须为 YYYY-MM-DD" }, { status: 400 });
    }
    const report = await fetchAihotDailyByDate(date);
    return NextResponse.json(report);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
