import { revalidatePath, revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 按需失效文章详情缓存（发布后立刻更新，同时日常仍走 Data Cache 极快）
 *
 * 配置 .env.local: REVALIDATE_SECRET=随机长字符串
 *
 * 单篇刷新:
 *   curl -X POST "$ORIGIN/api/revalidate" \
 *     -H "Content-Type: application/json" \
 *     -H "x-revalidate-secret: $SECRET" \
 *     -d '{"articleId":"NOTION_PAGE_UUID"}'
 *
 * 刷新全部文章详情缓存（不确定 pageId 时用）:
 *   curl -X POST "$ORIGIN/api/revalidate" \
 *     -H "Content-Type: application/json" \
 *     -H "x-revalidate-secret: $SECRET" \
 *     -d '{"allArticles":true}'
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-revalidate-secret") ??
    request.nextUrl.searchParams.get("secret");
  const expected = process.env.REVALIDATE_SECRET;

  if (!expected || secret !== expected) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    articleId?: string;
    allArticles?: boolean;
  };

  if (body.allArticles) {
    revalidateTag("articles", "max");
    revalidatePath("/");
    return NextResponse.json({ ok: true, scope: "articles-tag-and-home" });
  }

  if (body.articleId && typeof body.articleId === "string") {
    const articleId = body.articleId.trim();
    revalidateTag(`article-${articleId}`, "max");
    revalidatePath(`/articles/${articleId}`);
    return NextResponse.json({ ok: true, articleId });
  }

  return NextResponse.json(
    { ok: false, error: "Provide articleId or allArticles: true" },
    { status: 400 }
  );
}
