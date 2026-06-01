/** 将 Markdown 正文中未包裹的域名/URL 转为可点击链接（跳过已有链接与代码） */
export function linkifyResumeMarkdown(markdown: string): string {
  const placeholders: string[] = [];
  let safe = markdown.replace(/\[([^\]]+)\]\([^)]+\)/g, (m) => {
    placeholders.push(m);
    return `\x00LINK${placeholders.length - 1}\x00`;
  });

  safe = safe.replace(
    /(?<![(\["'])(?<url>(?:https?:\/\/)?(?:[\w-]+\.)+(?:com|it\.com|io|dev)(?:\/[^\s|,)）\]]*)?)/gi,
    (match, _g1, offset, full) => {
      const before = full[offset - 1];
      if (before === "(" || before === "[") return match;

      const href = match.startsWith("http") ? match : `https://${match}`;
      const label = match.replace(/^https?:\/\//, "");
      return `[${label}](${href})`;
    },
  );

  safe = safe.replace(
    /(?<![(\["'])(?<email>[\w.+-]+@[\w-]+\.\w+)/g,
    (match, _g1, offset, full) => {
      const before = full[offset - 1];
      if (before === "(" || before === "[") return match;
      return `[${match}](mailto:${match})`;
    },
  );

  return safe.replace(/\x00LINK(\d+)\x00/g, (_, i) => placeholders[Number(i)] ?? "");
}
