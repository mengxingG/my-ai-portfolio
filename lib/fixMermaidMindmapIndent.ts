/**
 * 模型常把 mindmap 子节点顶格写，Mermaid 会当成多个 root，报 “There can be only one root”.
 * 另：模型常把 flowchart 箭头 (->)、状态色 (YELLOW)、独立 `::icon Rule` 行混入 mindmap，触发 SPACELIST 等解析错误。
 * 流程：以 flowchart / graph 开头的围栏原样保留（否则会误删 `-->`）；mindmap 围栏先剔除非法行，再收紧缩进。
 */

/** 仅处理围栏内源码（无 ```），供前端对已保存正文中的 mermaid 片段做轻量修复 */
export function fixMermaidMindmapInnerSource(src: string): string {
  return fixMindmapFenceBody(String(src ?? ""));
}

export function fixMermaidMindmapIndentInMarkdown(markdown: string): string {
  return String(markdown || "").replace(/```mermaid\s*([\s\S]*?)```/gi, (_, inner: string) => {
    const body = String(inner ?? "");
    const fixed = fixMindmapFenceBody(body);
    return "```mermaid\n" + fixed + "\n```";
  });
}

/** mindmap 内禁止 flowchart 边、伪状态色、不完整的 ::icon；独立一行且非 ::icon(...) 的 ::icon 删之 */
function stripInvalidMindmapLines(body: string): string {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    if (shouldDropMindmapContentLine(t)) continue;
    out.push(line);
  }
  return out.join("\n");
}

function shouldDropMindmapContentLine(t: string): boolean {
  if (/-->|(?:^|\s)-{1,2}>(?:\s|$)/.test(t)) return true;
  if (/\)\s*-{1,2}>/.test(t)) return true;
  if (/^(YELLOW|RED|GREEN|ORANGE|BLUE|GRAY|GREY|BLACK|WHITE)\b/i.test(t)) return true;
  if (/\b(YELLOW|RED|GREEN|ORANGE|BLUE)\b\s*::(icon|ico)\b/i.test(t)) return true;
  if (/^::(icon|ico)\b/i.test(t)) {
    if (/^::icon\s*\(/i.test(t)) return false;
    return true;
  }
  if (/::ico(?!\w)/i.test(t) && !/::icon\s*\(/i.test(t)) return true;
  return false;
}

function fixMindmapFenceBody(body: string): string {
  const raw = String(body ?? "");
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  const firstNonEmpty = lines.findIndex((l) => l.trim() !== "");
  if (firstNonEmpty < 0) return raw.trimEnd();
  const head = lines[firstNonEmpty]?.trim().toLowerCase() ?? "";
  // flowchart / graph：不走 mindmap 清洗（strip 会误删 -->）
  if (head.startsWith("flowchart") || head.startsWith("graph")) {
    return raw.trimEnd();
  }

  const bodyStripped = stripInvalidMindmapLines(raw);
  const strippedLines = bodyStripped.replace(/\r\n/g, "\n").split("\n");
  const ne = strippedLines.findIndex((l) => l.trim() !== "");
  if (ne < 0) return raw.trimEnd();
  if (!strippedLines[ne]?.trim().toLowerCase().startsWith("mindmap")) return raw.trimEnd();

  const mindmapIdx = ne;
  const out: string[] = [];
  for (let j = 0; j < mindmapIdx; j++) out.push(strippedLines[j] ?? "");

  out.push("mindmap");

  let k = mindmapIdx + 1;
  while (k < strippedLines.length && !strippedLines[k]?.trim()) {
    out.push(strippedLines[k] ?? "");
    k++;
  }

  if (k < strippedLines.length) {
    const t = (strippedLines[k] ?? "").trim();
    if (t) out.push("  " + t);
    else out.push(strippedLines[k] ?? "");
    k++;
  }

  for (; k < strippedLines.length; k++) {
    const line = strippedLines[k] ?? "";
    const t = line.trim();
    if (!t) {
      out.push(line);
      continue;
    }
    const lead = /^(\s*)/.exec(line)?.[1]?.length ?? 0;
    if (lead < 4) out.push("    " + t);
    else out.push(line);
  }

  return out.join("\n").trimEnd();
}
