import { NextResponse } from "next/server";
import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { revalidatePath } from "next/cache";

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

const MAX_RICH_TEXT = 1990;
const APPEND_BATCH = 90;

type SuggestedStatus = "已完成" | "待复习" | "进行中";

type QuestionItem = {
  questionText?: string;
  userAnswer?: string;
  score?: number;
  feedback?: string;
  missedPoints?: string[];
};

type Body = {
  knowledgePageId?: string;
  /** 可选：覆盖环境变量里的会话库 database id */
  sessionDatabaseId?: string;
  title?: string;
  sessionDate?: string;
  durationMinutes?: number;
  overallScore?: number;
  suggestedStatus?: string;
  difficulty?: string;
  questions?: QuestionItem[];
  strengths?: string;
  improvements?: string;
};

function normalizeYYYYMMDD(input: unknown): string {
  const s = typeof input === "string" ? input.trim() : "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return new Date().toISOString().slice(0, 10);
}

function normalizeNotionStatusName(input: string): string {
  let s = String(input ?? "").trim();
  if (s.startsWith('"') && s.endsWith('"') && s.length >= 2) s = s.slice(1, -1);
  return s.replace(/\\"/g, "\"").trim();
}

function normalizeStatus(input: unknown): SuggestedStatus {
  const s = normalizeNotionStatusName(String(input ?? "").trim());
  if (s === "已完成" || s === "待复习" || s === "进行中") return s;
  return "待复习";
}

function clampScore(n: unknown): number {
  const x = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, Math.round(x)));
}

