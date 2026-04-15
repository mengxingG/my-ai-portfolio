import { NextResponse } from "next/server";
import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { revalidatePath } from "next/cache";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateText } from "ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SESSION_PROP_TITLE = "会话名称";
const SESSION_PROP_DATE = "学习日期";
const SESSION_PROP_RELATION = "关联资料";
const SESSION_PROP_FOCUS_MINUTES = "专注时长";
const SESSION_PROP_SCORE = "掌握度评分";
const SESSION_PROP_STATUS = "学习状态";
const SESSION_PROP_FEEDBACK = "AI 详细反馈";

function logNotionError(prefix: string, err: unknown) {
  const e = err as { message?: string; code?: string; status?: number; body?: unknown };
  // eslint-disable-next-line no-console
  console.error(prefix, {
    message: e?.message,
    code: e?.code,
    status: e?.status,
    body: e?.body,
    error: err,
  });
}

function logAiError(prefix: string, err: unknown) {
  const e = err as { message?: string; status?: number; statusCode?: number; cause?: unknown };
  // eslint-disable-next-line no-console
  console.error(prefix, {
    message: e?.message,
    status: e?.status ?? e?.statusCode,
    cause: e?.cause,
    error: err,
  });
}

function normalizeYYYYMMDD(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function normalizeDuration(input: unknown, fallback: number): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return Math.round(n);
}

function normalizeScoreToRatio(input: unknown): number {
  const n = typeof input === "number" ? input : Number(input);
  if (!Number.isFinite(n)) return 0.6;
  // accept either 0~1 or 0~100
  if (n >= 0 && n <= 1) return n;
  return Math.max(0, Math.min(100, n)) / 100;
}

function normalizeNotionStatusName(input: string): string {
  let s = String(input ?? "").trim();
  // strip accidental JSON-stringified values like "\"待复习\""
  if (s.startsWith("\"") && s.endsWith("\"") && s.length >= 2) {
    s = s.slice(1, -1);
  }
  s = s.replace(/\\"/g, "\"").trim();
  return s;
}

function splitTextChunks(text: string, maxLen: number): string[] {
  const t = String(text ?? "");
  if (!t) return [];
  const out: string[] = [];
  for (let i = 0; i < t.length; i += maxLen) {
    out.push(t.slice(i, i + maxLen));
  }
  return out;
}

function richTextFromLongContent(content: string, maxLen = 2000): Array<{ text: { content: string } }> {
  return splitTextChunks(content, maxLen).map((chunk) => ({ text: { content: chunk } }));
}

type SaveSessionBody = {
  /** 主资料库 page_id（库 A） */
  knowledgePageId?: string;
  /** 兼容旧字段 */
  itemId?: string;

  /** 文档标题（用于会话名称拼接） */
  title?: string;

  sessionDate?: string; // YYYY-MM-DD
  duration?: number;
  /**
   * 可选：若前端已评估，可直接传入（会优先使用，避免再次调用大模型）
   * - score: 0~1 或 0~100
   */
  score?: number;
  weakPoints?: string[];
  isPass?: boolean;

  /**
   * 面试考核：与 evaluate 返回一致时，用于会话与资料库「学习状态」
   * （优先于 isPass 推导）
   */
  suggestedStatus?: "已完成" | "待复习" | "进行中";

  /** 兼容旧逻辑：如果仍由前端传入这些字段，也会被写进 AI 详细反馈 */
  feedback?: string;
  status?: "已完成" | "待复习" | "需重学";

  reason: "auto" | "manual" | "timeUp";
  learningRole: "feynman" | "interview";
  sessionKind: "pomodoro25" | "quick5";
  messages: Array<{ role: "assistant" | "user"; content: string }>;
};

type SessionEval = {
  scoreRatio: number; // 0~1
  isPass: boolean;
  weakPoints: string[];
};

const DEFAULT_EVAL_ON_AI_DOWN: SessionEval = {
  scoreRatio: 0,
  isPass: false,
  weakPoints: ["AI 考官暂时下班，请稍后手动回顾"],
};

function safeWeakPoints(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
    .slice(0, 30);
}

function tryParseEvalJson(raw: string): Partial<{ score: unknown; isPass: unknown; weakPoints: unknown }> | null {
  const direct = (() => {
    try {
      return JSON.parse(raw) as any;
    } catch {
      return null;
    }
  })();
  if (direct && typeof direct === "object") return direct;
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m?.[0]) return null;
  try {
    return JSON.parse(m[0]) as any;
  } catch {
    return null;
  }
}

