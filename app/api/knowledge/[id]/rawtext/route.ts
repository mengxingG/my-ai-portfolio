import { NextResponse } from "next/server";
import { mdToNotionBlocks } from "@/lib/mdToNotionBlocks";
import { createNotionClient } from "@/lib/notion-client";
import type { Client as NotionClient } from "@notionhq/client";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

type NotionBlock = Record<string, unknown> & {
  id?: string;
  type?: string;
  has_children?: boolean;
};

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

function blockRichTextToPlain(block: NotionBlock): string {
  const type = String(block.type ?? "");
  const typed = (block[type] as NotionBlock | undefined) ?? {};
  const rt = (typed.rich_text as Array<{ plain_text?: string }> | undefined) ?? [];
  if (!Array.isArray(rt) || rt.length === 0) return "";
  return rt.map((x) => x?.plain_text ?? "").join("").trim();
}

function isRawHeading(block: NotionBlock): boolean {
  const t = String(block.type ?? "");
  if (t !== "heading_1" && t !== "heading_2" && t !== "heading_3") return false;
  const title = blockRichTextToPlain(block).replace(/\s+/g, " ").trim();
  const lower = title.toLowerCase();
  return Boolean(
    title &&
      (title.includes("资料原文") ||
        lower.includes("rawtext") ||
        title.includes("原始资料") ||
        title.includes("原始正文") ||
        title.includes("摘录原文"))
  );
}

function isAISummaryHeading(block: NotionBlock): boolean {
  const t = String(block.type ?? "");
  if (t !== "heading_1" && t !== "heading_2" && t !== "heading_3") return false;
  const title = blockRichTextToPlain(block).replace(/\s+/g, " ").trim();
  const lower = title.toLowerCase();
  return (
    Boolean(title) &&
    (title.includes("AI 提炼大纲") ||
      title.includes("AI提炼大纲") ||
      title.startsWith("AI 提炼（") ||
      lower.includes("aisummary") ||
      title.includes("AI Markdown") ||
      title.includes("核心知识提炼") ||
      title.includes("核心知识大纲"))
  );
}

/** 与 lib/notion fetchPageBodySplit 一致：章节标题可能被存成 paragraph / callout */
function plainOneLine(block: NotionBlock): string {
  return blockRichTextToPlain(block).replace(/\s+/g, " ").trim();
}

function isAIMarker(block: NotionBlock): boolean {
  if (isAISummaryHeading(block)) return true;
  const t = String(block.type ?? "");
  if (t !== "paragraph" && t !== "callout") return false;
  const title = plainOneLine(block);
  const lower = title.toLowerCase();
  return (
    Boolean(title) &&
    (title.includes("AI 提炼大纲") ||
      title.includes("AI提炼大纲") ||
      title.startsWith("AI 提炼（") ||
      lower.includes("aisummary") ||
      title.includes("AI Markdown") ||
      title.includes("核心知识提炼") ||
      title.includes("核心知识大纲"))
  );
}

function isRawMarker(block: NotionBlock): boolean {
  if (isRawHeading(block)) return true;
  const t = String(block.type ?? "");
  if (t !== "paragraph" && t !== "callout") return false;
  const title = plainOneLine(block);
  const lower = title.toLowerCase();
  return Boolean(
    title &&
      (title.includes("资料原文") ||
        lower.includes("rawtext") ||
        title.includes("原始资料") ||
        title.includes("原始正文") ||
        title.includes("摘录原文"))
  );
}

async function listDirectBlockChildren(notion: NotionClient, parentId: string): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const resp = (await notion.blocks.children.list({
      block_id: parentId,
      page_size: 100,
      start_cursor: cursor,
    })) as {
      results?: NotionBlock[];
      next_cursor?: string | null;
      has_more?: boolean;
    };
    for (const b of resp.results ?? []) out.push(b);
    cursor = resp.has_more ? (resp.next_cursor ?? undefined) : undefined;
  } while (cursor);
  return out;
}

