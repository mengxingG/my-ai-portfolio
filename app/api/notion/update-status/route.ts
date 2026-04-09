import { NextResponse } from "next/server";
import { createNotionClient } from "@/lib/notion-client";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

type Body = {
  /** 知识库条目的 Notion page_id */
  knowledgePageId?: string;
  /** 目标学习状态（必须是 Notion 里已存在的状态名） */
  status?: string;
};

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

export async function POST(req: Request) {
  const notionToken = process.env.NOTION_API_KEY;
  if (!notionToken) {
    return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const knowledgePageId = String(body.knowledgePageId ?? "").trim();
  const nextStatus = String(body.status ?? "").trim();
  if (!knowledgePageId) {
    return NextResponse.json({ error: "Missing knowledgePageId." }, { status: 400 });
  }
  if (!nextStatus) {
    return NextResponse.json({ error: "Missing status." }, { status: 400 });
  }

  const notion = createNotionClient(notionToken);
  try {
    await notion.pages.update({
      page_id: knowledgePageId,
      properties: {
        学习状态: { status: { name: nextStatus } },
      } as unknown as Parameters<typeof notion.pages.update>[0]["properties"],
    });
  } catch (e) {
    logNotionError("[/api/notion/update-status] pages.update failed:", e);
    return NextResponse.json(
      { error: (e as { message?: string })?.message ?? "Notion update failed" },
      { status: 500 }
    );
  }

  try {
    revalidatePath("/knowledge");
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[/api/notion/update-status] revalidatePath failed:", e);
  }

  return NextResponse.json(
    { ok: true },
    { headers: { "Cache-Control": "no-store" } }
  );
}

