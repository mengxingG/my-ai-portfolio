import { generateText } from "ai";

function normalizeMarkdownNewlines(md: string): string {
  return String(md || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .trim();
}

const MERMAID_FENCE_RE = /```mermaid\s*[\s\S]*?```/im;

/** 校验前去掉文末 mermaid，避免图中符号误伤；不删正文其它围栏（当前大纲约定仅一处 mermaid） */
export function stripMermaidForTraceValidation(md: string): string {
  return normalizeMarkdownNewlines(md).replace(MERMAID_FENCE_RE, "").trimEnd();
}

const RED_LINE_SECTION_RE = /核心逻辑与红线/;
const ARCHIVE_HEADER_RE = /^\s*🔍\s*本章溯源档案/;
/** 要点句末角标 [n]（可出现句末句号/句号） */
const FOOTNOTE_END_RE = /\[(\d+)\]\s*[。.]?\s*$/;

function chapterRanges(lines: string[]): { start: number; end: number }[] {
  const ranges: { start: number; end: number }[] = [];
  let chapStart = -1;
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i] ?? "";
    if (/^\s*##\s/.test(L) && !/^\s*###/.test(L)) {
      if (chapStart >= 0) ranges.push({ start: chapStart, end: i - 1 });
      chapStart = i;
    }
  }
  if (chapStart >= 0) ranges.push({ start: chapStart, end: lines.length - 1 });
  return ranges;
}

/**
 * 「核心逻辑与红线」学术尾注：要点 `- …[n]` 列表；全章要点后统一 `🔍 本章溯源档案：` + 引用块 `> [n] "…"`。
 */
export function validateRedLineSourceTraces(markdown: string): {
  ok: boolean;
  violations: { lineNo: number; line: string }[];
} {
  const body = stripMermaidForTraceValidation(markdown);
  const lines = body.split("\n");
  const violations: { lineNo: number; line: string }[] = [];

  const clip = (s: string) => (s.length > 220 ? `${s.slice(0, 220)}…` : s);

  for (const { start, end } of chapterRanges(lines)) {
    let rhIdx = -1;
    for (let i = start; i <= end; i++) {
      if (RED_LINE_SECTION_RE.test(lines[i] ?? "")) {
        rhIdx = i;
        break;
      }
    }
    if (rhIdx < 0) continue;

    for (let k = rhIdx + 1; k <= end; k++) {
      const L = lines[k] ?? "";
      if (/^\s*-\s/.test(L)) break;
      if (/^\s*$/.test(L)) continue;
      if (/^\s*>/.test(L)) {
        violations.push({
          lineNo: k + 1,
          line: `${clip(L)} （红线要点开始前不得出现引用块；应使用章末「本章溯源档案」）`,
        });
      }
      break;
    }

    let i = rhIdx + 1;
    while (i <= end && /^\s*$/.test(lines[i] ?? "")) i++;

    const bullets: { lineNo: number; line: string }[] = [];
    while (i <= end && /^\s*-\s/.test(lines[i] ?? "")) {
      bullets.push({ lineNo: i + 1, line: lines[i] ?? "" });
      i++;
    }
    while (i <= end && /^\s*$/.test(lines[i] ?? "")) i++;

    if (bullets.length === 0) continue;

    const afterBullets = lines[i] ?? "";
    if (!ARCHIVE_HEADER_RE.test(afterBullets)) {
      if (/^\s*>/.test(afterBullets)) {
        violations.push({
          lineNo: i + 1,
          line: `${clip(afterBullets)} （禁止在要点下直接跟 > 引用；请先空行再写「🔍 本章溯源档案：」）`,
        });
      } else {
        violations.push({
          lineNo: bullets[bullets.length - 1]!.lineNo,
          line: `${clip(bullets[bullets.length - 1]!.line)} （该章要点后缺少「🔍 本章溯源档案：」）`,
        });
      }
      continue;
    }

    i++;
    while (i <= end && /^\s*$/.test(lines[i] ?? "")) i++;

    const archiveNums: number[] = [];
    while (i <= end && /^\s*>/.test(lines[i] ?? "")) {
      const L = lines[i] ?? "";
      const lineNo = i + 1;
      if (/🔍\s*原文溯源/.test(L)) {
        violations.push({
          lineNo: i + 1,
          line: `${clip(L)} （已改用尾注视图：请放入「本章溯源档案」统一块，格式 > [n] "…"）`,
        });
      } else if (!/^\s*>\s*\[\d+\]\s*"/.test(L)) {
        violations.push({
          lineNo,
          line: `${clip(L)} （溯流行须为 > [n] "资料逐字摘录..."）`,
        });
      } else {
        const m = L.match(/^\s*>\s*\[(\d+)\]/);
        if (m) archiveNums.push(Number(m[1]));
      }
      i++;
    }

    const bulletNums: number[] = [];
    for (const b of bullets) {
      const L = b.line;
      if (L.includes("_(来源溯源") || /来源溯源[：:]/.test(L)) {
        violations.push({
          lineNo: b.lineNo,
          line: `${clip(L)} （要点行禁止夹带行内溯源）`,
        });
        continue;
      }
      const fm = L.match(FOOTNOTE_END_RE);
      if (!fm) {
        violations.push({
          lineNo: b.lineNo,
          line: `${clip(L)} （要点句末须有角标 [n]）`,
        });
        continue;
      }
      bulletNums.push(Number(fm[1]));
    }

    for (let e = 1; e <= bulletNums.length; e++) {
      if (bulletNums[e - 1] !== e) {
        violations.push({
          lineNo: bullets[e - 1]!.lineNo,
          line: `${clip(bullets[e - 1]!.line)} （章内角标须从 [1] 连续递增）`,
        });
      }
    }

    const exp = bulletNums.length;
    if (archiveNums.length !== exp) {
      violations.push({
        lineNo: bullets[0]!.lineNo,
        line: `本章溯源档案条目数（${archiveNums.length}）与要点数（${exp}）不一致`,
      });
    } else {
      for (let e = 0; e < exp; e++) {
        if (archiveNums[e] !== e + 1) {
          violations.push({
            lineNo: bullets[0]!.lineNo,
            line: `溯源档案角标须为 [1]…[${exp}] 且顺序与要点一致`,
          });
          break;
        }
      }
    }
  }

  return { ok: violations.length === 0, violations };
}