async function deleteDirectChildren(notion: NotionClient, parentBlockId: string): Promise<void> {
  const children = await listDirectBlockChildren(notion, parentBlockId);
  // 反向删除更稳一点（避免位置相关问题）
  for (let i = children.length - 1; i >= 0; i--) {
    const id = String(children[i]?.id ?? "");
    if (!id) continue;
    await notion.blocks.delete({ block_id: id });
    await delay(250);
  }
}

type AppendChildrenResponse = {
  results?: Array<{ id?: string }>;
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const pageId = String(id ?? "").trim();
    if (!pageId) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const body = (await req.json().catch(() => null)) as { rawText?: unknown } | null;
    const rawText = typeof body?.rawText === "string" ? body.rawText : "";

    const notionKey = process.env.NOTION_API_KEY;
    if (!notionKey) return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });

    const notion = createNotionClient(notionKey);

    const top = await listDirectBlockChildren(notion, pageId);
    const rawIdx = top.findIndex((b) => isRawMarker(b));
    const aiIdx = top.findIndex((b) => isAIMarker(b));
    if (rawIdx < 0) {
      return NextResponse.json({ error: "Notion 页面未找到“资料原文”标题块" }, { status: 422 });
    }
    if (aiIdx < 0) {
      return NextResponse.json({ error: "Notion 页面未找到“AI 提炼大纲”标题块" }, { status: 422 });
    }
    if (rawIdx >= aiIdx) {
      return NextResponse.json({ error: "资料原文标题块出现在 AI 标题之后，无法更新" }, { status: 422 });
    }

    const rawHeadingBlockId = String(top[rawIdx]?.id ?? "").trim();
    if (!rawHeadingBlockId) {
      return NextResponse.json({ error: "资料原文标题块缺少 id" }, { status: 422 });
    }

    // 清理：把 raw 标题与 AI 标题之间的顶层块删掉（避免重复展示）
    for (let i = aiIdx - 1; i > rawIdx; i--) {
      const bid = String(top[i]?.id ?? "").trim();
      if (!bid) continue;
      await notion.blocks.delete({ block_id: bid });
      await delay(250);
    }

    // 曾有过把正文挂到标题块下的实现；Notion 的普通 heading 往往不能作为子块父级，会导致 500。
    // 清理标题下残留子块（若存在），正文统一写为页面顶层块、插在标题后（与 ingest 结构一致）。
    await deleteDirectChildren(notion, rawHeadingBlockId);

    // 写入：在页面内、紧跟「资料原文」标题块之后插入新块（before「AI 提炼」标题）
    const blocks = mdToNotionBlocks(rawText);
    const MAX_BLOCKS_PER_REQUEST = 100;
    let insertAfterId = rawHeadingBlockId;
    for (let i = 0; i < blocks.length; i += MAX_BLOCKS_PER_REQUEST) {
      const chunk = blocks.slice(i, i + MAX_BLOCKS_PER_REQUEST);
      if (!chunk.length) continue;
      const resp = (await notion.blocks.children.append({
        block_id: pageId,
        children: chunk as unknown as Parameters<typeof notion.blocks.children.append>[0]["children"],
        position: {
          type: "after_block",
          after_block: { id: insertAfterId },
        },
      })) as AppendChildrenResponse;
      const created = resp.results ?? [];
      if (created.length) {
        insertAfterId = String(created[created.length - 1]?.id ?? insertAfterId);
      }
      await delay(450);
    }

    return NextResponse.json({ ok: true, rawTextLen: rawText.length });
  } catch (error) {
    const err = error as {
      message?: string;
      code?: string;
      status?: number;
      body?: unknown;
    };
    const message = err?.message ?? "Unknown error";
    console.error("[/api/knowledge/:id/rawtext] failed:", error);
    return NextResponse.json(
      {
        error: message,
        code: err.code,
        status: err.status,
        details: err.body ?? null,
      },
      { status: 500 }
    );
  }
}

