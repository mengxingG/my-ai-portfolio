import { access } from "node:fs/promises";
import type { Browser } from "puppeteer-core";
import {
  buildPdfHeaderTemplate,
  buildReportPdfHtml,
  PDF_FOOTER_TEMPLATE,
} from "@/lib/hv-analysis/report-pdf-html";

const PDF_TIMEOUT_MS = 110_000;

function isServerlessRuntime(): boolean {
  return (
    process.env.VERCEL === "1" ||
    Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(process.env.AWS_EXECUTION_ENV)
  );
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveLocalChromePath(): Promise<string | null> {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    process.env.CHROME_PATH,
    process.platform === "darwin"
      ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
      : null,
    process.platform === "darwin"
      ? "/Applications/Chromium.app/Contents/MacOS/Chromium"
      : null,
    process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : null,
    "/usr/bin/google-chrome",
    "/usr/bin/chromium-browser",
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    if (await pathExists(candidate)) return candidate;
  }
  return null;
}

async function launchSparticuzBrowser(): Promise<Browser> {
  const chromium = (await import("@sparticuz/chromium")).default;
  const puppeteer = (await import("puppeteer-core")).default;

  chromium.setGraphicsMode = false;

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless as "shell" | boolean,
  });
}

async function launchLocalBrowser(): Promise<Browser> {
  const puppeteerCore = (await import("puppeteer-core")).default;
  const chromePath = await resolveLocalChromePath();

  if (chromePath) {
    return puppeteerCore.launch({
      executablePath: chromePath,
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });
  }

  const puppeteer = await import("puppeteer");
  return puppeteer.default.launch({ headless: true }) as Promise<Browser>;
}

async function launchPdfBrowser(): Promise<Browser> {
  if (isServerlessRuntime()) {
    return launchSparticuzBrowser();
  }

  try {
    return await launchLocalBrowser();
  } catch (localErr) {
    console.warn(
      "[hv-pdf] local browser launch failed:",
      localErr instanceof Error ? localErr.message : localErr,
    );
    throw new Error(
      "无法启动 Chrome 进行 PDF 排版。请安装 Google Chrome，或设置 PUPPETEER_EXECUTABLE_PATH / CHROME_PATH 环境变量。",
    );
  }
}

export type ConvertMarkdownToPdfOptions = {
  targetName: string;
  author?: string;
};

/** Markdown → PDF Buffer（Node.js / Puppeteer，兼容 Vercel Serverless） */
export async function convertMarkdownToPdfBuffer(
  md: string,
  options: ConvertMarkdownToPdfOptions,
): Promise<Buffer> {
  const targetName = options.targetName.trim() || "横纵分析报告";
  const author = options.author?.trim() || "数字生命卡兹克 · HV-Analysis";

  const html = buildReportPdfHtml(md, {
    title: targetName,
    author,
  });

  const browser = await launchPdfBrowser();

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: "networkidle0",
      timeout: PDF_TIMEOUT_MS,
    });

    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: {
        top: "22mm",
        right: "20mm",
        bottom: "18mm",
        left: "20mm",
      },
      displayHeaderFooter: true,
      headerTemplate: buildPdfHeaderTemplate(targetName),
      footerTemplate: PDF_FOOTER_TEMPLATE,
      timeout: PDF_TIMEOUT_MS,
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => {});
  }
}