function truncate(s: string, max = MAX_RICH_TEXT): string {
  const t = String(s ?? "").replace(/\r\n/g, "\n");
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function rtPlain(content: string): Array<{ type: "text"; text: { content: string } }> {
  return splitRichTextChunks(truncate(content)).map((c) => ({
    type: "text" as const,
    text: { content: c },
  }));
}

function rtBoldLabel(
  label: string,
  rest: string
): Array<{ type: "text"; text: { content: string }; annotations?: { bold: boolean } }> {
  const tail = truncate(rest, Math.max(0, MAX_RICH_TEXT - label.length));
  const out: Array<{ type: "text"; text: { content: string }; annotations?: { bold: boolean } }> = [
    { type: "text", text: { content: label }, annotations: { bold: true } },
  ];
  if (tail) out.push({ type: "text", text: { content: tail } });
  return out;
}

function splitRichTextChunks(text: string, maxLen = MAX_RICH_TEXT): string[] {
  const t = String(text ?? "");
  if (!t) return [""];
  const out: string[] = [];
  for (let i = 0; i < t.length; i += maxLen) {
    out.push(t.slice(i, i + maxLen));
  }
  return out;
}

function assessmentTimeLine(sessionDate: string): string {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${sessionDate} ${hh}:${mm}`;
}

function logErr(prefix: string, err: unknown) {
  const e = err as { message?: string; code?: string; status?: number; body?: unknown };
  // eslint-disable-next-line no-console
  console.error(prefix, { message: e?.message, code: e?.code, status: e?.status, body: e?.body, err });
}

function notionErrorMessage(err: unknown): string {
  const e = err as { message?: string; body?: unknown };
  if (e?.message) return e.message;
  try {
    return JSON.stringify(e?.body ?? err);
  } catch {
    return "Notion request failed";
  }
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const notionToken = process.env.NOTION_API_KEY;
  const sessionDbId =
    String(body.sessionDatabaseId ?? process.env.NOTION_DATABASE_ID_SESSION ?? "").trim();

  if (!notionToken) {
    return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
  }
  if (!sessionDbId) {
    return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION (or pass sessionDatabaseId)" }, { status: 500 });
  }

  const knowledgePageId = String(body.knowledgePageId ?? "").trim();
  if (!knowledgePageId) {
    return NextResponse.json({ error: "Missing knowledgePageId" }, { status: 400 });
  }

  const sessionDate = normalizeYYYYMMDD(body.sessionDate);
  const documentTitle = String(body.title ?? "").trim() || "学习资料";
  const duration = Math.max(0, Math.round(Number(body.durationMinutes) || 0));
  const overallScore = clampScore(body.overallScore);
  const suggestedStatus = normalizeStatus(body.suggestedStatus);
  const difficulty = String(body.difficulty ?? "—").trim() || "—";
  const questions = Array.isArray(body.questions) ? body.questions : [];
  const strengths = String(body.strengths ?? "").trim();
  const improvements = String(body.improvements ?? "").trim();

  const sessionTitle = `${sessionDate} - ${documentTitle}（面试考核）`.slice(0, 180);
  const summaryLine = `总分 ${overallScore}/100，详见页面内容`.slice(0, 2000);

  const notion = createNotionClient(notionToken);

  try {
    const sessionProperties: Parameters<Client["pages"]["create"]>[0]["properties"] = {
      [SESSION_PROP_TITLE]: {
        title: [{ text: { content: sessionTitle } }],
      },
      [SESSION_PROP_DATE]: { date: { start: sessionDate } },
      [SESSION_PROP_RELATION]: { relation: [{ id: knowledgePageId }] },
      [SESSION_PROP_FOCUS_MINUTES]: { number: duration },
      [SESSION_PROP_SCORE]: { number: overallScore },
      [SESSION_PROP_STATUS]: {
        status: { name: normalizeNotionStatusName(suggestedStatus) },
      },
      [SESSION_PROP_FEEDBACK]: {
        rich_text: [{ text: { content: summaryLine } }],
      },
    } as unknown as Parameters<Client["pages"]["create"]>[0]["properties"];

    const sessionPage = await notion.pages.create({
      parent: { database_id: sessionDbId },
      properties: sessionProperties,
    });
    const sessionPageId = String((sessionPage as { id?: string })?.id ?? "");
    if (!sessionPageId) {
      throw new Error("Notion pages.create returned no page id");
    }

    const blocks: Array<Record<string, unknown>> = [];

    blocks.push({
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "面试考核报告" } }],
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: rtPlain(`考核时间：${assessmentTimeLine(sessionDate)}`),
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: rtPlain(`难度：${difficulty}`) },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: rtPlain(`总分：${overallScore}/100`) },
    });

    questions.forEach((q, i) => {
      const qt = String(q.questionText ?? "").trim() || "（无）";
      const uaRaw = String(q.userAnswer ?? "").trim() || "（未作答）";
      const ua = uaRaw.replace(/\s+/g, " ");
      const sc = clampScore(q.score);
      const fb = String(q.feedback ?? "").trim() || "（无）";
      const missed = Array.isArray(q.missedPoints)
        ? q.missedPoints.map((m) => String(m ?? "").trim()).filter(Boolean)
        : [];

      blocks.push({
        object: "block",
        type: "heading_3",
        heading_3: {
          rich_text: [{ type: "text", text: { content: `第 ${i + 1} 题` } }],
        },
      });
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: rtBoldLabel("题目：", ` ${truncate(qt)}`) },
      });
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: rtBoldLabel("你的回答：", ` ${truncate(ua)}`) },
      });
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: rtBoldLabel("得分：", ` ${sc}/100`) },
      });
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: rtBoldLabel("反馈：", ` ${truncate(fb)}`) },
      });
      blocks.push({
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: rtBoldLabel("遗漏知识点：", "") },
      });
      if (missed.length) {
        missed.forEach((m) => {
          blocks.push({
            object: "block",
            type: "bulleted_list_item",
            bulleted_list_item: {
              rich_text: rtPlain(truncate(m, MAX_RICH_TEXT)),
            },
          });
        });
      } else {
        blocks.push({
          object: "block",
          type: "bulleted_list_item",
          bulleted_list_item: {
            rich_text: rtPlain("（无）"),
          },
        });
      }
    });

    blocks.push({
      object: "block",
      type: "heading_3",
      heading_3: {
        rich_text: [{ type: "text", text: { content: "整体评价" } }],
      },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: rtBoldLabel("优势：", ` ${truncate(strengths || "（无）")}`) },
    });
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: rtBoldLabel("改进建议：", ` ${truncate(improvements || "（无）")}`),
      },
    });

    for (let i = 0; i < blocks.length; i += APPEND_BATCH) {
      const slice = blocks.slice(i, i + APPEND_BATCH);
      await notion.blocks.children.append({
        block_id: sessionPageId,
        children: slice as Parameters<Client["blocks"]["children"]["append"]>[0]["children"],
      });
    }

    await notion.pages.update({
      page_id: knowledgePageId,
      properties: {
        学习状态: {
          status: { name: normalizeNotionStatusName(suggestedStatus) },
        },
      } as unknown as Parameters<Client["pages"]["update"]>[0]["properties"],
    });

    try {
      revalidatePath("/");
      revalidatePath("/knowledge");
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[/api/interview/save-report] revalidatePath failed:", e);
    }

    return NextResponse.json(
      { ok: true, sessionPageId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    logErr("[/api/interview/save-report]", err);
    return NextResponse.json(
      { error: notionErrorMessage(err), details: (err as { body?: unknown })?.body ?? null },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
