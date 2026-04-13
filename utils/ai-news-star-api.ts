/** 浏览器端调用：更新 Notion `Starred` */
export async function patchAINewsStarred(pageId: string, isStarred: boolean): Promise<void> {
  const res = await fetch("/api/ai-news/star", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pageId, isStarred }),
  });
  if (!res.ok) {
    throw new Error(`Star update failed: ${res.status}`);
  }
}
