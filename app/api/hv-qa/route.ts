/**
 * HV-QA — 横纵分析报告「14 条军规」质检 API
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { runHvReportQa } from "@/lib/hv-analysis/run-hv-qa";
import type { HvQaResult } from "@/lib/hv-analysis/qa-types";
import { NextResponse } from "next/server";

type QaRequestBody = {
  reportText: string;
  modelId?: string;
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QaRequestBody;
    const result = await runHvReportQa({
      reportText: body.reportText ?? "",
      modelId: body.modelId,
    });

    return NextResponse.json(result satisfies HvQaResult);
  } catch (err) {
    console.error("[hv-qa] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
