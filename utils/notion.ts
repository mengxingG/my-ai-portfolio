type NotionJson = Record<string, unknown>;

export type NotionBlock = NotionJson & {
  id?: string;
  type?: string;
  has_children?: boolean;
};

function firstTitlePlain(properties: NotionJson | undefined): string {
  if (!properties) return "未命名文章";
  const titleProp = (properties.Title ?? properties.Name) as { title?: Array<{ plain_text?: string }> } | undefined;
  const t = titleProp?.title?.[0]?.plain_text;
  return typeof t === "string" && t.length > 0 ? t : "未命名文章";
}

function firstSummaryPlain(properties: NotionJson | undefined): string {
  if (!properties) return "";
  const keys = ["Summary", "Excerpt", "OriginalText", "originalText"] as const;
  for (const k of keys) {
    const block = properties[k] as { rich_text?: Array<{ plain_text?: string }> } | undefined;
    const s = block?.rich_text?.[0]?.plain_text;
    if (typeof s === "string" && s.length > 0) return s;
  }
  return "";
}

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
    // 不依赖可变的 Status 字段，避免字段删改后整段数据失效
    body: JSON.stringify({
      // 使用 Notion 内置时间戳排序，避免依赖某个可变字段名（如 Created/Date）
      sorts: [{ timestamp: "created_time", direction: "descending" }]
    }),
    cache: 'no-store' as RequestCache // 禁用缓存，确保发布文章秒同步
  };

  try {
    const res = await fetch(url, options);
    
    // 如果配置真的有问题，原生 Fetch 会精准捕获并打印出 Notion 的真实报错！
    if (!res.ok) {
      const errorData = await res.text();
      console.error("【Notion 官方接口拒绝访问】:", errorData);
      throw new Error(`API 调用失败: ${res.status}`);
    }

    const data = (await res.json()) as { results?: NotionJson[] };
    const rows = data.results ?? [];
    return rows.map((page) => ({
      id: String(page.id ?? ""),
      title: firstTitlePlain(page.properties as NotionJson | undefined),
      summary: firstSummaryPlain(page.properties as NotionJson | undefined),
      created_at: page.created_time as string | undefined,
    }));
  } catch (error) {
    console.error("【底层网络请求错误】:", error);
    throw error;
  }
}

const MAX_BLOCK_DEPTH = 20;

/** 同一层级内并行拉取所有 has_children 的子 blocks，显著减少串行 RTT */
async function flattenBlocksParallel(
  input: NotionBlock[],
  depth: number,
  fetchChildren: (blockId: string) => Promise<NotionBlock[]>
): Promise<NotionBlock[]> {
  if (depth > MAX_BLOCK_DEPTH || !input?.length) return [];

  const withChildren = input.filter((b) => b?.has_children);
  const childrenLists = await Promise.all(
    withChildren.map((b) => fetchChildren(String(b.id)))
  );

  let childIdx = 0;
  const out: NotionBlock[] = [];
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
  const page = (await res.json()) as NotionJson & { id: string; created_time?: string; properties?: NotionJson };

  const fetchChildren = async (blockId: string): Promise<NotionBlock[]> => {
    const blocksUrl = `https://api.notion.com/v1/blocks/${blockId}/children`;
    const blocksRes = await fetch(blocksUrl, { method: "GET", ...init });
    const blocksData = (await blocksRes.json()) as { results?: NotionBlock[] };
    return blocksData.results ?? [];
  };

  const topBlocksUrl = `https://api.notion.com/v1/blocks/${pageId}/children`;
  const topBlocksRes = await fetch(topBlocksUrl, { method: "GET", ...init });
  const topBlocksData = (await topBlocksRes.json()) as { results?: NotionBlock[] };
  const topBlocks: NotionBlock[] = topBlocksData.results ?? [];

  const blocks = await flattenBlocksParallel(topBlocks, 0, fetchChildren);

  return {
    id: page.id,
    title: firstTitlePlain(page.properties),
    created_at: page.created_time ?? "",
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
  blocks: NotionBlock[];
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

function newsRichTextPlain(prop: unknown): string {
  const p = prop as { rich_text?: Array<{ plain_text?: string }> } | undefined;
  const rt = p?.rich_text;
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt[0]?.plain_text ?? "";
}

function newsTitlePlain(prop: unknown): string {
  const p = prop as { title?: Array<{ plain_text?: string }> } | undefined;
  const t = p?.title;
  if (!Array.isArray(t) || t.length === 0) return "";
  return t[0]?.plain_text ?? "";
}

function normalizeNewsSource(selectName: string): "X" | "YouTube" {
  const n = (selectName || "").trim().toLowerCase();
  if (n === "x" || n === "twitter") return "X";
  return "YouTube";
}

function mapNotionPageToAINews(page: NotionJson): AINews | null {
  const props = (page.properties as NotionJson | undefined) ?? {};
  const urlField = props.URL as { url?: string } | undefined;
  const url = urlField?.url;
  if (!url || typeof url !== "string") return null;

  const sourceBlock = props.Source as { select?: { name?: string } } | undefined;
  const sourceName =
    sourceBlock?.select?.name ??
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

  const dateBlock = props.Date as { date?: { start?: string } } | undefined;
  const dateStart = dateBlock?.date?.start;
  const date =
    typeof dateStart === "string" && dateStart.length >= 10
      ? dateStart.slice(0, 10)
      : dateStart
        ? String(dateStart).slice(0, 10)
        : "";

  return {
    id: String(page.id ?? ""),
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

    const rows = (response.results ?? []) as NotionJson[];
    return rows
      .filter((p) => p?.object === "page")
      .map((p) => mapNotionPageToAINews(p))
      .filter((x): x is AINews => x !== null);
  } catch (error) {
    console.error("【Notion AI News Radar 真实报错】:", error);
    throw error;
  }
}
