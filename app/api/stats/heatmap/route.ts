import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SESSION_PROP_DATE = "学习日期";
const SESSION_PROP_FOCUS_MINUTES = "专注时长";
const SESSION_PROP_SCORE = "掌握度评分";
const SESSION_PROP_STATUS = "学习状态";

type HeatmapRow = { date: string; count: number; totalMinutes: number; avgScore: number; intensity: number };
type Summary = {
  totalDays: number;
  totalSessions: number;
  totalMinutes: number;
  currentStreak: number;
  longestStreak: number;
};

function datePlain(prop: unknown): string {
  const p = prop as { date?: { start?: string } } | undefined;
  const s = String(p?.date?.start ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

function numberPlain(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  const n = typeof p?.number === "number" ? p.number : Number(p?.number);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function scorePlain(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  const n = typeof p?.number === "number" ? p.number : Number(p?.number);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function statusName(prop: unknown): string {
  const p = prop as { status?: { name?: string } } | undefined;
  return String(p?.status?.name ?? "").trim();
}

function yyyyMmDd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, delta: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + delta);
  return x;
}

function computeStreaks(activeDays: Set<string>, today: Date): { current: number; longest: number } {
  const dayList = Array.from(activeDays).sort(); // YYYY-MM-DD lexical == chronological
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  const toDate = (s: string) => new Date(`${s}T00:00:00`);
  const diffDays = (a: string, b: string) =>
    Math.round(
      (Date.UTC(toDate(b).getFullYear(), toDate(b).getMonth(), toDate(b).getDate()) -
        Date.UTC(toDate(a).getFullYear(), toDate(a).getMonth(), toDate(a).getDate())) /
        (24 * 60 * 60 * 1000)
    );

  for (const d of dayList) {
    if (!prev) {
      run = 1;
    } else {
      run = diffDays(prev, d) === 1 ? run + 1 : 1;
    }
    prev = d;
    if (run > longest) longest = run;
  }

  let current = 0;
  for (let i = 0; i < 90; i++) {
    const ds = yyyyMmDd(addDays(today, -i));
    if (activeDays.has(ds)) current++;
    else break;
  }
  return { current, longest };
}

export async function GET() {
  try {
    const token = process.env.NOTION_API_KEY?.trim();
    const dbId = process.env.NOTION_DATABASE_ID_SESSION?.trim();
    if (!token) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    if (!dbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION" }, { status: 500 });

    const notion: Client = createNotionClient(token);
    const today = new Date();
    const since = yyyyMmDd(addDays(today, -90));

    const db = (await withNotionRetryOnce(() =>
      notion.databases.retrieve({ database_id: dbId })
    )) as unknown as { data_sources?: Array<{ id: string }> };
    const dataSourceId = String(db?.data_sources?.[0]?.id ?? "").trim();
    if (!dataSourceId) {
      return NextResponse.json({ error: "Notion database has no data_sources" }, { status: 500 });
    }

    const byDate = new Map<
      string,
      { date: string; count: number; totalMinutes: number; scoreSum: number; scoreCount: number }
    >();

    let cursor: string | undefined = undefined;
    for (let pageNo = 0; pageNo < 6; pageNo++) {
      const resp = await withNotionRetryOnce(() =>
        notion.dataSources.query({
          data_source_id: dataSourceId,
          page_size: 100,
          start_cursor: cursor,
          filter: {
            and: [
              {
                property: SESSION_PROP_DATE,
                date: { on_or_after: since },
              },
              // “状态不为空”：尽量在 API 层先过滤；若 Notion 不支持该 filter，会在前端/JS 再兜底
              {
                property: SESSION_PROP_STATUS,
                status: { is_not_empty: true },
              },
            ],
          } as any,
          sorts: [{ property: SESSION_PROP_DATE, direction: "ascending" }] as any,
        })
      );

      const results = (resp.results ?? []) as any[];
      for (const row of results) {
        if (row?.object !== "page") continue;
        const props = (row?.properties ?? {}) as Record<string, unknown>;
        const status = statusName(props[SESSION_PROP_STATUS]);
        if (!status) continue;
        const date = datePlain(props[SESSION_PROP_DATE]);
        if (!date) continue;
        const totalMinutes = numberPlain(props[SESSION_PROP_FOCUS_MINUTES]);
        const score = scorePlain(props[SESSION_PROP_SCORE]);

        const cur = byDate.get(date) ?? {
          date,
          count: 0,
          totalMinutes: 0,
          scoreSum: 0,
          scoreCount: 0,
        };
        cur.count += 1;
        cur.totalMinutes += Math.max(0, totalMinutes);
        if (score > 0) {
          cur.scoreSum += score;
          cur.scoreCount += 1;
        }
        byDate.set(date, cur);
      }

      if (!resp.has_more) break;
      cursor = resp.next_cursor ?? undefined;
      if (!cursor) break;
    }

    const heatmapData: HeatmapRow[] = Array.from(byDate.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((x) => ({
        date: x.date,
        count: x.count,
        totalMinutes: x.totalMinutes,
        avgScore: x.scoreCount ? Math.round(x.scoreSum / x.scoreCount) : 0,
        intensity: Math.max(
          0,
          Math.round(x.totalMinutes * 0.6 + (x.scoreCount ? Math.round(x.scoreSum / x.scoreCount) : 0) * 0.4)
        ),
      }));

    const activeDays = new Set(heatmapData.filter((d) => d.count > 0).map((d) => d.date));
    const { current, longest } = computeStreaks(activeDays, today);

    const summary: Summary = {
      totalDays: activeDays.size,
      totalSessions: heatmapData.reduce((s, d) => s + d.count, 0),
      totalMinutes: heatmapData.reduce((s, d) => s + d.totalMinutes, 0),
      currentStreak: current,
      longestStreak: longest,
    };

    return NextResponse.json(
      { heatmapData, summary },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

