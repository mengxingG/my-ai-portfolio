import { marked } from "marked";

const REPORT_CSS = `
@page {
  size: A4;
  margin: 25mm 20mm 20mm 20mm;
}

body {
  font-family: "Noto Sans SC", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  font-size: 10.5pt;
  line-height: 1.75;
  color: #2c3e50;
  text-align: justify;
}

.cover {
  page-break-after: always;
  text-align: center;
  padding-top: 45%;
  min-height: 240mm;
  box-sizing: border-box;
}
.cover h1 {
  font-size: 28pt;
  color: #1a5276;
  margin-bottom: 8mm;
  font-weight: bold;
  letter-spacing: 2pt;
  page-break-before: avoid;
  border: none;
}
.cover .subtitle {
  font-size: 14pt;
  color: #95a5a6;
  margin-bottom: 6mm;
}
.cover .meta {
  font-size: 11pt;
  color: #95a5a6;
  margin-bottom: 4mm;
}
.cover .divider {
  width: 60%;
  margin: 8mm auto;
  border: none;
  border-top: 1.5pt solid #1a5276;
}

h1 {
  font-size: 20pt;
  color: #1a5276;
  margin-top: 16mm;
  margin-bottom: 6mm;
  padding-bottom: 3mm;
  border-bottom: 2pt solid #1a5276;
  page-break-before: always;
  font-weight: bold;
}

h2 {
  font-size: 14pt;
  color: #1e8449;
  margin-top: 10mm;
  margin-bottom: 5mm;
  font-weight: bold;
}

h3 {
  font-size: 12pt;
  color: #2e86c1;
  margin-top: 6mm;
  margin-bottom: 3mm;
  font-weight: bold;
}

h4 {
  font-size: 11pt;
  color: #5b2c6f;
  margin-top: 5mm;
  margin-bottom: 2mm;
  font-weight: bold;
}

p {
  margin-top: 1.5mm;
  margin-bottom: 1.5mm;
  orphans: 3;
  widows: 3;
}

blockquote {
  margin: 4mm 0;
  padding: 4mm 4mm 4mm 10mm;
  background: #f8f9fa;
  border-left: 3pt solid #1a5276;
  color: #5d6d7e;
  font-size: 10pt;
}
blockquote p {
  margin: 1mm 0;
}

strong, b {
  font-weight: bold;
  color: #1a252f;
}

code {
  font-family: "Courier New", Courier, monospace;
  background: #fdf2e9;
  color: #c0392b;
  padding: 0.5mm 1.5mm;
  border-radius: 2pt;
  font-size: 9.5pt;
}

pre {
  background: #f8f9fa;
  padding: 3mm;
  border-radius: 3pt;
  overflow-x: auto;
  font-size: 9pt;
}
pre code {
  background: transparent;
  color: inherit;
  padding: 0;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin: 4mm 0;
  font-size: 9.5pt;
}
thead th {
  background: #1a5276;
  color: white;
  padding: 3mm;
  text-align: left;
  font-weight: bold;
}
tbody td {
  padding: 2.5mm 3mm;
  border-bottom: 0.5pt solid #bdc3c7;
}
tbody tr:nth-child(even) {
  background: #f8f9fa;
}

hr {
  border: none;
  border-top: 0.5pt solid #bdc3c7;
  margin: 4mm 0;
}

ul, ol {
  margin: 2mm 0;
  padding-left: 8mm;
}
li {
  margin-bottom: 1mm;
}

a {
  color: #2e86c1;
  text-decoration: none;
}
`;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractMetaLine(mdText: string): string {
  for (const line of mdText.split("\n")) {
    const stripped = line.trim().replace(/^>\s*/, "");
    if (
      stripped.includes("研究时间") ||
      stripped.includes("所属领域") ||
      stripped.includes("研究对象类型")
    ) {
      return stripped;
    }
  }
  return "";
}

function stripFirstH1(htmlBody: string, fallbackTitle: string): {
  title: string;
  body: string;
} {
  const match = htmlBody.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!match) {
    return { title: fallbackTitle, body: htmlBody };
  }
  const extracted = match[1].replace(/<[^>]+>/g, "").trim();
  const title =
    extracted && fallbackTitle === "横纵分析报告" ? extracted : fallbackTitle;
  return {
    title,
    body: htmlBody.replace(match[0], ""),
  };
}

export type BuildReportPdfHtmlOptions = {
  title?: string;
  subtitle?: string;
  author?: string;
};

/** 将 HV 报告 Markdown 转为带封面与排版的完整 HTML（供 Puppeteer 打印 PDF） */
export function buildReportPdfHtml(
  mdText: string,
  options: BuildReportPdfHtmlOptions = {},
): string {
  const subtitle = options.subtitle ?? "横纵分析法深度研究报告";
  const author = options.author ?? "数字生命卡兹克 · HV-Analysis";
  const metaLine = extractMetaLine(mdText);

  marked.setOptions({ gfm: true, breaks: true });
  const rawHtml = marked.parse(mdText) as string;
  const { title, body: htmlBody } = stripFirstH1(
    rawHtml,
    options.title?.trim() || "横纵分析报告",
  );

  const coverHtml = `
    <div class="cover">
      <h1>${escapeHtml(title)}</h1>
      <div class="subtitle">${escapeHtml(subtitle)}</div>
      ${metaLine ? `<div class="meta">${escapeHtml(metaLine)}</div>` : ""}
      <hr class="divider">
      <div class="meta">作者: ${escapeHtml(author)}</div>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;700&display=swap" rel="stylesheet">
  <style>${REPORT_CSS}</style>
</head>
<body>
${coverHtml}
${htmlBody}
</body>
</html>`;
}

/** Puppeteer PDF 页眉 / 页脚模板 */
export function buildPdfHeaderTemplate(title: string): string {
  const label = `${escapeHtml(title)}  |  横纵分析法深度研究报告`;
  return `<div style="font-size:8px;width:100%;text-align:center;color:#95a5a6;font-family:'Noto Sans SC',sans-serif;border-bottom:0.5px solid #ecf0f1;padding:0 20px 4px;margin:0 auto;">${label}</div>`;
}

export const PDF_FOOTER_TEMPLATE = `<div style="font-size:8px;width:100%;text-align:center;color:#95a5a6;font-family:'Noto Sans SC',sans-serif;border-top:0.8px solid #1a5276;padding:4px 20px 0;margin:0 auto;">第 <span class="pageNumber"></span> 页</div>`;
