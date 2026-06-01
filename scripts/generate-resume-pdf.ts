/**
 * Generate public/resume/resume.pdf from lib/resume-data.ts
 * Run: npm run generate-resume-pdf
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer";
import { RESUME_DATA } from "../lib/resume-data";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outDir = path.join(root, "public", "resume");
const htmlPath = path.join(root, "resume", "resume-print.html");
const outPath = path.join(outDir, "resume.pdf");

function esc(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function bullets(items: string[]) {
  return `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>`;
}

function buildHtml() {
  const { name, title, contact, summary, skills, work, projects, education } = RESUME_DATA;

  const skillBlock = (label: string, items: string[]) =>
    `<p><strong>${esc(label)}：</strong>${esc(items.join(" | "))}</p>`;

  const workHtml = work
    .map(
      (job) => `
    <section class="block">
      <div class="row">
        <h3>${esc(job.company)}</h3>
        <span class="muted">${esc(job.period)}</span>
      </div>
      <p class="role">${esc(job.role)}</p>
      ${job.context ? `<p class="context">${esc(job.context)}</p>` : ""}
      ${bullets(job.highlights)}
    </section>`,
    )
    .join("");

  const projectsHtml = projects
    .map(
      (p) => `
    <section class="block project">
      <div class="row">
        <h3>${esc(p.title)}</h3>
        ${p.link ? `<span class="link">${esc(p.link)}</span>` : ""}
      </div>
      <p class="summary">${esc(p.summary)}</p>
      ${bullets(p.bullets)}
      <p class="tech"><em>技术栈：</em>${esc(p.tech)}</p>
    </section>`,
    )
    .join("");

  const eduHtml = education
    .map((e) => `<li><strong>${esc(e.degree)}</strong> | ${esc(e.school)} | ${esc(e.year)}</li>`)
    .join("");

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <title>${esc(name)} - ${esc(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
      font-size: 10.5pt;
      line-height: 1.55;
      color: #1a1a1a;
    }
    h1 { margin: 0 0 4px; font-size: 20pt; }
    h2 {
      margin: 18px 0 8px;
      font-size: 11pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #5b21b6;
      border-bottom: 1px solid #e5e7eb;
      padding-bottom: 4px;
    }
    h3 { margin: 0; font-size: 11pt; }
    .header .subtitle { margin: 0; color: #4b5563; font-size: 12pt; }
    .contact { margin: 8px 0 0; font-size: 9.5pt; color: #6b7280; }
    .contact span { margin-right: 14px; }
    .block { margin-top: 12px; }
    .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .muted, .link { font-size: 9.5pt; color: #6b7280; white-space: nowrap; }
    .role { margin: 4px 0 0; font-weight: 600; }
    .context { margin: 6px 0 0; font-style: italic; color: #6b7280; font-size: 9.5pt; }
    .summary { margin: 6px 0 0; color: #374151; }
    .tech { margin: 6px 0 0; font-size: 9pt; color: #6b7280; }
    p { margin: 6px 0; }
    ul { margin: 6px 0 0; padding-left: 18px; }
    li { margin-bottom: 4px; }
    .project { padding-top: 10px; border-top: 1px solid #f3f4f6; }
    .project:first-of-type { border-top: 0; padding-top: 0; }
  </style>
</head>
<body>
  <header class="header">
    <h1>${esc(name)}</h1>
    <p class="subtitle">${esc(title)}</p>
    <p class="contact">
      <span>邮箱: ${esc(contact.email)}</span>
      <span>作品集: ${esc(contact.portfolio)}</span>
      <span>GitHub: ${esc(contact.github)}</span>
    </p>
  </header>

  <h2>个人简介</h2>
  <p>${esc(summary)}</p>

  <h2>核心能力</h2>
  ${skillBlock("产品能力", skills.product)}
  ${skillBlock("AI 能力", skills.ai)}
  ${skillBlock("技术能力", skills.engineering)}

  <h2>工作经历</h2>
  ${workHtml}

  <h2>独立 AI 产品</h2>
  ${projectsHtml}

  <h2>教育背景</h2>
  <ul>${eduHtml}</ul>
</body>
</html>`;
}

async function main() {
  const html = buildHtml();
  await mkdir(outDir, { recursive: true });
  await writeFile(htmlPath, html, "utf8");

  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`file://${htmlPath}`, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", right: "14mm", bottom: "14mm", left: "14mm" },
    });
    console.log(`Wrote ${htmlPath}`);
    console.log(`Wrote ${outPath}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
