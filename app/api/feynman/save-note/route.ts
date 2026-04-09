import { NextResponse } from "next/server";
import { createNotionClient } from "@/lib/notion-client";
import type { Client } from "@notionhq/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type FeynmanNote = {
  coreConcept: string;
  bestAnalogy: string;
  keyPrinciples: string[];
  commonMisconceptions: string[];
  userInsights: string;
  weakPoints: string;
  oneLineSummary: string;
};

type Body = {
  sessionPageId: string;
  note: FeynmanNote;
};

function rt(content: string) {
  const t = String(content ?? "").trim();
  return [{ type: "text" as const, text: { content: t || "（无）" } }];
}

function listItems(items: unknown, max = 20) {
  if (!Array.isArray(items)) return [];
  return items.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max);
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const sessionPageId = String(body?.sessionPageId ?? "").trim();
  if (!sessionPageId) {
    return NextResponse.json({ ok: false, error: "Missing sessionPageId." }, { status: 400 });
  }

  const note = body?.note as FeynmanNote;
  if (!note || typeof note !== "object") {
    return NextResponse.json({ ok: false, error: "Missing note." }, { status: 400 });
  }

  const token = process.env.NOTION_API_KEY?.trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: "Missing NOTION_API_KEY" }, { status: 500 });
  }
  const notion = createNotionClient(token);

  const keyPrinciples = listItems(note.keyPrinciples, 12);
  const misconceptions = listItems(note.commonMisconceptions, 12);

  const children = [
    {
      object: "block",
      type: "heading_2",
      heading_2: { rich_text: rt("费曼学习笔记") },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: rt(note.coreConcept) },
    },
    {
      object: "block",
      type: "quote",
      quote: { rich_text: rt(note.bestAnalogy) },
    },
    {
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: rt("关键原理") },
    },
    ...keyPrinciples.map((p) => ({
      object: "block" as const,
      type: "bulleted_list_item" as const,
      bulleted_list_item: { rich_text: rt(p) },
    })),
    {
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: rt("常见误解") },
    },
    ...misconceptions.map((p) => ({
      object: "block" as const,
      type: "bulleted_list_item" as const,
      bulleted_list_item: { rich_text: rt(p) },
    })),
    {
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: rt("你的理解亮点") },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: rt(note.userInsights) },
    },
    {
      object: "block",
      type: "heading_3",
      heading_3: { rich_text: rt("薄弱环节") },
    },
    {
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: rt(note.weakPoints) },
    },
    { object: "block", type: "divider", divider: {} },
    {
      object: "block",
      type: "callout",
      callout: {
        icon: { emoji: "🧠" },
        rich_text: rt(note.oneLineSummary),
      },
    },
  ] as unknown as Parameters<Client["blocks"]["children"]["append"]>[0]["children"];

  try {
    await notion.blocks.children.append({
      block_id: sessionPageId,
      children,
    });
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[/api/feynman/save-note] append failed:", e);
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

