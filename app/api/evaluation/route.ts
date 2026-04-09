import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
};

type EvaluationResult = {
  score: number; // 0-100
  isPass: boolean;
  weakPoints: string[];
};

const FALLBACK_RESULT: EvaluationResult = {
  score: 60,
  isPass: false,
  weakPoints: ["⚠️ AI 引擎由于网络原因未能生成详细反馈，请结合大纲手动复习。"],
};

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    /* continue */
  }
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m?.[0]) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

function normalizeResult(j: any): EvaluationResult {
  const scoreRaw = typeof j?.score === "number" ? j.score : Number(j?.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : 60;
  const isPass =
    typeof j?.isPass === "boolean"
      ? j.isPass
      : score >= 80;
  const weakPoints = Array.isArray(j?.weakPoints)
    ? j.weakPoints.map((x: any) => String(x ?? "").trim()).filter(Boolean).slice(0, 20)
    : [];
  return {
    score,
    isPass,
    weakPoints: weakPoints.length ? weakPoints : FALLBACK_RESULT.weakPoints,
  };
}

function toTranscript(messages: Body["messages"]): string {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => `${m.role === "user" ? "用户" : "AI"}：${String(m.content ?? "").trim()}`)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 16_000);
}

async function evalWithGemini(transcript: string): Promise<EvaluationResult> {
  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim();
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
  const baseURL = process.env.GOOGLE_GEMINI_BASE_URL?.trim() || undefined;
  const google = createGoogleGenerativeAI({ apiKey, baseURL });
  const { text } = await generateText({
    model: google("gemini-2.5-flash"),
    temperature: 0.2,
    prompt: [
      "你是一个严格的学习考核官。请基于对话内容输出 JSON（不要 Markdown code block）。",
      'JSON 格式：{ "score": number(0-100), "isPass": boolean, "weakPoints": string[] }',
      "",
      "对话：",
      transcript,
    ].join("\n"),
  });
  const raw = String(text ?? "").trim();
  const j = safeJsonParse(raw);
  if (!j) throw new Error("Gemini JSON parse failed");
  return normalizeResult(j);
}

async function evalWithDeepSeek(transcript: string): Promise<EvaluationResult> {
  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) throw new Error("Missing DEEPSEEK_API_KEY");
  const deepseek = createOpenAICompatible({
    name: "deepseek",
    apiKey,
    baseURL: "https://api.deepseek.com/v1",
  });
  const { text } = await generateText({
    model: deepseek("deepseek-chat"),
    temperature: 0.2,
    prompt: [
      "你是一个严格的学习考核官。请只输出 JSON（不要 Markdown code block）。",
      'JSON 格式：{ "score": number(0-100), "isPass": boolean, "weakPoints": string[] }',
      "",
      "对话：",
      transcript,
    ].join("\n"),
  });
  const raw = String(text ?? "").trim();
  const j = safeJsonParse(raw);
  if (!j) throw new Error("DeepSeek JSON parse failed");
  return normalizeResult(j);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(FALLBACK_RESULT, { status: 200 });
  }

  const transcript = toTranscript(body.messages);
  if (!transcript.trim()) {
    return NextResponse.json(FALLBACK_RESULT, { status: 200 });
  }

  try {
    return NextResponse.json(await evalWithGemini(transcript), { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("切换到 DeepSeek 评估引擎");
    // eslint-disable-next-line no-console
    console.error("[/api/evaluation] Gemini failed:", e);
  }

  try {
    return NextResponse.json(await evalWithDeepSeek(transcript), { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[/api/evaluation] DeepSeek failed:", e);
    return NextResponse.json(FALLBACK_RESULT, { status: 200 });
  }
}

