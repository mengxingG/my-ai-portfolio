import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SESSION_PROP_TITLE = "会话名称";
const SESSION_PROP_DATE = "学习日期";
const SESSION_PROP_RELATION = "关联资料";
const SESSION_PROP_FOCUS_MINUTES = "专注时长";
const SESSION_PROP_SCORE = "掌握度评分";
const SESSION_PROP_STATUS = "学习状态";

type ReviewItem = {
  sessionId: string;
  sessionName: string;
  knowledgeTitle: string;
  knowledgePageId: string;
  lastStudyDate: string;
  daysSinceStudy: number;
  lastScore: number;
  reviewRound: number;
  status: "待复习";
};

function titlePlain(prop: unknown): string {
  const p = prop as { title?: Array<{ plain_text?: string }> } | undefined;
  const t = p?.title;
  if (!Array.isArray(t) || t.length === 0) return "";
  return t[0]?.plain_text ?? "";
}

function statusPlain(prop: unknown): string {
  const p = prop as { status?: { name?: string } } | undefined;
  return String(p?.status?.name ?? "").trim();
}

function datePlain(prop: unknown): string {
  const p = prop as { date?: { start?: string } } | undefined;
  const s = String(p?.date?.start ?? "").trim();
  return s ? s.slice(0, 10) : "";
}

function numberPlain(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  const n = typeof p?.number === "number" ? p.number : Number(p?.number);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function relationIds(prop: unknown): string[] {
  const p = prop as { relation?: Array<{ id?: string }> } | undefined;
  const r = p?.relation;
  if (!Array.isArray(r) || r.length === 0) return [];
  return r.map((x) => String(x?.id ?? "").trim()).filter(Boolean).slice(0, 1);
}

function findTitleKey(properties: Record<string, unknown>): string | null {
  for (const [k, v] of Object.entries(properties)) {
    if ((v as { type?: string })?.type === "title") return k;
  }
  for (const k of ["资料名称", "Name", "Title"]) {
    if (k in properties) return k;
  }
  return null;
}

function parseYYYYMMDD(s: string): Date | null {
  const t = String(s ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00`);
  return Number.isFinite(d.getTime()) ? d : null;
}

function daysBetween(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const t1 = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const t2 = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((t2 - t1) / ms);
}

const TARGET_DAYS = [1, 3, 7, 14, 30];
const TOLERANCE = 1;

function pickReviewRound(daysSince: number): number | null {
  for (let i = 0; i < TARGET_DAYS.length; i++) {
    const d = TARGET_DAYS[i]!;
    if (Math.abs(daysSince - d) <= TOLERANCE) return i + 1;
  }
  return null;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function GET() {
  try {
    const token = process.env.NOTION_API_KEY?.trim();
    const dbId = process.env.NOTION_DATABASE_ID_SESSION?.trim();
    if (!token) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    if (!dbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION" }, { status: 500 });

    const notion: Client = createNotionClient(token);
    const today = new Date();

    // 本仓库使用 Notion「dataSources.query」来拉取数据库 rows
    const db = (await withNotionRetryOnce(() =>
      notion.databases.retrieve({ database_id: dbId })
    )) as unknown as { data_sources?: Array<{ id: string }> };
    const dataSourceId = String(db?.data_sources?.[0]?.id ?? "").trim();
    if (!dataSourceId) {
      return NextResponse.json({ error: "Notion database has no data_sources" }, { status: 500 });
    }

    const sessions = await withNotionRetryOnce(() =>
      notion.dataSources.query({
        data_source_id: dataSourceId,
        page_size: 100,
        filter: {
          and: [
            {
              property: SESSION_PROP_STATUS,
              status: { equals: "待复习" },
            },
          ],
        } as any,
        sorts: [{ property: SESSION_PROP_DATE, direction: "descending" }] as any,
      })
    );

    const reviewItems: ReviewItem[] = [];
    const knowledgeTitleCache = new Map<string, string>();
    const grouped = new Map<
      string,
      {
        sessionId: string;
        sessionName: string;
        knowledgePageId: string;
        lastStudyDate: string;
        daysSinceStudy: number;
        reviewRound: number;
        bestScore: number;
      }
    >();

    for (const page of (sessions.results ?? []) as any[]) {
      if (page?.object !== "page") continue;
      const sessionId = String(page?.id ?? "").trim();
      const props = (page?.properties ?? {}) as Record<string, unknown>;
      const status = statusPlain(props[SESSION_PROP_STATUS]);
      if (status !== "待复习") continue;

      const lastStudyDate = datePlain(props[SESSION_PROP_DATE]);
      const d0 = parseYYYYMMDD(lastStudyDate);
      if (!d0) continue;
      const daysSinceStudy = daysBetween(d0, today);
      const reviewRound = pickReviewRound(daysSinceStudy);
      if (!reviewRound) continue;

      const sessionName = titlePlain(props[SESSION_PROP_TITLE]) || "学习会话";
      const lastScore = numberPlain(props[SESSION_PROP_SCORE]);

      const knowledgePageId = relationIds(props[SESSION_PROP_RELATION])[0] ?? "";
      if (!knowledgePageId) continue;

      // 排除「已完成」类：掌握度 ≥ 80 不再提醒
      if (lastScore >= 80) continue;

      const existing = grouped.get(knowledgePageId);
      if (!existing) {
        grouped.set(knowledgePageId, {
          sessionId,
          sessionName,
          knowledgePageId,
          lastStudyDate,
          daysSinceStudy,
          reviewRound,
          bestScore: lastScore,
        });
      } else {
        // 最近一次学习日期：由于 query 已按学习日期降序排序，这里第一次命中的就是“最近一次”
        // 所以 existing.lastStudyDate 不需要更新
        existing.bestScore = Math.max(existing.bestScore, lastScore);
        grouped.set(knowledgePageId, existing);
      }
    }

    for (const g of grouped.values()) {
      let knowledgeTitle = knowledgeTitleCache.get(g.knowledgePageId) ?? "";
      if (!knowledgeTitle) {
        // Notion rate limit ~3rps：串行 + 小 sleep
        await sleep(380);
        const knowledgePage = await withNotionRetryOnce(() =>
          notion.pages.retrieve({ page_id: g.knowledgePageId })
        );
        const kprops = ((knowledgePage as unknown as { properties?: Record<string, unknown> })?.properties ??
          {}) as Record<string, unknown>;
        const titleKey = findTitleKey(kprops);
        knowledgeTitle = titleKey ? titlePlain(kprops[titleKey]) : "";
        knowledgeTitle = knowledgeTitle || "（未命名资料）";
        knowledgeTitleCache.set(g.knowledgePageId, knowledgeTitle);
      }

      reviewItems.push({
        sessionId: g.sessionId,
        sessionName: g.sessionName,
        knowledgeTitle,
        knowledgePageId: g.knowledgePageId,
        lastStudyDate: g.lastStudyDate,
        daysSinceStudy: g.daysSinceStudy,
        lastScore: g.bestScore,
        reviewRound: g.reviewRound,
        status: "待复习",
      });
    }

    return NextResponse.json(
      { reviewItems, totalReviewCount: reviewItems.length },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

