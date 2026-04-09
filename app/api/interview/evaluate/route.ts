import { NextResponse } from "next/server";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type InterviewConfig = {
  difficulty?: "basic" | "deep" | "practical" | string;
  questionCount?: 3 | 5 | number;
  answerMode?: "voice" | "text" | string;
};

type Body = {
  messages?: Array<{ role: "assistant" | "user"; content: string }>;
  /** 新版面试流程：每题沉淀为结构化记录 */
  interviewHistory?: Array<{ question?: string; userAnswer?: string; aiResponse?: string }>;
  outline: string;
  /** 与费曼/面试同源的全文或大纲上下文，供评分参考 */
  documentContext?: string;
  config: InterviewConfig;
};

export type InterviewEvaluation = {
  overallScore: number; // 0-100
  questions: Array<{
    questionText: string;
    userAnswer: string;
    score: number; // 0-100
    feedback: string;
    missedPoints: string[];
  }>;
  strengths: string;
  improvements: string;
  suggestedStatus: "已完成" | "待复习" | "进行中";
};

const FALLBACK: InterviewEvaluation = {
  overallScore: 60,
  questions: [],
  strengths: "AI 评估引擎暂时不可用，建议根据面试题逐条复盘。",
  improvements: "请回到资料大纲，补齐关键概念与常见追问的回答框架。",
  suggestedStatus: "待复习",
};

function clampScore(n: unknown, fallback: number) {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return fallback;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function suggestedStatusFromScore(score: number): InterviewEvaluation["suggestedStatus"] {
  if (score >= 80) return "已完成";
  if (score >= 60) return "待复习";
  return "进行中";
}

function stripCodeFences(raw: string): string {
  const t = raw.trim();
  // ```json ... ```
  const m = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (m?.[1]) return m[1].trim();
  return t;
}

function extractFirstJsonObject(raw: string): string | null {
  const s = raw;
  const start = s.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (esc) {
        esc = false;
      } else if (ch === "\\") {
        esc = true;
      } else if (ch === '"') {
        inStr = false;
      }
      continue;
    }
    if (ch === '"') {
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
  const cleaned = stripCodeFences(String(raw ?? ""));
  try {
    return JSON.parse(cleaned);
  } catch {
    /* continue */
  }
  const extracted = extractFirstJsonObject(cleaned) ?? extractFirstJsonObject(String(raw ?? ""));
  if (!extracted) return null;
  try {
    return JSON.parse(extracted);
  } catch {
    return null;
  }
}

function normalizeQuestions(arr: any): InterviewEvaluation["questions"] {
  if (!Array.isArray(arr)) return [];
  return arr
    .map((q: any) => {
      const missed =
        Array.isArray(q?.missedPoints)
          ? q.missedPoints.map((x: any) => String(x ?? "").trim()).filter(Boolean).slice(0, 20)
          : [];
      return {
        questionText: String(q?.questionText ?? "").trim(),
        userAnswer: String(q?.userAnswer ?? "").trim(),
        score: clampScore(q?.score, 0),
        feedback: String(q?.feedback ?? "").trim(),
        missedPoints: missed,
      };
    })
    .filter((q) => q.questionText || q.userAnswer)
    .slice(0, 30);
}

function normalizeEval(j: any): InterviewEvaluation {
  const overallScore = clampScore(j?.overallScore, FALLBACK.overallScore);
  const strengths = String(j?.strengths ?? "").trim() || FALLBACK.strengths;
  const improvements = String(j?.improvements ?? "").trim() || FALLBACK.improvements;
  const questions = normalizeQuestions(j?.questions);

  const suggestedStatusRaw = String(j?.suggestedStatus ?? "").trim();
  const suggestedStatus =
    suggestedStatusRaw === "已完成" || suggestedStatusRaw === "待复习" || suggestedStatusRaw === "进行中"
      ? (suggestedStatusRaw as InterviewEvaluation["suggestedStatus"])
      : suggestedStatusFromScore(overallScore);

  return {
    overallScore,
    questions,
    strengths,
    improvements,
    suggestedStatus,
  };
}

function toTranscript(messages: Body["messages"]): string {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => `${m.role === "user" ? "用户" : "面试官"}：${String(m.content ?? "").trim()}`)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 24_000);
}

