/**
 * POST /api/hv-refine — 根据 QA 未通过项定向重写完整报告（流式 Markdown）
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

import {
  buildRefineSystemPrompt,
  buildRefineUserPrompt,
  type FailedAuditItem,
} from "@/lib/hv-analysis/refine-prompt";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { streamText } from "ai";
import type { LanguageModel } from "ai";
import { NextResponse } from "next/server";

const REFINE_MODEL_IDS = ["claude-sonnet-4-6", "gpt-5.4", "deepseek-reasoner"] as const;
const DEFAULT_REFINE_MODEL = "claude-sonnet-4-6";

type RefineRequestBody = {
  reportText?: string;
  failedAudits?: FailedAuditItem[];
  modelId?: string;
};

function resolveRefineModel(modelId?: string): LanguageModel | { error: string } {
  const chosen = (modelId?.trim() || process.env.HV_REFINE_MODEL_ID?.trim() || DEFAULT_REFINE_MODEL) as string;

  if (chosen.startsWith("deepseek")) {
    if (!process.env.DEEPSEEK_API_KEY) {
      return { error: "未配置 DEEPSEEK_API_KEY" };
    }
    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
    const id = chosen === "deepseek-reasoner" ? "deepseek-reasoner" : "deepseek-chat";
    return deepseek(id);
  }

  if (!REFINE_MODEL_IDS.includes(chosen as (typeof REFINE_MODEL_IDS)[number])) {
    return {
      error: `不支持的 modelId: ${chosen}，可选: ${REFINE_MODEL_IDS.join(", ")}`,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    return { error: "未配置 OPENAI_API_KEY（中转站）" };
  }

  const relay = createOpenAI({
    baseURL: "https://api.gptsapi.net/v1",
    apiKey: process.env.OPENAI_API_KEY,
  });
  return relay.chat(chosen);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RefineRequestBody;
    const reportText = String(body.reportText ?? "").trim();
    const failedAudits = Array.isArray(body.failedAudits)
      ? body.failedAudits
          .map((a) => ({
            title: String(a?.title ?? "").trim(),
            reason: String(a?.reason ?? "").trim(),
          }))
          .filter((a) => a.title && a.reason)
      : [];

    if (!reportText) {
      return NextResponse.json({ error: "缺少 reportText" }, { status: 400 });
    }
    if (failedAudits.length === 0) {
      return NextResponse.json({ error: "failedAudits 不能为空" }, { status: 400 });
    }

    const resolved = resolveRefineModel(body.modelId);
    if ("error" in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: 500 });
    }

    const result = streamText({
      model: resolved,
      system: buildRefineSystemPrompt(),
      prompt: buildRefineUserPrompt(reportText, failedAudits),
      temperature: 0.55,
      maxOutputTokens: 32_768,
    });

    return result.toTextStreamResponse({
      headers: {
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[/api/hv-refine]", err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
