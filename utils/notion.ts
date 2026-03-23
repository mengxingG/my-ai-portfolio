// 1. 首页列表：彻底抛弃有 Bug 的 SDK，使用原生 Fetch 直连 Notion 官方 API
export async function fetchPublishedArticlesFromNotion() {
  const url = `https://api.notion.com/v1/databases/${process.env.NOTION_DATABASE_ID}/query`;
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28', // 必须指定的官方 API 版本
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      filter: {
        property: 'Status',
        multi_select: { contains: 'Published' }
      }
    }),
    cache: 'no-store' as RequestCache // 禁用缓存，确保发布文章秒同步
  };

  try {
    const res = await fetch(url, options);
    
    // 如果配置真的有问题，原生 Fetch 会精准捕获并打印出 Notion 的真实报错！
    if (!res.ok) {
      const errorData = await res.json();
      console.error("【Notion 官方接口拒绝访问】:", errorData);
      throw new Error(`API 调用失败: ${res.status}`);
    }

    const data = await res.json();
    return data.results.map((page: any) => ({
      id: page.id,
      title: page.properties.Title?.title[0]?.plain_text || '未命名文章',
      summary: page.properties.Summary?.rich_text[0]?.plain_text || '',
      created_at: page.created_time,
    }));
  } catch (error) {
    console.error("【底层网络请求错误】:", error);
    throw error;
  }
}

const MAX_BLOCK_DEPTH = 20;

/** 同一层级内并行拉取所有 has_children 的子 blocks，显著减少串行 RTT */
async function flattenBlocksParallel(
  input: any[],
  depth: number,
  fetchChildren: (blockId: string) => Promise<any[]>
): Promise<any[]> {
  if (depth > MAX_BLOCK_DEPTH || !input?.length) return [];

  const withChildren = input.filter((b) => b?.has_children);
  const childrenLists = await Promise.all(
    withChildren.map((b) => fetchChildren(b.id))
  );

  let childIdx = 0;
  const out: any[] = [];
  for (const b of input) {
    out.push(b);
    if (b?.has_children) {
      const children = childrenLists[childIdx++];
      if (children?.length) {
        out.push(
          ...(await flattenBlocksParallel(children, depth + 1, fetchChildren))
        );
      }
    }
  }
  return out;
}

/** 文章详情用的 Notion fetch：带 tag，便于 POST /api/revalidate 按需失效（发布后立即更新） */
function articleNotionFetchInit(pageId: string) {
  return {
    headers: {
      Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
      "Notion-Version": "2022-06-28",
    },
    next: {
      tags: [`article-${pageId}`, "articles"],
      /** 不设时间窗，只靠 revalidateTag；长期命中缓存 = 极快 */
      revalidate: false as const,
    },
  };
}

async function fetchArticleDetailFromNotion(pageId: string) {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const init = articleNotionFetchInit(pageId);

  const res = await fetch(url, { method: "GET", ...init });
  const page: any = await res.json();

  const fetchChildren = async (blockId: string) => {
    const blocksUrl = `https://api.notion.com/v1/blocks/${blockId}/children`;
    const blocksRes = await fetch(blocksUrl, { method: "GET", ...init });
    const blocksData = await blocksRes.json();
    return blocksData.results || [];
  };

  const topBlocksUrl = `https://api.notion.com/v1/blocks/${pageId}/children`;
  const topBlocksRes = await fetch(topBlocksUrl, { method: "GET", ...init });
  const topBlocksData = await topBlocksRes.json();
  const topBlocks: any[] = topBlocksData.results || [];

  const blocks = await flattenBlocksParallel(topBlocks, 0, fetchChildren);

  return {
    id: page.id,
    title:
      page.properties.Title?.title?.[0]?.plain_text ||
      page.properties.Name?.title?.[0]?.plain_text ||
      "未命名文章",
    created_at: page.created_time,
    blocks,
  };
}

