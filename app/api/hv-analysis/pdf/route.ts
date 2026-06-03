/**
 * HV-Analysis — Markdown → PDF（Node.js / Puppeteer + @sparticuz/chromium）
 * 兼容 Vercel Serverless，无需 Python / WeasyPrint
 */

export const runtime = "nodejs";
export const maxDuration = 120;

import { convertMarkdownToPdfBuffer } from "@/lib/hv-analysis/convert-markdown-to-pdf";
import {
  finalizeReportMarkdown,
  sanitizeReportFilename,
} from "@/lib/hv-analysis/report-markdown";
import { NextResponse } from "next/server";

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
    const safe = sanitizeReportFilename(targetName);
    const filename = `${safe}_横纵分析报告.pdf`;

    const buffer = await convertMarkdownToPdfBuffer(md, {
      targetName,
      author,
    });

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
    return NextResponse.json(
      { error: `PDF 生成失败: ${message}` },
      { status: 500 },
    );
  }
}
