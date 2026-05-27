import { NextResponse } from "next/server";
import {
  formatCronFetchError,
  runCronFetchNews,
} from "@/lib/cron-fetch-news";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("authorization")?.trim();
  return auth === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const stats = await runCronFetchNews();
    console.log("[cron-fetch-news] 完成", stats);
    return NextResponse.json({ success: true, message: "抓取完成" });
  } catch (err) {
    const message = formatCronFetchError(err);
    console.error("[cron-fetch-news] 失败:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