export const OUTLINE_TRACE_REPAIR_SYSTEM =
  "你是金融合规文档编辑助手，只输出修复后的完整 Markdown，禁止 JSON、禁止寒暄与说明。" +
  "任务：在保持原有章节结构（## 标题）、💡 TL;DR、文末唯一 mermaid 的前提下，" +
  "将每章「核心逻辑与红线」改为学术尾注：**每条**单独一行 `- …要点… [n]`（句末角标，章内 [1] 起连续），**禁止**在要点下直接写 `> ` 摘录；" +
  "全部要点结束后空一行，写一行 `🔍 本章溯源档案：`，再空一行，用**一个**引用块多行 `> [n] \"资料正文逐字摘录\"` 与角标一一对应。禁止 `> 🔍 原文溯源` 旧体例。";

export function buildOutlineTraceRepairUserPrompt(
  brokenOutline: string,
  violations: { lineNo: number; line: string }[],
  sourceExcerpt: string
): string {
  const violText = violations
    .slice(0, 60)
    .map((v) => `- 第 ${v.lineNo} 行：${v.line}`)
    .join("\n");
  return [
    "以下提纲未满足「要点尾标 [n] + 章末 🔍 本章溯源档案 引用块」的排版。请输出**唯一一份**修正后的**全文**（不要只输出片段）。",
    "",
    "【校验摘报】",
    violText || "(未解析到行号)",
    "",
    "【当前提纲（请在此基础上修复）】",
    brokenOutline.trim(),
    "",
    "【资料正文节选（仅允许从中摘引号内文字）】",
    sourceExcerpt.trim(),
  ].join("\n");
}

export type RepairOutlineResult = {
  markdown: string;
  ok: boolean;
  repairPasses: number;
};

/**
 * 在首次生成后自动补齐/修正溯源格式；最多发起 `maxRepairPasses` 次修正调用。
 */
export async function repairOutlineMarkdownSourceTraces(
  model: Parameters<typeof generateText>[0]["model"],
  markdown: string,
  sourceText: string,
  maxRepairPasses = 2
): Promise<RepairOutlineResult> {
  const max = Math.max(0, Math.min(maxRepairPasses, 4));
  let current = normalizeMarkdownNewlines(markdown);
  let repairPasses = 0;

  for (;;) {
    const { ok, violations } = validateRedLineSourceTraces(current);
    if (ok) return { markdown: current, ok: true, repairPasses };
    if (repairPasses >= max) {
      return { markdown: current, ok: false, repairPasses };
    }
    const result = await generateText({
      model,
      system: OUTLINE_TRACE_REPAIR_SYSTEM,
      prompt: buildOutlineTraceRepairUserPrompt(current, violations, sourceText.slice(0, 120_000)),
      temperature: 0.1,
      maxOutputTokens: 16_384,
    });
    const next = normalizeMarkdownNewlines(result.text || "");
    if (!next) return { markdown: current, ok: false, repairPasses };
    repairPasses += 1;
    current = next;
  }
}
