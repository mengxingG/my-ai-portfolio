import { NextResponse } from "next/server";
import { getArticleDetail } from "@/utils/notion";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await getArticleDetail(id);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Failed to load article detail" }, { status: 500 });
  }
}