/**
 * 文章详情：并行抓取 + Next fetch 数据缓存（tag 控制）
 * 发布后调用 POST /api/revalidate 传入对应 pageId 即可立即刷新，仍保持缓存命中时极快。
 */
export async function getArticleDetail(pageId: string) {
  try {
    return await fetchArticleDetailFromNotion(pageId);
  } catch (error) {
    console.error("获取详情失败:", error);
    throw error;
  }
}

// 别忘了定义类型导出
export type ArticleDetail = {
  id: string;
  title: string;
  created_at: string;
  blocks: any[];
};

/** AI News Radar：与 Notion 数据库字段一一对应 */
export type AINews = {
  id: string;
  source: string;
  author: string;
  title: string;
  originalText: string;
  date: string;
  url: string;
};

function newsRichTextPlain(prop: any): string {
  const rt = prop?.rich_text;
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt[0]?.plain_text ?? "";
}

function newsTitlePlain(prop: any): string {
  const t = prop?.title;
  if (!Array.isArray(t) || t.length === 0) return "";
  return t[0]?.plain_text ?? "";
}

function normalizeNewsSource(selectName: string): "X" | "YouTube" {
  const n = (selectName || "").trim().toLowerCase();
  if (n === "x" || n === "twitter") return "X";
  return "YouTube";
}

function mapNotionPageToAINews(page: any): AINews | null {
  const props = page?.properties ?? {};
  const url = props.URL?.url;
  if (!url || typeof url !== "string") return null;

  const sourceName =
    props.Source?.select?.name ??
    newsRichTextPlain(props.Source) ??
    newsTitlePlain(props.Source) ??
    "";
  const author =
    newsRichTextPlain(props.Author) ||
    newsTitlePlain(props.Author) ||
    "—";

  const title = newsTitlePlain(props.Title) || "未命名";

  const originalText =
    newsRichTextPlain(props.originalText) ||
    newsRichTextPlain(props.OriginalText) ||
    newsRichTextPlain(props["Original text"]) ||
    "";

  const dateStart = props.Date?.date?.start;
  const date =
    typeof dateStart === "string" && dateStart.length >= 10
      ? dateStart.slice(0, 10)
      : dateStart
        ? String(dateStart).slice(0, 10)
        : "";

  return {
    id: page.id,
    source: normalizeNewsSource(sourceName),
    author,
    title,
    originalText,
    date,
    url,
  };
}

/**
 * AI News Radar：使用 @notionhq/client（require 避免 Turbopack 问题）
 */
export async function fetchAINewsRadarFromNotion(): Promise<AINews[]> {
  const databaseId = process.env.NOTION_AI_NEWS_DB_ID;
  const apiKey = process.env.NOTION_API_KEY;
  if (!databaseId || !apiKey) {
    throw new Error("Missing NOTION_AI_NEWS_DB_ID or NOTION_API_KEY");
  }

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Client } = require("@notionhq/client") as typeof import("@notionhq/client");
  const notion = new Client({ auth: apiKey });

  try {
    // @notionhq/client v5+：数据库查询改为 dataSources.query，需先从 database 取 data_source_id
    const database = (await notion.databases.retrieve({
      database_id: databaseId,
    })) as { data_sources?: Array<{ id: string }> };

    const dataSourceId = database?.data_sources?.[0]?.id;
    if (!dataSourceId) {
      throw new Error("Notion database has no data_sources; cannot query AI News Radar");
    }

    const baseQuery = {
      data_source_id: dataSourceId,
      sorts: [{ property: "Date", direction: "descending" as const }],
    };
    const response = await notion.dataSources.query({
      ...baseQuery,
    });

    const rows = (response.results ?? []) as any[];
    return rows
      .filter((p) => p?.object === "page")
      .map((p) => mapNotionPageToAINews(p))
      .filter((x): x is AINews => x !== null);
  } catch (error) {
    console.error("【Notion AI News Radar 真实报错】:", error);
    throw error;
  }
}
