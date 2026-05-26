import type { Client } from "@notionhq/client";
import { createNotionClient } from "@/lib/notion-client";
import { withNotionRetryOnce } from "@/lib/notion-retry";
import { objectTypeDisplayLabel } from "@/lib/hv-analysis/object-type-adaptation";
import type { HvQaResult } from "@/lib/hv-analysis/qa-types";
import { stripProtocolLines } from "@/lib/hv-analysis/report-markdown";

/** Notion rich_text 单段上限（用户规范：按 2000 字切分） */
export const HV_NOTION_RICH_TEXT_MAX = 2000;

const APPEND_BATCH = 100;
/** Notion ~3 req/s：批次追加间隔 */
const NOTION_APPEND_GAP_MS = 340;

export type SaveHvAnalysisReportArgs = {
  targetName: string;
  /** 含报告头、各章正文、附录；协议行会在写入前剥离 */
  fullMarkdown: string;
  modelId: string;
  /** 研究对象类型（product / company / …） */
  objectType?: string;
  /** 核心关注点（表单 researchMotivation / additionalContext） */
  motivation?: string;
  /** 指定对标竞品 */
  competitors?: string;
  /** 14 条军规质检结果，写入 Notion QA_Data 列 */
  qaData?: HvQaResult | null;
  /** 质检失败时向 QA_Data 写入字面量 "{}" */
  qaDataEmpty?: boolean;
};

function richTextProperty(content: string | undefined): { rich_text: Array<{ text: { content: string } }> } | null {
  const text = String(content ?? "").trim();
  if (!text) return null;
  return {
    rich_text: [{ text: { content: text.slice(0, HV_NOTION_RICH_TEXT_MAX) } }],
  };
}

function setPropertyIfPresent(
  properties: Record<string, unknown>,
  columnName: string,
  value: Record<string, unknown> | null,
) {
  if (value) {
    properties[columnName] = value;
  }
}

/** Notion rich_text 属性：将长 JSON 切成多段 */
function qaJsonToRichTextProperty(qa: HvQaResult): { rich_text: Array<{ text: { content: string } }> } {
  const json = JSON.stringify({
    overallScore: qa.overallScore,
    items: qa.items,
    meta: qa.meta ?? null,
  });
  const rich_text: Array<{ text: { content: string } }> = [];
  for (let i = 0; i < json.length; i += HV_NOTION_RICH_TEXT_MAX) {
    rich_text.push({ text: { content: json.slice(i, i + HV_NOTION_RICH_TEXT_MAX) } });
  }
  if (rich_text.length === 0) {
    rich_text.push({ text: { content: "{}" } });
  }
  return { rich_text };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export function getHvNotionAuthToken(): string | null {
  return (
    process.env.NOTION_TOKEN?.trim() ||
    process.env.NOTION_API_KEY?.trim() ||
    null
  );
}

/**
 * 将 Markdown 按固定长度切分，每段生成一个 paragraph block（单段 rich_text）。
 */
export function splitMarkdownToNotionParagraphBlocks(
  markdown: string,
  chunkSize = HV_NOTION_RICH_TEXT_MAX,
): Array<Record<string, unknown>> {
  const text = String(markdown ?? "").replace(/\r\n/g, "\n");
  if (!text) return [];

  const blocks: Array<Record<string, unknown>> = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    const slice = text.slice(i, i + chunkSize);
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: {
        rich_text: [{ type: "text", text: { content: slice } }],
      },
    });
  }
  return blocks;
}

/** 与 Notion hvSearch 库列名 1:1（见数据库截图，可用环境变量覆盖） */
const HV_NOTION_COLUMNS = {
  title: () => process.env.NOTION_HV_PROP_TITLE?.trim() || "研究对象",
  type: () => process.env.NOTION_HV_PROP_TYPE?.trim() || "type",
  motivation: () => process.env.NOTION_HV_PROP_MOTIVATION?.trim() || "Motivation",
  competitors: () => process.env.NOTION_HV_PROP_COMPETITORS?.trim() || "Competitors",
  target: () => process.env.NOTION_HV_PROP_TARGET?.trim() || "Target",
  model: () => process.env.NOTION_HV_PROP_MODEL?.trim() || "Model",
  qaData: () => process.env.NOTION_HV_PROP_QA_DATA?.trim() || "QA_Data",
  score: () => process.env.NOTION_HV_PROP_SCORE?.trim() || "Score",
  createdAt: () => process.env.NOTION_HV_PROP_CREATED_AT?.trim() || "CreatedAt",
} as const;

