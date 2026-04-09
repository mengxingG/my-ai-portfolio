import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const KNOWLEDGE_PROP_KEYWORDS = "核心关键词";
const KNOWLEDGE_PROP_STATUS = "学习状态";

const SESSION_PROP_RELATION = "关联资料";
const SESSION_PROP_SCORE = "掌握度评分";

type Dimension = { keyword: string; avgScore: number; resourceCount: number };

function multiSelectNames(prop: unknown): string[] {
  const p = prop as { multi_select?: Array<{ name?: string }> } | undefined;
  const ms = p?.multi_select;
  if (!Array.isArray(ms) || ms.length === 0) return [];
  return ms.map((x) => String(x?.name ?? "").trim()).filter(Boolean);
}

function statusName(prop: unknown): string {
  const p = prop as { status?: { name?: string }; select?: { name?: string } } | undefined;
  return String(p?.status?.name ?? p?.select?.name ?? "").trim();
}

function scoreNumber(prop: unknown): number {
  const p = prop as { number?: number | null } | undefined;
  const raw = typeof p?.number === "number" ? p.number : null;
  // null -> 0（按需求）
  if (raw == null || !Number.isFinite(raw)) return 0;
  // Notion「百分比」格式底层常用 0..1 表示 0%..100%
  const normalized = raw > 0 && raw <= 1 ? raw * 100 : raw;
  return Math.max(0, Math.min(100, Math.round(normalized)));
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

export async function GET() {
  try {
    const token = process.env.NOTION_API_KEY?.trim();
    const knowledgeDbId = process.env.NOTION_DATABASE_ID_KNOWLEDGE?.trim();
    const sessionDbId = process.env.NOTION_DATABASE_ID_SESSION?.trim();
    if (!token) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
    if (!knowledgeDbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_KNOWLEDGE" }, { status: 500 });
    if (!sessionDbId) return NextResponse.json({ error: "Missing NOTION_DATABASE_ID_SESSION" }, { status: 500 });

    const notion: Client = createNotionClient(token);

    const knowledgeDb = (await withNotionRetryOnce(() =>
      notion.databases.retrieve({ database_id: knowledgeDbId })
    )) as unknown as { data_sources?: Array<{ id: string }> };
    const knowledgeDsId = String(knowledgeDb?.data_sources?.[0]?.id ?? "").trim();
    if (!knowledgeDsId) return NextResponse.json({ error: "Knowledge database has no data_sources" }, { status: 500 });

    const sessionDb = (await withNotionRetryOnce(() =>
      notion.databases.retrieve({ database_id: sessionDbId })
    )) as unknown as { data_sources?: Array<{ id: string }> };
    const sessionDsId = String(sessionDb?.data_sources?.[0]?.id ?? "").trim();
    if (!sessionDsId) return NextResponse.json({ error: "Session database has no data_sources" }, { status: 500 });

    const isPureEnglishShort = (kw: string) => /^[A-Za-z]+$/.test(kw) && kw.length <= 3;
    const banned = new Set(["Demis", "Hassabis"]);
    const isKeywordAllowed = (kw: string) => {
      const t = String(kw ?? "").trim();
      if (!t) return false;
      if (banned.has(t)) return false;
      if (isPureEnglishShort(t)) return false;
      return true;
    };

    // 拉知识库条目（最多 200），仅保留 status != 未开始 且有核心关键词
    const knowledgeRows: Array<{ id: string; title: string; keywords: string[]; status: string }> = [];
    let cursor: string | undefined = undefined;
    for (let pageNo = 0; pageNo < 4; pageNo++) {
      const resp = await withNotionRetryOnce(() =>
        notion.dataSources.query({
          data_source_id: knowledgeDsId,
          page_size: 100,
          start_cursor: cursor,
          sorts: [{ timestamp: "created_time", direction: "descending" }],
        })
      );
      for (const row of (resp.results ?? []) as any[]) {
        if (row?.object !== "page") continue;
        const id = String(row?.id ?? "").trim();
        if (!id) continue;
        const props = (row?.properties ?? {}) as Record<string, any>;
        const status = statusName(props[KNOWLEDGE_PROP_STATUS]);
        if (status === "未开始") continue;
        const keywords = multiSelectNames(props[KNOWLEDGE_PROP_KEYWORDS])
          .map((k) => k.trim())
          .filter(isKeywordAllowed)
          .slice(0, 30);
        if (!keywords.length) continue;
        const title = String(props?.["资料名称"]?.title?.[0]?.plain_text ?? props?.["Name"]?.title?.[0]?.plain_text ?? "")
          .trim();
        knowledgeRows.push({ id, title: title || id.slice(0, 8), keywords, status });
      }
      if (!resp.has_more) break;
      cursor = resp.next_cursor ?? undefined;
      if (!cursor) break;
    }

    // keyword -> resources map (per resource uses best score across sessions)
    const kwResourceMap = new Map<
      string,
      Array<{ id: string; title: string; sessionCount: number; allScores: number[]; bestScore: number }>
    >();
    const kwFreq = new Map<string, number>(); // by resourceCount

    // 对每条资料：查询其 sessions，取最高分 bestScore（null -> 0）
    for (const r of knowledgeRows) {
      await sleep(350);
      const sessionResp = await withNotionRetryOnce(() =>
        notion.dataSources.query({
          data_source_id: sessionDsId,
          page_size: 100,
          filter: {
            and: [
              {
                property: SESSION_PROP_RELATION,
                relation: { contains: r.id },
              },
            ],
          } as any,
        })
      );

      let best = 0;
      const allScores: number[] = [];
      let sessionCount = 0;
      for (const row of (sessionResp.results ?? []) as any[]) {
        if (row?.object !== "page") continue;
        const props = (row?.properties ?? {}) as Record<string, unknown>;
        const rel = relationIds(props[SESSION_PROP_RELATION]);
        if (!rel.includes(r.id)) continue;
        const s = scoreNumber((props as any)[SESSION_PROP_SCORE]);
        sessionCount += 1;
        allScores.push(s);
        if (s > best) best = s;
      }

      for (const kw of r.keywords) {
        const t = kw.trim();
        if (!t) continue;
        const list = kwResourceMap.get(t) ?? [];
        list.push({ id: r.id, title: r.title, sessionCount, allScores, bestScore: best });
        kwResourceMap.set(t, list);
      }
    }

    // build dimensions: avgScore is avg of bestScore across resources, excluding 0 (unless all 0 -> 0)
    const kwAvg = new Map<string, { avgScore: number; resourceCount: number; nonZeroCount: number }>();
    for (const [kw, resources] of kwResourceMap.entries()) {
      const resourceCount = resources.length;
      const nonZero = resources.filter((x) => x.bestScore > 0);
      const nonZeroCount = nonZero.length;
      const avgScore =
        nonZeroCount > 0
          ? Math.round(nonZero.reduce((sum, x) => sum + x.bestScore, 0) / nonZeroCount)
          : 0;
      kwAvg.set(kw, { avgScore, resourceCount, nonZeroCount });
      kwFreq.set(kw, resourceCount);
    }

    // 关键词过滤：优先只保留出现 ≥2 份资料的；若不足 3 个维度，再降到 ≥1
    const MIN_DIM = 3;
    let candidates = Array.from(kwAvg.entries())
      .map(([keyword, v]) => ({ keyword, ...v }))
      .filter((x) => x.resourceCount >= 2);
    if (candidates.length < MIN_DIM) {
      candidates = Array.from(kwAvg.entries()).map(([keyword, v]) => ({ keyword, ...v }));
    }

    const sorted = candidates
      .sort((a, b) => (b.resourceCount - a.resourceCount) || (b.avgScore - a.avgScore) || a.keyword.localeCompare(b.keyword))
      .slice(0, 8);

    const dimensions: Dimension[] = sorted.map((x) => ({
      keyword: x.keyword,
      avgScore: x.avgScore,
      resourceCount: x.resourceCount,
    }));

    const debug: Record<
      string,
      {
        resources: Array<{ title: string; sessionCount: number; allScores: number[]; bestScore: number }>;
        avgScore: number;
      }
    > = {};
    for (const d of dimensions) {
      const resources = (kwResourceMap.get(d.keyword) ?? []).map((r) => ({
        title: r.title,
        sessionCount: r.sessionCount,
        allScores: r.allScores,
        bestScore: r.bestScore,
      }));
      debug[d.keyword] = { resources, avgScore: d.avgScore };
    }

    return NextResponse.json({ dimensions, debug }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message ?? String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