async function evaluateWithAI(args: {
  messages: Array<{ role: "assistant" | "user"; content: string }>;
  learningRole: "feynman" | "interview";
}): Promise<SessionEval> {
  const googleKey = (process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim();
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim();

  const transcript = args.messages
    .map((m) => `${m.role === "user" ? "用户" : "AI"}：${String(m.content ?? "").trim()}`)
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 14_000);

  const system =
    "你是一个严格的学习考核官。你需要基于对话内容给出是否通过与薄弱点。只输出 JSON，不要 markdown。";
  const user = [
    `学习模式：${args.learningRole === "interview" ? "模拟面试" : "费曼学习"}`,
    "请输出 JSON：",
    '{ "score": number(0-100), "isPass": boolean, "weakPoints": string[] }',
    "",
    "对话：",
    transcript,
  ].join("\n");

  // Gemini first
  if (googleKey) {
    try {
      const baseURL = process.env.GOOGLE_GEMINI_BASE_URL?.trim() || undefined;
      const google = createGoogleGenerativeAI({ apiKey: googleKey, baseURL });
      const { text } = await generateText({
        model: google("gemini-3-flash-preview"),
        system,
        prompt: user,
        temperature: 0.2,
      });
      const raw = String(text ?? "").trim();
      const parsed = tryParseEvalJson(raw) ?? {};
      const scoreRatio = normalizeScoreToRatio(parsed.score);
      const weakPoints = safeWeakPoints(parsed.weakPoints);
      const isPass = typeof parsed.isPass === "boolean" ? parsed.isPass : scoreRatio >= 0.8;
      return {
        scoreRatio,
        isPass,
        weakPoints: weakPoints.length ? weakPoints : DEFAULT_EVAL_ON_AI_DOWN.weakPoints,
      };
    } catch (e) {
      logAiError("[/api/session/save] Gemini eval failed, fallback to DeepSeek:", e);
    }
  }

  // DeepSeek fallback
  if (deepseekKey) {
    const deepseek = createOpenAICompatible({
      name: "deepseek",
      apiKey: deepseekKey,
      baseURL: "https://api.deepseek.com/v1",
    });
    const { text } = await generateText({
      model: deepseek("deepseek-chat"),
      system,
      prompt: user,
      temperature: 0.2,
    });
    const raw = String(text ?? "").trim();
    const parsed = tryParseEvalJson(raw) ?? {};
    const scoreRatio = normalizeScoreToRatio(parsed.score);
    const weakPoints = safeWeakPoints(parsed.weakPoints);
    const isPass = typeof parsed.isPass === "boolean" ? parsed.isPass : scoreRatio >= 0.8;
    return {
      scoreRatio,
      isPass,
      weakPoints: weakPoints.length ? weakPoints : DEFAULT_EVAL_ON_AI_DOWN.weakPoints,
    };
  }

  throw new Error("No AI keys available for evaluation");
}

