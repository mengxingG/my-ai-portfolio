import { NextResponse } from "next/server";
import { createNotionClient } from "@/lib/notion-client";

export const dynamic = "force-dynamic";

function pageTitlePlain(page: unknown): string {
  const p = page as {
    title?: Array<{ plain_text?: string }>;
  };
  const t = p?.title?.map((x) => x?.plain_text).filter(Boolean).join("") ?? "";
  return t.trim();
}

/**
 * Debug helper to list databases that the current NOTION_API_KEY can "see".
 *
 * Protected by `?secret=` (reusing REVALIDATE_SECRET) so it won't leak in public deployments.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const secret = url.searchParams.get("secret") ?? "";
  const expected = process.env.REVALIDATE_SECRET ?? "";
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notionToken = process.env.NOTION_API_KEY;
  if (!notionToken) {
    return NextResponse.json({ error: "Missing NOTION_API_KEY" }, { status: 500 });
  }

  const notion = createNotionClient(notionToken);

  try {
    // Notion search filter currently only supports page/data_source in SDK validation.
    // So we search broadly and filter databases client-side.
    const result = await notion.search({
      // Empty query still returns recently edited objects.
      query: "",
      page_size: 100,
    });

    const databases = (result.results ?? [])
      .filter((r) => (r as { object?: string })?.object === "database")
      .map((db) => {
        const d = db as {
          id?: string;
          title?: Array<{ plain_text?: string }>;
        };
        return {
          id: String(d.id ?? ""),
          title: pageTitlePlain(d),
        };
      });

    // eslint-disable-next-line no-console
    console.log("[/api/notion/databases] visible databases:", databases);

    return NextResponse.json({ databases });
  } catch (error) {
    const e = error as { status?: number; code?: string; message?: string };
    // eslint-disable-next-line no-console
    console.error("[/api/notion/databases] search failed:", {
      status: e?.status,
      code: e?.code,
      message: e?.message,
      error,
    });
    return NextResponse.json(
      { error: e?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}

