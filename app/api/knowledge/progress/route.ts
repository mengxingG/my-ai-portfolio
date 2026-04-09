import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SESSION_PROP_DATE = "学习日期";
const SESSION_PROP_RELATION = "关联资料";
const SESSION_PROP_SCORE = "掌握度评分";

type Body = { knowledgePageIds: string[] };

type Progress = {
  knowledgePageId: string;
  sessionCount: number;
  bestScore: number | null;
  lastStudyDate: string | null; // YYYY-MM-DD
};

function datePlain(prop: unknown): string {
  const p = prop as { date?: { start?: string } } | undefined;
  const s = String(p?.date?.start ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

function scorePlain(prop: unknown): number | null {
  const p = prop as { number?: number | null } | undefined;
  const n = typeof p?.number === "number" ? p.number : Number(p?.number);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function relationIds(prop: unknown): string[] {
  const p = prop as { relation?: Array<{ id?: string }> } | undefined;
  const r = p?.relation;
  if (!Array.isArray(r) || r.length === 0) return [];
  return r.map((x) => String(x?.id ?? "").trim()).filter(Boolean);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function POST(req: Request) {
  try {
    const token = process.env.NOTION_API_KEY?.trim();
    const dbId = process.env.NOTION_DATABASE_ID_SESSION?.trim();
    if (!token) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    if (!dbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION" }, { status: 500 });

    let body: Body;
    try {
      body = (await req.json()) as Body;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const ids = Array.isArray(body.knowledgePageIds)
      ? body.knowledgePageIds.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, 50)
      : [];
    if (!ids.length) {
      return NextResponse.json({ progress: [] satisfies Progress[] }, { status: 200, headers: { "Cache-Control": "no-store" } });
    }

    const notion: Client = createNotionClient(token);

    const db = (await withNotionRetryOnce(() =>
      notion.databases.retrieve({ database_id: dbId })
    )) as unknown as { data_sources?: Array<{ id: string }> };
    const dataSourceId = String(db?.data_sources?.[0]?.id ?? "").trim();
    if (!dataSourceId) {
      return NextResponse.json({ error: "Notion database has no data_sources" }, { status: 500 });
    }

    const progress: Progress[] = [];

    for (const knowledgePageId of ids) {
      // Notion rate limit ~3rps：串行 + delay
      await sleep(380);

      const resp = await withNotionRetryOnce(() =>
        notion.dataSources.query({
          data_source_id: dataSourceId,
          page_size: 100,
          filter: {
            and: [
              {
                property: SESSION_PROP_RELATION,
                relation: { contains: knowledgePageId },
              },
            ],
          } as any,
          sorts: [{ property: SESSION_PROP_DATE, direction: "descending" }] as any,
        })
      );

      let sessionCount = 0;
      let bestScore: number | null = null;
      let lastStudyDate: string | null = null;

      for (const row of (resp.results ?? []) as any[]) {
        if (row?.object !== "page") continue;
        const props = (row?.properties ?? {}) as Record<string, unknown>;
        // 兜底：relation 确实包含该知识页
        const rel = relationIds(props[SESSION_PROP_RELATION]);
        if (!rel.includes(knowledgePageId)) continue;
        sessionCount += 1;
        const d = datePlain(props[SESSION_PROP_DATE]);
        if (!lastStudyDate && d) lastStudyDate = d;
        const s = scorePlain(props[SESSION_PROP_SCORE]);
        if (typeof s === "number") bestScore = bestScore == null ? s : Math.max(bestScore, s);
      }

      progress.push({ knowledgePageId, sessionCount, bestScore, lastStudyDate });
    }

    return NextResponse.json(
      { progress },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

