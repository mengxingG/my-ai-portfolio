/**
 * POST /api/hv-analysis/notion-save — 手动将 HV 报告归档至 Notion
 */
import { NextResponse } from "next/server";
import {
  getHvNotionAuthToken,
  saveHvAnalysisReportToNotion,
  type SaveHvAnalysisReportArgs,
} from "@/lib/hv-analysis/notion-save";
import type { HvQaResult } from "@/lib/hv-analysis/qa-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

type SaveRequestBody = {
  targetName?: string;
  fullMarkdown?: string;
  modelId?: string;
  objectType?: string;
  motivation?: string;
  competitors?: string;
  qaData?: HvQaResult | null;
  qaDataEmpty?: boolean;
};

export async function POST(req: Request) {
  try {
    if (!getHvNotionAuthToken()) {
      return NextResponse.json(
        { error: "未配置 NOTION_TOKEN 或 NOTION_API_KEY" },
        { status: 500 },
      );
    }
    if (!process.env.NOTION_DATABASE_ID_HV_ANALYSIS?.trim()) {
      return NextResponse.json(
        { error: "未配置 NOTION_DATABASE_ID_HV_ANALYSIS" },
        { status: 500 },
      );
    }

    const body = (await req.json()) as SaveRequestBody;
    const targetName = String(body.targetName ?? "").trim();
    const fullMarkdown = String(body.fullMarkdown ?? "").trim();
    const modelId = String(body.modelId ?? "").trim();

    if (!targetName) {
      return NextResponse.json({ error: "缺少 targetName" }, { status: 400 });
    }
    if (!fullMarkdown) {
      return NextResponse.json({ error: "缺少报告正文 fullMarkdown" }, { status: 400 });
    }
    if (!modelId) {
      return NextResponse.json({ error: "缺少 modelId" }, { status: 400 });
    }

    const args: SaveHvAnalysisReportArgs = {
      targetName,
      fullMarkdown,
      modelId,
      objectType: body.objectType,
      motivation: body.motivation,
      competitors: body.competitors,
      qaData: body.qaData ?? null,
      qaDataEmpty: body.qaDataEmpty === true,
    };

    const result = await saveHvAnalysisReportToNotion(args);
    if (!result?.pageId) {
      return NextResponse.json({ error: "Notion 写入失败" }, { status: 502 });
    }

    return NextResponse.json(
      { ok: true, pageId: result.pageId },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    console.error("[/api/hv-analysis/notion-save]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
