import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';

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

// 2. 详情页：暂留 SDK 配合 Markdown 解析器（因为它是单例）
// 获取文章正文详情（原生 Fetch 版）
// utils/notion.ts 里的详情函数
export async function getArticleDetail(pageId: string) {
  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.NOTION_API_KEY}`,
      'Notion-Version': '2022-06-28',
    },
  };

  try {
    const res = await fetch(url, options);
    const page: any = await res.json();

    const MAX_DEPTH = 20;

    const fetchChildren = async (blockId: string, depth: number) => {
      if (depth > MAX_DEPTH) return [];
      const blocksUrl = `https://api.notion.com/v1/blocks/${blockId}/children`;
      const blocksRes = await fetch(blocksUrl, options);
      const blocksData = await blocksRes.json();
      return blocksData.results || [];
    };

    // 递归将 blocks 展开到最底层（按 Notion 展示顺序：父在前，子在后）
    const flattenBlocks = async (input: any[], depth: number): Promise<any[]> => {
      const out: any[] = [];
      for (const b of input) {
        out.push(b);
        if (b?.has_children) {
          const children = await fetchChildren(b.id, depth + 1);
          if (children?.length) {
            const flattened = await flattenBlocks(children, depth + 1);
            out.push(...flattened);
          }
        }
      }
      return out;
    };

    const topBlocksUrl = `https://api.notion.com/v1/blocks/${pageId}/children`;
    const topBlocksRes = await fetch(topBlocksUrl, options);
    const topBlocksData = await topBlocksRes.json();
    const topBlocks: any[] = topBlocksData.results || [];

    const blocks = await flattenBlocks(topBlocks, 0);

    return {
      id: page.id,
      title:
        page.properties.Title?.title?.[0]?.plain_text ||
        page.properties.Name?.title?.[0]?.plain_text ||
        "未命名文章",
      created_at: page.created_time,
      // 将递归展开后的 blocks 传给前端
      blocks,
    };
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
  source: "X" | "YouTube";
  author: string;
  title: string;
  originalText: string;
  date: string;
  url: string;
  tags: string[];
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

function newsMultiSelectNames(prop: any): string[] {
  const ms = prop?.multi_select;
  if (!Array.isArray(ms)) return [];
  return ms.map((x: { name?: string }) => x?.name).filter(Boolean) as string[];
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

  const sourceName = props.Source?.select?.name ?? "";
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
    tags: newsMultiSelectNames(props.Tags),
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

    const response = await notion.dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "Status",
        select: { equals: "Published" },
      },
      sorts: [{ property: "Date", direction: "descending" }],
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
