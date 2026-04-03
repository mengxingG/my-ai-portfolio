/**
 * 将 Markdown 转为 Notion 块。
 * 须正确处理 ``` 围栏（尤其是 mermaid），若按行拆成 paragraph 会导致读回时换行丢失、出现 mindmaproot 等解析错误。
 */
export function mdToNotionBlocks(markdown: string): Array<Record<string, unknown>> {
  const lines = (markdown || "")
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\t/g, "  "));

  const blocks: Array<Record<string, unknown>> = [];
  const chunk = 1900;

  const pushRichBlock = (type: string, text: string) => {
    const content = text.trim();
    if (!content) return;
    const richTexts: Array<Record<string, unknown>> = [];
    for (let i = 0; i < content.length; i += chunk) {
      richTexts.push({ type: "text", text: { content: content.slice(i, i + chunk) } });
    }
    blocks.push({
      object: "block",
      type,
      [type]: { rich_text: richTexts },
    } as Record<string, unknown>);
  };

  const pushCodeBlock = (_langHint: string, bodyLines: string[]) => {
    const content = bodyLines.join("\n");
    if (!content.trim()) return;
    const richTexts: Array<Record<string, unknown>> = [];
    for (let i = 0; i < content.length; i += chunk) {
      richTexts.push({ type: "text", text: { content: content.slice(i, i + chunk) } });
    }
    blocks.push({
      object: "block",
      type: "code",
      code: {
        rich_text: richTexts,
        // Notion 枚举未必含 Mermaid；写入 plain text，读回时按内容还原为 ```mermaid
        language: "plain text",
      },
    } as Record<string, unknown>);
  };

  const openFenceRe = /^(\s*)```([a-zA-Z0-9_+-]*)\s*$/;
  const closeFenceRe = /^(\s*)```\s*$/;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";
    const openM = openFenceRe.exec(line);
    if (openM) {
      const langHint = openM[2] ?? "";
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !closeFenceRe.test(lines[i] ?? "")) {
        body.push(lines[i] ?? "");
        i += 1;
      }
      if (i < lines.length) i += 1;
      pushCodeBlock(langHint, body);
      continue;
    }

    const s = line.trim();
    if (!s) {
      i += 1;
      continue;
    }
    if (s.startsWith("### ")) {
      pushRichBlock("heading_3", s.slice(4));
      i += 1;
      continue;
    }
    if (s.startsWith("## ")) {
      pushRichBlock("heading_2", s.slice(3));
      i += 1;
      continue;
    }
    if (s.startsWith("# ")) {
      pushRichBlock("heading_1", s.slice(2));
      i += 1;
      continue;
    }
    if (s.startsWith("- ") || s.startsWith("* ")) {
      pushRichBlock("bulleted_list_item", s.slice(2));
      i += 1;
      continue;
    }
    if (/^\d+\.\s+/.test(s)) {
      pushRichBlock("numbered_list_item", s.replace(/^\d+\.\s+/, ""));
      i += 1;
      continue;
    }
    pushRichBlock("paragraph", s);
    i += 1;
  }

  return blocks;
}
