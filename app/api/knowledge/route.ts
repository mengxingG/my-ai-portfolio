import { NextResponse } from "next/server";
import { fetchKnowledgeFromNotion } from "@/lib/notion";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await fetchKnowledgeFromNotion();
    // Debug: ensure API is really returning Notion-derived items.
    // eslint-disable-next-line no-console
    console.log("[/api/knowledge] items:", {
      count: items.length,
      sample: items.slice(0, 3),
    });
    return NextResponse.json({ items });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("[/api/knowledge] fetch failed:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}

