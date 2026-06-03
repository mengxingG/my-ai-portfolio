import { existsSync } from "node:fs";
import { access as accessAsync } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
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

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const requireFromModule = createRequire(import.meta.url);

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await accessAsync(filePath);
    return true;
  } catch {
    return false;
  }
}

/** 解析 @sparticuz/chromium/bin（Vercel 需配合 next.config outputFileTracingIncludes） */
function resolveSparticuzBinDirectory(): string | null {
  const candidates = [
    path.join(process.cwd(), "node_modules", "@sparticuz", "chromium", "bin"),
    (() => {
      try {
        const pkgJson = requireFromModule.resolve("@sparticuz/chromium/package.json");
        return path.join(path.dirname(pkgJson), "bin");
      } catch {
        return null;
      }
    })(),
    path.join(moduleDir, "..", "..", "node_modules", "@sparticuz", "chromium", "bin"),
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    if (existsSync(dir)) return dir;
  }
  return null;
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

  const binDir = resolveSparticuzBinDirectory();
  if (!binDir) {
    throw new Error(
      "未找到 @sparticuz/chromium/bin。若在 Vercel 部署，请确认 next.config 已配置 outputFileTracingIncludes 并重新部署。",
    );
  }

  const executablePath = await chromium.executablePath(binDir);

  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath,
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
