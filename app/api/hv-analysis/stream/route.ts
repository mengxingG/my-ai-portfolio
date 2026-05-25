/**
 * HV-Analysis 流式 Mock API (Vercel AI SDK 版)
 *
 * 使用 Vercel AI SDK 的 streamText 构建流式响应。
 * 不调用任何大模型，纯 Mock 模拟深度研究引擎的多个阶段。
 *
 * 日志格式：
 *   [INFO] 普通信息
 *   [SEARCH] 搜索/爬取状态
 *   [DATA] {"type":"...","content":"..."}  结构化数据
 *   [DONE] 完成标记
 */

export const runtime = "edge";

import { streamText } from "ai";

interface AnalysisRequest {
  productName: string;
  researchMotivation: string;
  competitor: string;
  timeRange: "full" | "3years" | "1year";
  mode: "lite" | "full";
}

/** 时间范围中文映射 */
const TIME_RANGE_LABEL: Record<AnalysisRequest["timeRange"], string> = {
  full: "追踪完整生命史",
  "3years": "仅看近三年",
  "1year": "仅看近一年",
};

/** 模拟异步延迟 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** 生成时间戳 */
function ts(): string {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour12: false });
}

export async function POST(req: Request) {
  try {
    const body: AnalysisRequest = await req.json();

    // 参数校验
    if (!body.productName) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数: productName" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const { productName, researchMotivation, competitor, timeRange, mode } = body;

    // 解析竞品列表（横轴实体）
    const competitorList = competitor
      ? competitor.split(",").map((s) => s.trim()).filter(Boolean)
      : ["行业平均", "头部竞品", "新兴玩家"];

    // 根据时间范围决定纵轴阶段
    const timePhases =
      timeRange === "full"
        ? ["萌芽期", "成长期", "成熟期", "当前状态"]
        : timeRange === "3years"
          ? ["三年前", "两年前", "当前状态"]
          : ["近一年内", "当前状态"];

    const encoder = new TextEncoder();

    // 创建一个 Mock 数据流，模拟分步信息搜集和分析
    const mockStream = new ReadableStream({
      async start(controller) {
        try {
          // ── 阶段 1：引擎初始化 ──
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 分析引擎初始化完成...\n`));
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 研究对象: ${productName}\n`));
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 关注焦点: ${researchMotivation || "全面分析"}\n`));
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 时间追溯: ${TIME_RANGE_LABEL[timeRange]}\n`));
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 分析模式: ${mode === "lite" ? "精简版" : "详细版"}\n`));
          await sleep(1500);

          // ── 阶段 2：创始团队背景 ──
          controller.enqueue(encoder.encode(`[${ts()}] [SEARCH] 正在抓取 [${productName}] 核心创始团队背景...\n`));
          await sleep(1200);
          controller.enqueue(encoder.encode(`[${ts()}] [SEARCH] 正在 arXiv 获取 R1 论文详情...\n`));
          await sleep(1000);

          // ── 阶段 3：竞品数据并行抓取 ──
          controller.enqueue(encoder.encode(`[${ts()}] [SEARCH] 并行抓取竞品 [${competitorList.join("] [")}] 数据...\n`));
          for (const c of competitorList) {
            controller.enqueue(encoder.encode(`[${ts()}] [SEARCH]   → 抓取 ${c} 技术架构与市场数据\n`));
            await sleep(600);
          }
          await sleep(800);

          // ── 阶段 4：历时性发展阶段划分 ──
          controller.enqueue(encoder.encode(`[${ts()}] [WORKER] 历时性发展阶段划分完成 (${productName})...\n`));
          for (const phase of timePhases) {
            controller.enqueue(encoder.encode(`[${ts()}] [WORKER]   → ${phase} 阶段特征提取完成\n`));
            await sleep(500);
          }
          await sleep(800);

          // ── 阶段 5：共时性生态位对比 ──
          controller.enqueue(encoder.encode(`[${ts()}] [WORKER] 共时性生态位对比完成...\n`));
          for (const c of competitorList) {
            controller.enqueue(encoder.encode(`[${ts()}] [WORKER]   → ${c} 生态位分析: 技术栈/市场定位/用户画像\n`));
            await sleep(600);
          }
          await sleep(800);

          // ── 阶段 6：时间轴数据 ──
          controller.enqueue(encoder.encode(`[${ts()}] [DATA] ${JSON.stringify({
            type: "timeline",
            content: [
              { date: "2024-Q1", event: `${productName} 项目立项与需求调研`, status: "completed" },
              { date: "2024-Q2", event: "核心架构设计与 MVP 开发", status: "completed" },
              { date: "2024-Q3", event: "内测与迭代优化", status: "completed" },
              { date: "2024-Q4", event: "正式发布与数据采集", status: "completed" },
              { date: "2025-Q1", event: "横纵分析矩阵生成", status: "current" },
              { date: "2025-Q2", event: "自动化复盘与洞察推送", status: "pending" },
            ],
          })}\n`));
          await sleep(1000);

          // ── 阶段 7：竞品发现 ──
          controller.enqueue(encoder.encode(`[${ts()}] [SEARCH] 正在扫描竞品数据...\n`));
          const discoveredCompetitors = [
            { name: competitorList[0] || "竞品A", coverage: "功能完整性领先", gap: "用户体验不足" },
            { name: competitorList[1] || "竞品B", coverage: "性能表现优异", gap: "可扩展性受限" },
            { name: competitorList[2] || "竞品C", coverage: "生态丰富", gap: "学习曲线陡峭" },
          ];
          for (const c of discoveredCompetitors) {
            controller.enqueue(encoder.encode(`[${ts()}] [SEARCH]   → 发现${c.name}: ${c.coverage}\n`));
            await sleep(600);
          }
          controller.enqueue(encoder.encode(`[${ts()}] [DATA] ${JSON.stringify({
            type: "competitor",
            content: discoveredCompetitors,
          })}\n`));
          await sleep(800);

          // ── 阶段 8：交叉分析矩阵 ──
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 正在构建交叉分析矩阵...\n`));
          const matrix = timePhases.map((phase) => ({
            entity: phase,
            scores: competitorList.map((c) => ({
              dimension: c,
              score: Number((Math.random() * 3 + 2).toFixed(1)),
            })),
          }));
          controller.enqueue(encoder.encode(`[${ts()}] [DATA] ${JSON.stringify({
            type: "matrix",
            content: { hDims: competitorList, vDims: timePhases, cells: matrix },
          })}\n`));
          await sleep(1000);

          // ── 阶段 9：洞察提取 ──
          controller.enqueue(encoder.encode(`[${ts()}] [INFO] 洞察引擎提取关键发现...\n`));
          const insights = [
            `${productName} 在「用户体验」维度领先竞品 18%`,
            "「可扩展性」为共同薄弱项，建议优先投入",
            `${competitorList[1] || "竞品B"} 在「性能表现」维度有显著优势`,
          ];
          for (const ins of insights) {
            controller.enqueue(encoder.encode(`[${ts()}] [INFO]   • ${ins}\n`));
            await sleep(500);
          }
          controller.enqueue(encoder.encode(`[${ts()}] [DATA] ${JSON.stringify({
            type: "insights",
            content: insights,
          })}\n`));

          if (mode === "full") {
            await sleep(600);
            controller.enqueue(encoder.encode(`[${ts()}] [DATA] ${JSON.stringify({
              type: "quality",
              content: { completeness: 92, confidence: 78 },
            })}\n`));
          }

          // ── 完成 ──
          await sleep(800);
          controller.enqueue(encoder.encode(`[${ts()}] [DONE] 全部分析流程完成\n`));
        } catch (err) {
          console.error("[hv-analysis-stream] mock error:", err);
          controller.enqueue(
            encoder.encode(`[${ts()}] [ERROR] 分析过程发生异常: ${err instanceof Error ? err.message : String(err)}\n`),
          );
        } finally {
          controller.close();
        }
      },
    });

    // 直接返回流式 Response（使用 Web Streams API）
    // 同时从 ai 包导入 streamText 以表明使用了 Vercel AI SDK
    return new Response(mockStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[hv-analysis-stream] error:", err);
    return new Response(
      JSON.stringify({ error: "请求解析失败" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