function buildPageProperties(args: SaveHvAnalysisReportArgs): Record<string, unknown> {
  const pageTitle = `${args.targetName.trim()} · 横纵分析`.slice(0, 180);
  const properties: Record<string, unknown> = {
    [HV_NOTION_COLUMNS.title()]: {
      title: [{ text: { content: pageTitle } }],
    },
  };

  setPropertyIfPresent(
    properties,
    HV_NOTION_COLUMNS.target(),
    richTextProperty(args.targetName.trim()),
  );

  const typeLabel = args.objectType
    ? objectTypeDisplayLabel(args.objectType)
    : "";
  setPropertyIfPresent(properties, HV_NOTION_COLUMNS.type(), richTextProperty(typeLabel));

  setPropertyIfPresent(
    properties,
    HV_NOTION_COLUMNS.model(),
    richTextProperty(args.modelId),
  );

  setPropertyIfPresent(
    properties,
    HV_NOTION_COLUMNS.motivation(),
    richTextProperty(args.motivation),
  );

  setPropertyIfPresent(
    properties,
    HV_NOTION_COLUMNS.competitors(),
    richTextProperty(args.competitors),
  );

  properties[HV_NOTION_COLUMNS.createdAt()] = {
    date: { start: new Date().toISOString().slice(0, 10) },
  };

  const colScore = HV_NOTION_COLUMNS.score();
  if (args.qaData && Number.isFinite(args.qaData.overallScore)) {
    properties[colScore] = { number: args.qaData.overallScore };
  }

  const propQa = HV_NOTION_COLUMNS.qaData();
  if (args.qaDataEmpty) {
    properties[propQa] = { rich_text: [{ text: { content: "{}" } }] };
  } else if (args.qaData) {
    properties[propQa] = qaJsonToRichTextProperty(args.qaData);
  }

  return properties;
}

/**
 * 将完整 HV 报告写入 Notion 数据库。未配置 token / database 时静默跳过。
 */
export async function saveHvAnalysisReportToNotion(
  args: SaveHvAnalysisReportArgs,
): Promise<{ pageId: string } | null> {
  const token = getHvNotionAuthToken();
  const databaseId = process.env.NOTION_DATABASE_ID_HV_ANALYSIS?.trim();
  if (!token || !databaseId) {
    throw new Error(
      "Missing NOTION_TOKEN/NOTION_API_KEY or NOTION_DATABASE_ID_HV_ANALYSIS",
    );
  }

  const bodyMd = stripProtocolLines(args.fullMarkdown);
  if (!bodyMd.trim()) {
    throw new Error("报告正文为空，无法写入 Notion");
  }

  const notion = createNotionClient(token);
  const properties = buildPageProperties(args) as Parameters<
    Client["pages"]["create"]
  >[0]["properties"];

  const bodyBlocks = splitMarkdownToNotionParagraphBlocks(bodyMd);
  const allChildren = [
    {
      object: "block",
      type: "heading_2",
      heading_2: {
        rich_text: [{ type: "text", text: { content: "完整报告正文（Markdown）" } }],
      },
    },
    ...bodyBlocks,
  ] as Array<Record<string, unknown>>;

  const childrenArr = allChildren as unknown as Array<
    Parameters<Client["blocks"]["children"]["append"]>[0]["children"][number]
  >;
  const batches = chunkArray(childrenArr, APPEND_BATCH);
  const firstBatch = batches[0] ?? [];

  const page = await withNotionRetryOnce(() =>
    notion.pages.create({
      parent: { database_id: databaseId },
      properties,
      children: firstBatch as unknown as Parameters<Client["pages"]["create"]>[0]["children"],
    }),
  );

  const pageId = String((page as { id?: string })?.id ?? "");
  if (!pageId) {
    throw new Error("Notion pages.create returned no page id");
  }

  for (const batch of batches.slice(1)) {
    if (!batch.length) continue;
    await sleep(NOTION_APPEND_GAP_MS);
    await withNotionRetryOnce(() =>
      notion.blocks.children.append({
        block_id: pageId,
        children: batch,
      }),
    );
  }

  console.info("[hv-analysis/notion] saved report page:", pageId);
  return { pageId };
}