function historyToMessages(history: Body["interviewHistory"]): Array<{ role: "assistant" | "user"; content: string }> {
  const out: Array<{ role: "assistant" | "user"; content: string }> = [];
  for (const item of Array.isArray(history) ? history : []) {
    const q = String(item?.question ?? "").trim();
    const a = String(item?.userAnswer ?? "").trim();
    const r = String(item?.aiResponse ?? "").trim();
    if (q) out.push({ role: "assistant", content: q });
    if (a) out.push({ role: "user", content: a });
    if (r) out.push({ role: "assistant", content: r });
  }
  return out.slice(-60);
}

function configSummary(config: InterviewConfig): string {
  const diff = String(config?.difficulty ?? "").trim() || "basic";
  const countRaw = typeof config?.questionCount === "number" ? config.questionCount : Number(config?.questionCount);
  const count = Number.isFinite(countRaw) ? countRaw : 5;
  const mode = String(config?.answerMode ?? "").trim() || "voice";
  return `difficulty=${diff}; questionCount=${count}; answerMode=${mode}`;
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json(FALLBACK, { status: 200 });
  }

  const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(FALLBACK, { status: 200 });
  }

  const normalizedMessages =
    Array.isArray(body?.messages) && body.messages.length ? body.messages : historyToMessages(body?.interviewHistory);
  const transcript = toTranscript(normalizedMessages);
  const outline = String(body.outline ?? "").trim().slice(0, 60_000);
  const documentContext = String(body.documentContext ?? "").trim().slice(0, 120_000);
  const cfg = body.config ?? {};

  if (!transcript.trim()) {
    return NextResponse.json(FALLBACK, { status: 200 });
  }

  const deepseek = createOpenAICompatible({
    name: "deepseek",
    apiKey,
    baseURL: "https://api.deepseek.com/v1",
  });

  const system = [
    "你是一个严格的 IT 面试评分官。你会基于【资料大纲】与【完整面试对话】给出结构化评分报告。",
    "",
    "必须遵守：",
    "- 只输出严格 JSON（不要 Markdown、不要 ``` code block、不要解释文字）",
    "- 字段必须完整且类型正确",
    "- overallScore / questions[].score 为 0-100 整数",
    "- missedPoints 为 string[]（可为空数组）",
    "- strengths / improvements 为中文字符串（可含换行）",
    '- suggestedStatus 只能是 "已完成" / "待复习" / "进行中"',
    "",
    "输出 JSON 结构如下：",
    '{ "overallScore": number, "questions": [{ "questionText": string, "userAnswer": string, "score": number, "feedback": string, "missedPoints": string[] }], "strengths": string, "improvements": string, "suggestedStatus": "已完成"|"待复习"|"进行中" }',
  ].join("\n");

  try {
    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      temperature: 0.2,
      prompt: [
        `<SYSTEM>\n${system}\n</SYSTEM>`,
        "",
        `<INTERVIEW_CONFIG>\n${configSummary(cfg)}\n</INTERVIEW_CONFIG>`,
        "",
        `<OUTLINE>\n${outline || "(empty)"}\n</OUTLINE>`,
        "",
        `<DOCUMENT_CONTEXT>\n${documentContext || "(empty)"}\n</DOCUMENT_CONTEXT>`,
        "",
        `<TRANSCRIPT>\n${transcript}\n</TRANSCRIPT>`,
      ].join("\n"),
    });

    const raw = String(text ?? "").trim();
    const j = safeJsonParse(raw);
    if (!j) {
      // eslint-disable-next-line no-console
      console.warn("[/api/interview/evaluate] JSON parse failed, returning fallback", {
        rawPreview: raw.slice(0, 400),
      });
      return NextResponse.json(FALLBACK, { status: 200 });
    }

    return NextResponse.json(normalizeEval(j), { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[/api/interview/evaluate] DeepSeek failed:", e);
    return NextResponse.json(FALLBACK, { status: 200 });
  }
}

