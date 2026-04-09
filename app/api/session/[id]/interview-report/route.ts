import { NextResponse } from "next/server";
import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";
import type { InterviewEvaluation } from "@/app/api/interview/evaluate/route";
import {
  listAllBlockChildren,
  parseInterviewReportFromNotionBlocks,
} from "@/lib/parse-session-interview-blocks";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SESSION_PROP_RELATION = "关联资料";
const SESSION_PROP_SCORE = "掌握度评分";
const SESSION_PROP_STATUS = "学习状态";

function relationIds(prop: unknown): string[] {
  const p = prop as { relation?: Array<{ id?: string }> } | undefined;
  const r = p?.relation;
  if (!Array.isArray(r)) return [];
  return r.map((x) => String(x?.id ?? "").trim()).filter(Boolean);
}

function numberPlain(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  const n = typeof p?.number === "number" ? p.number : Number(p?.number);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusPlain(prop: unknown): InterviewEvaluation["suggestedStatus"] {
  const p = prop as { status?: { name?: string } } | undefined;
  const s = String(p?.status?.name ?? "").trim();
  if (s === "已完成" || s === "待复习" || s === "进行中") return s;
  return "待复习";
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const token = process.env.NOTION_API_KEY?.trim();
    if (!token) {
      return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    }

    const { id: rawId } = await ctx.params;
    const sessionPageId = String(rawId ?? "").trim();
    if (!sessionPageId) {
      return NextResponse.json({ error: "Invalid session id" }, { status: 400 });
    }

    const url = new URL(req.url);
    const knowledgePageId = String(url.searchParams.get("knowledgePageId") ?? "").trim();

    const notion: Client = createNotionClient(token);

    const page = await withNotionRetryOnce(() =>
      notion.pages.retrieve({ page_id: sessionPageId })
    );
    const props = ((page as unknown as { properties?: Record<string, unknown> })?.properties ??
      {}) as Record<string, unknown>;

    const linked = relationIds(props[SESSION_PROP_RELATION]);
    if (knowledgePageId) {
      const norm = (s: string) => s.replace(/-/g, "").toLowerCase();
      const ok = linked.some((id) => norm(id) === norm(knowledgePageId));
      if (!ok) {
        return NextResponse.json({ error: "Session does not match this knowledge item" }, { status: 403 });
      }
    }

    const fallbackScore = numberPlain(props[SESSION_PROP_SCORE]);
    const fallbackStatus = statusPlain(props[SESSION_PROP_STATUS]);

    const blocks = await listAllBlockChildren(notion, sessionPageId);
    const report = parseInterviewReportFromNotionBlocks(blocks, fallbackScore, fallbackStatus);

    return NextResponse.json(
      { report, sessionPageId: (page as { id?: string }).id },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
