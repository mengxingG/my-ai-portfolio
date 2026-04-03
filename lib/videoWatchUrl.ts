/** 判定是否为常见「视频页」链接，用于推荐位置顶与 Notion 相关视频字段 */
export function isVideoWatchUrl(url: string): boolean {
  const u = String(url ?? "").trim();
  if (!/^https?:\/\//i.test(u)) return false;
  try {
    const h = new URL(u).hostname.replace(/^www\./i, "").toLowerCase();
    if (h === "youtu.be" || h.includes("youtube.com")) return true;
    if (h.includes("bilibili.com") || h === "b23.tv") return true;
    if (h.includes("xiaohongshu.com") || h.includes("xhslink.com")) return true;
    return false;
  } catch {
    return false;
  }
}
