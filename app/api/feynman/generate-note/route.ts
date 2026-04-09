import { NextResponse } from "next/server";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  documentContext: string;
};

export type FeynmanNote = {
  coreConcept: string;
  bestAnalogy: string;
  keyPrinciples: string[];
  commonMisconceptions: string[];
  userInsights: string;
  weakPoints: string;
  oneLineSummary: string;
};

const FALLBACK: FeynmanNote = {
  coreConcept: "（生成失败：请稍后重试）",
  bestAnalogy: "（无）",
  keyPrinciples: [],
  commonMisconceptions: [],
  userInsights: "（无）",
  weakPoints: "（无）",
  oneLineSummary: "（无）",
};

function stripCodeFences(raw: string): string {
  const t = String(raw ?? "").trim();
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m?.[1]) return m[1].trim();
  return t;
}

function extractFirstJsonObject(raw: string): string | null {
  const s = String(raw ?? "");
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === "\"") inStr = false;
      continue;
    }
    if (ch === "\"") {
      inStr = true;
      continue;
    }
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function safeJsonParse(raw: string): any | null {
  const t = stripCodeFences(raw);
  try {
    const j = JSON.parse(t);
    if (j && typeof j === "object") return j;
  } catch {
    // ignore
  }
  const extracted = extractFirstJsonObject(t);
  if (!extracted) return null;
  try {
    const j = JSON.parse(extracted);
    if (j && typeof j === "object") return j;
  } catch {
    return null;
  }
  return null;
}

function normalizeNote(j: any): FeynmanNote {
  const arr = (x: any, max: number) =>
    Array.isArray(x) ? x.map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, max) : [];
  return {
    coreConcept: String(j?.coreConcept ?? "").trim() || FALLBACK.coreConcept,
    bestAnalogy: String(j?.bestAnalogy ?? "").trim() || "（无）",
    keyPrinciples: arr(j?.keyPrinciples, 6),
    commonMisconceptions: arr(j?.commonMisconceptions, 6),
    userInsights: String(j?.userInsights ?? "").trim() || "（无）",
    weakPoints: String(j?.weakPoints ?? "").trim() || "（无）",
    oneLineSummary: String(j?.oneLineSummary ?? "").trim() || "（无）",
  };
}

function transcriptFromMessages(messages: Body["messages"]) {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => `${m.role === "user" ? "用户" : "费曼导师"}：${String(m.content ?? "").trim()}`)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 24_000);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const apiKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY", note: FALLBACK }, { status: 200 });
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const documentContext = String(body?.documentContext ?? "").trim().slice(0, 120_000);
  const transcript = transcriptFromMessages(messages);

  if (!transcript.trim()) {
    return NextResponse.json({ ok: false, error: "Empty transcript.", note: FALLBACK }, { status: 200 });
  }

  const system = [
    "你是一位学习笔记整理专家。根据用户与费曼导师的完整对话记录，提取用户自己表达的理解，整理成一份「费曼笔记」。",
    "",
    "重要原则：这份笔记应该反映的是「用户理解了什么」，而不是「AI 教了什么」。优先使用用户在对话中自己说的话和类比。",
    "",
    "请严格返回 JSON 格式（不要 markdown 代码块），包含以下字段：",
    '{ "coreConcept": string, "bestAnalogy": string, "keyPrinciples": string[], "commonMisconceptions": string[], "userInsights": string, "weakPoints": string, "oneLineSummary": string }',
  ].join("\n");

  try {
    const baseURL = process.env.GOOGLE_GEMINI_BASE_URL?.trim() || undefined;
    const google = createGoogleGenerativeAI({ apiKey, baseURL });
    const { text } = await generateText({
      model: google("gemini-2.5-flash"),
      system,
      prompt: [
        "<DOCUMENT_CONTEXT>",
        documentContext || "(empty)",
        "</DOCUMENT_CONTEXT>",
        "",
        "<DIALOGUE>",
        transcript,
        "</DIALOGUE>",
      ].join("\n"),
      temperature: 0.3,
    });

    const raw = String(text ?? "").trim();
    const parsed = safeJsonParse(raw);
    if (!parsed) {
      return NextResponse.json({ ok: false, error: "JSON parse failed.", note: FALLBACK }, { status: 200 });
    }
    return NextResponse.json({ ok: true, note: normalizeNote(parsed) }, { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[/api/feynman/generate-note] failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error", note: FALLBACK }, { status: 200 });
  }
}

