/**
 * HV-Analysis — Markdown → PDF（WeasyPrint）
 * 调用 app/api/hv-analysis/md_to_pdf.py
 */

export const runtime = "nodejs";
export const maxDuration = 120;

import {
  finalizeReportMarkdown,
  sanitizeReportFilename,
} from "@/lib/hv-analysis/report-markdown";
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { NextResponse } from "next/server";

const execFileAsync = promisify(execFile);

const PDF_SCRIPT = path.join(process.cwd(), "app/api/hv-analysis/md_to_pdf.py");

type PdfRequestBody = {
  /** 完整 Markdown 或仅正文（将与 header/footer 组装） */
  markdown?: string;
  reportText?: string;
  targetName: string;
  author?: string;
  /** 为 true 时仅用 markdown，不自动加封面/文末 */
  raw?: boolean;
  searchContext?: string;
  competitor?: string;
  timeRange?: string;
  objectType?: string;
};

async function convertMarkdownToPdf(
  md: string,
  targetName: string,
  author: string,
): Promise<{ buffer: Buffer; filename: string }> {
  const safe = sanitizeReportFilename(targetName);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "hv-report-"));
  const base = `${safe}_横纵分析报告`;
  const mdPath = path.join(tmpDir, `${base}.md`);
  const pdfPath = path.join(tmpDir, `${base}.pdf`);

  try {
    await fs.writeFile(mdPath, md, "utf-8");

    await execFileAsync(
      "python3",
      [PDF_SCRIPT, mdPath, pdfPath, "--title", targetName, "--author", author],
      {
        timeout: 110_000,
        maxBuffer: 10 * 1024 * 1024,
        env: { ...process.env, PYTHONUTF8: "1" },
      },
    );

    const buffer = await fs.readFile(pdfPath);

    return { buffer, filename: `${base}.pdf` };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as PdfRequestBody;
    const targetName = body.targetName?.trim();

    if (!targetName) {
      return NextResponse.json(
        { error: "缺少必要参数: targetName" },
        { status: 400 },
      );
    }

    const rawMd = (body.markdown ?? body.reportText ?? "").trim();
    if (!rawMd) {
      return NextResponse.json(
        { error: "缺少必要参数: markdown 或 reportText" },
        { status: 400 },
      );
    }

    const md = body.raw
      ? rawMd
      : finalizeReportMarkdown({
          targetName,
          body: rawMd,
          searchContext: body.searchContext,
          competitor: body.competitor,
          timeRange: body.timeRange,
          objectType: body.objectType,
        });

    const author = body.author?.trim() || "数字生命卡兹克 · HV-Analysis";

    const { buffer, filename } = await convertMarkdownToPdf(md, targetName, author);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[hv-analysis/pdf] error:", err);
    const message = err instanceof Error ? err.message : String(err);
    const hint =
      message.includes("ENOENT") && message.includes("python3")
        ? "未找到 python3，请在服务器安装 Python 3。"
        : message.includes("weasyprint") || message.includes("No module named")
          ? "请安装依赖: pip install weasyprint markdown --break-system-packages"
          : message;
    return NextResponse.json({ error: `PDF 生成失败: ${hint}` }, { status: 500 });
  }
}
