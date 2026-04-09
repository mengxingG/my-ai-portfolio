import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SESSION_PROP_DATE = "学习日期";
const SESSION_PROP_FOCUS_MINUTES = "专注时长";

function datePlain(prop: unknown): string {
  const p = prop as { date?: { start?: string } } | undefined;
  const s = String(p?.date?.start ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

function numberPlain(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  const n = typeof p?.number === "number" ? p.number : Number(p?.number);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

export async function GET() {
  try {
    const token = process.env.NOTION_API_KEY?.trim();
    const dbId = process.env.NOTION_DATABASE_ID_SESSION?.trim();
    if (!token) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    if (!dbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION" }, { status: 500 });

    const notion: Client = createNotionClient(token);
    const today = new Date();
    const todayStr = yyyyMmDd(today);

    const db = (await withNotionRetryOnce(() =>
      notion.databases.retrieve({ database_id: dbId })
    )) as unknown as { data_sources?: Array<{ id: string }> };
    const dataSourceId = String(db?.data_sources?.[0]?.id ?? "").trim();
    if (!dataSourceId) {
      return NextResponse.json({ error: "Notion database has no data_sources" }, { status: 500 });
    }

    // 今日统计：只取今天的会话
    const todayResp = await withNotionRetryOnce(() =>
      notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        filter: {
          property: SESSION_PROP_DATE,
          date: { equals: todayStr },
        } as any,
      })
    );

    let todayStudyMinutes = 0;
    for (const page of (todayResp.results ?? []) as any[]) {
      if (page?.object !== "page") continue;
      const props = (page?.properties ?? {}) as Record<string, unknown>;
      todayStudyMinutes += numberPlain(props[SESSION_PROP_FOCUS_MINUTES]);
    }

    const todayCompletedSessions = ((todayResp.results ?? []) as any[]).filter((p) => p?.object === "page").length;

    // 连续学习天数：往回看 90 天，直到断掉
    const since = yyyyMmDd(addDays(today, -90));
    const recentResp = await withNotionRetryOnce(() =>
      notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        filter: {
          property: SESSION_PROP_DATE,
          date: { on_or_after: since },
        } as any,
        sorts: [{ property: SESSION_PROP_DATE, direction: "descending" }] as any,
      })
    );

    const daysWithSessions = new Set<string>();
    for (const page of (recentResp.results ?? []) as any[]) {
      if (page?.object !== "page") continue;
      const props = (page?.properties ?? {}) as Record<string, unknown>;
      const d = datePlain(props[SESSION_PROP_DATE]);
      if (d) daysWithSessions.add(d);
    }

    let streakDays = 0;
    for (let i = 0; i <= 90; i++) {
      const d = yyyyMmDd(addDays(today, -i));
      if (daysWithSessions.has(d)) streakDays++;
      else break;
    }

    return NextResponse.json(
      { todayStudyMinutes, todayCompletedSessions, streakDays },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

