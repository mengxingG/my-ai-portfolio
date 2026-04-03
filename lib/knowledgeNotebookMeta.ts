/** 与「重新提炼」、ingest 共用：模型在全文末输出的 Notion 元数据围栏 */

export const NOTEBOOK_META_START = "---NOTION_META---";
export const NOTEBOOK_META_END = "---END_NOTION_META---";

function safeTrim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** 关键词：来自 meta 行 `keywords: a, b, c` 或数组 */
export function normalizeNotebookKeywords(input: unknown): string[] {
  if (Array.isArray(input)) {
    const out = input.map((x) => safeTrim(x)).filter(Boolean);
    return Array.from(new Set(out)).slice(0, 8);
  }
  const text = safeTrim(input);
  if (!text) return [];
  const parts = text
    .split(/\s+|[\n\r]+|,|，|;|；|\||、/g)
    .map((x) => x.trim())
    .filter(Boolean);
  const uniq: string[] = [];
  for (const p of parts) if (!uniq.includes(p)) uniq.push(p);
  return uniq.slice(0, 8);
}

export function splitNotebookMetaBlock(full: string): {
  body: string;
  meta: Record<string, string>;
} {
  const text = String(full || "").trim();
  const endIdx = text.lastIndexOf(NOTEBOOK_META_END);
  if (endIdx === -1) {
    return { body: text, meta: {} };
  }
  const startIdx = text.lastIndexOf(NOTEBOOK_META_START, endIdx);
  if (startIdx === -1) {
    return { body: text, meta: {} };
  }
  const body = text.slice(0, startIdx).trim();
  const metaBlock = text.slice(startIdx + NOTEBOOK_META_START.length, endIdx).trim();
  const meta: Record<string, string> = {};
  for (const line of metaBlock.split("\n")) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    if (k) meta[k] = v;
  }
  return { body, meta };
}