export async function POST(req: Request) {
  try {
    const notionToken = process.env.NOTION_API_KEY;
    const sessionDbId = process.env.NOTION_DATABASE_ID_SESSION;
    if (!notionToken) {
      return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    }
    if (!sessionDbId) {
      return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION" }, { status: 500 });
    }

    let body: SaveSessionBody;
    try {
      body = (await req.json()) as SaveSessionBody;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const knowledgePageId = String(body.knowledgePageId ?? body.itemId ?? "").trim();
    if (!knowledgePageId) {
      return NextResponse.json({ error: "Missing knowledgePageId." }, { status: 400 });
    }

    const sessionDate = normalizeYYYYMMDD(body.sessionDate);
    const durationFallback = body.sessionKind === "quick5" ? 5 : 25;
    const duration = normalizeDuration(body.duration, durationFallback);
    const clientScoreRatio = normalizeScoreToRatio(body.score);
    const clientWeakPoints = safeWeakPoints(body.weakPoints);
    const clientIsPass =
      typeof body.isPass === "boolean" ? body.isPass : clientScoreRatio >= 0.8;

    const learningRole = body.learningRole === "interview" ? "interview" : "feynman";
    const sessionKind = body.sessionKind === "quick5" ? "quick5" : "pomodoro25";
    const reason = body.reason === "manual" ? "manual" : body.reason === "timeUp" ? "timeUp" : "auto";

    const messages = Array.isArray(body.messages) ? body.messages : [];
    const transcript = messages
      .map((m) => `${m.role === "user" ? "用户" : "AI"}：${String(m.content ?? "").trim()}`)
      .filter(Boolean)
      .join("\n\n")
      .slice(0, 20_000);

    const notion = createNotionClient(notionToken);

    // ===== Segment 1: AI evaluation (may fail, must not block settlement) =====
    let evalResult: SessionEval;
    if (typeof body.score === "number" || clientWeakPoints.length || typeof body.isPass === "boolean") {
      evalResult = {
        scoreRatio: clientScoreRatio,
        isPass: clientIsPass,
        weakPoints: clientWeakPoints.length ? clientWeakPoints : DEFAULT_EVAL_ON_AI_DOWN.weakPoints,
      };
    } else {
      try {
        evalResult = await evaluateWithAI({ messages, learningRole });
      } catch (e) {
        // e.g. Gemini 429 quota exceeded -> fallback default, DO NOT throw
        logAiError("[/api/session/save] AI eval failed, fallback defaults:", e);
        evalResult = DEFAULT_EVAL_ON_AI_DOWN;
      }
    }

    const scoreRatio = evalResult.scoreRatio;
    const isPass = evalResult.isPass;
    const weakPoints = evalResult.weakPoints;
    const clientFeedback = typeof body.feedback === "string" ? body.feedback.trim() : "";
    const scorePercent = Math.round(Math.max(0, Math.min(1, scoreRatio)) * 100);

    const suggestedRaw = String(body.suggestedStatus ?? "").trim();
    const suggestedOk =
      suggestedRaw === "已完成" || suggestedRaw === "待复习" || suggestedRaw === "进行中"
        ? (suggestedRaw as "已完成" | "待复习" | "进行中")
        : null;

    // Action 1: write session DB (库 B)
    const documentTitle = String(body.title ?? "").trim();
    const sessionTitle =
      learningRole === "interview"
        ? `${sessionDate} - ${documentTitle || "学习资料"}（面试考核）`.slice(0, 180)
        : `${sessionDate}-${documentTitle || "学习资料"}`.slice(0, 180);
    const sessionStatusName = normalizeNotionStatusName(
      suggestedOk ?? (isPass ? "已完成" : "待复习")
    );
    const feedbackRich = richTextFromLongContent(
      clientFeedback || (weakPoints.length ? weakPoints.join(", ") : "（无）"),
      2000
    );
    const sessionProperties: Parameters<Client["pages"]["create"]>[0]["properties"] = {
      [SESSION_PROP_TITLE]: {
        title: [{ text: { content: sessionTitle } }],
      },
      [SESSION_PROP_DATE]: { date: { start: sessionDate } },
      [SESSION_PROP_FOCUS_MINUTES]: { number: duration },
      [SESSION_PROP_SCORE]: { number: learningRole === "interview" ? scorePercent : scoreRatio },
      [SESSION_PROP_RELATION]: { relation: [{ id: knowledgePageId }] },
      [SESSION_PROP_FEEDBACK]: {
        rich_text: feedbackRich,
      },
      [SESSION_PROP_STATUS]: {
        status: { name: sessionStatusName },
      },
    } as unknown as Parameters<Client["pages"]["create"]>[0]["properties"];

    let sessionPageId = "";
    try {
      const sessionPage = await notion.pages.create({
        parent: { database_id: sessionDbId },
        properties: sessionProperties,
      });
      sessionPageId = String((sessionPage as { id?: string })?.id ?? "");
    } catch (e) {
      logNotionError("[/api/session/save] session pages.create failed:", e);
      throw e;
    }

    // Append transcript block (best-effort)
    try {
      await notion.blocks.children.append({
        block_id: sessionPageId,
        children: [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: {
                    content: [
                      `掌握度：${scorePercent}/100`,
                      `是否通过：${isPass ? "是" : "否"}`,
                      `学习状态：${sessionStatusName}`,
                      `触发：${reason}`,
                      `学习模式：${learningRole}`,
                      `会话：${sessionKind}`,
                      `资料ID：${knowledgePageId}`,
                      `时间：${new Date().toISOString()}`,
                    ].join(" · "),
                  },
                },
              ],
            },
          },
          ...(clientFeedback
            ? ([
                {
                  object: "block",
                  type: "heading_3",
                  heading_3: { rich_text: [{ type: "text", text: { content: "复盘摘要" } }] },
                },
                ...splitTextChunks(clientFeedback, 1800).map((chunk) => ({
                  object: "block" as const,
                  type: "paragraph" as const,
                  paragraph: {
                    rich_text: [{ type: "text" as const, text: { content: chunk } }],
                  },
                })),
              ] as const)
            : []),
          {
            object: "block",
            type: "heading_3",
            heading_3: { rich_text: [{ type: "text", text: { content: "对话记录（节选）" } }] },
          },
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [{ type: "text", text: { content: transcript || "（无）" } }],
            },
          },
        ] as unknown as Parameters<Client["blocks"]["children"]["append"]>[0]["children"],
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[/api/session/save] append transcript failed:", e);
    }

    // Action 2: update knowledge page (库 A)
    try {
      await notion.pages.update({
        page_id: knowledgePageId,
        properties: {
          学习状态: {
            status: { name: sessionStatusName },
          },
        } as unknown as Parameters<Client["pages"]["update"]>[0]["properties"],
      });
    } catch (e) {
      logNotionError("[/api/session/save] knowledge pages.update failed:", e);
      throw e;
    }

    // Action 3: revalidate caches after both Notion operations succeed
    try {
      revalidatePath("/");
      revalidatePath("/knowledge");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[/api/session/save] revalidatePath failed:", e);
    }

    return NextResponse.json(
      { ok: true, sessionPageId, scoreRatio, isPass, weakPoints },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (err) {
    logNotionError("[/api/session/save] failed:", err);
    return NextResponse.json(
      { error: (err as { message?: string })?.message ?? "Unknown error" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}

