/**
 * HV-Analysis 流式 Mock API
 *
 * 模拟深度研究引擎的多个阶段，每隔 1-2 秒向前端推送一条状态日志。
 * 使用 Web Streams API 实现流式响应，防止 Vercel 10s 超时。
 *
 * 日志格式：
 *   [INFO] 普通信息
 *   [SEARCH] 搜索/爬取状态
 *   [DATA] {"type":"...","content":"..."}  结构化数据
 *   [DONE] 完成标记
 */

export const runtime = "edge";

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

/** 模拟的完整阶段序列 */
async function* generateStages(req: AnalysisRequest): AsyncGenerator<string> {
  const { productName, researchMotivation, competitor, timeRange, mode } = req;

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

  // ── 阶段 1：引擎初始化 ──
  yield `[${ts()}] [INFO] 正在启动深度研究引擎...\n`;
  yield `[${ts()}] [INFO] 研究对象: ${productName}\n`;
  yield `[${ts()}] [INFO] 时间追溯: ${TIME_RANGE_LABEL[timeRange]}\n`;
  yield `[${ts()}] [INFO] 分析模式: ${mode === "lite" ? "精简版" : "详细版"}\n`;
  if (researchMotivation) {
    yield `[${ts()}] [INFO] 研究动机: ${researchMotivation}\n`;
  }
  await sleep(1200);

  // ── 阶段 2：横轴竞品标定（空间对比） ──
  yield `[${ts()}] [SEARCH] 正在标定横向对比对象...\n`;
  for (const c of competitorList) {
    yield `[${ts()}] [SEARCH]   → 加载竞品「${c}」数据\n`;
    await sleep(400);
  }
  yield `[${ts()}] [INFO] 横向对比对象标定完成: ${competitorList.length} 个\n`;
  await sleep(800);

  // ── 阶段 3：纵轴时间线数据拉取（时间演进） ──
  yield `[${ts()}] [SEARCH] 正在沿时间线追溯「${productName}」的发展脉络...\n`;
  for (const phase of timePhases) {
    yield `[${ts()}] [SEARCH]   → 回溯阶段「${phase}」\n`;
    await sleep(500);
  }
  yield `[${ts()}] [INFO] 时间线数据拉取完成: ${timePhases.length} 个阶段\n`;
  await sleep(800);

  // ── 阶段 4：时间轴数据 ──
  yield `[${ts()}] [DATA] ${JSON.stringify({
    type: "timeline",
    content: [
      { date: "2024-Q1", event: "项目立项与需求调研", status: "completed" },
      { date: "2024-Q2", event: "核心架构设计与 MVP 开发", status: "completed" },
      { date: "2024-Q3", event: "内测与迭代优化", status: "completed" },
      { date: "2024-Q4", event: "正式发布与数据采集", status: "completed" },
      { date: "2025-Q1", event: "横纵分析矩阵生成", status: "current" },
      { date: "2025-Q2", event: "自动化复盘与洞察推送", status: "pending" },
    ],
  })}\n`;
  await sleep(1000);

  // ── 阶段 5：竞品发现 ──
  yield `[${ts()}] [SEARCH] 正在扫描竞品数据...\n`;
  const discoveredCompetitors = [
    { name: "竞品A", coverage: "功能完整性领先", gap: "用户体验不足" },
    { name: "竞品B", coverage: "性能表现优异", gap: "可扩展性受限" },
    { name: "竞品C", coverage: "生态丰富", gap: "学习曲线陡峭" },
  ];
  for (const c of discoveredCompetitors) {
    yield `[${ts()}] [SEARCH]   → 发现${c.name}: ${c.coverage}\n`;
    await sleep(600);
  }
  yield `[${ts()}] [DATA] ${JSON.stringify({
    type: "competitor",
    content: discoveredCompetitors,
  })}\n`;
  await sleep(800);

  // ── 阶段 6：交叉分析矩阵 ──
  yield `[${ts()}] [INFO] 正在构建交叉分析矩阵...\n`;
  const matrix = timePhases.map((phase) => ({
    entity: phase,
    scores: competitorList.map((c) => ({
      dimension: c,
      score: Number((Math.random() * 3 + 2).toFixed(1)),
    })),
  }));
  yield `[${ts()}] [DATA] ${JSON.stringify({
    type: "matrix",
    content: { hDims: competitorList, vDims: timePhases, cells: matrix },
  })}\n`;
  await sleep(1000);

  // ── 阶段 7：洞察提取（详细版额外数据） ──
  yield `[${ts()}] [INFO] 洞察引擎提取关键发现...\n`;
  const insights = [
    "本产品在「用户体验」维度领先竞品 18%",
    "「可扩展性」为共同薄弱项，建议优先投入",
    "竞品B 在「性能表现」维度有显著优势",
  ];
  for (const ins of insights) {
    yield `[${ts()}] [INFO]   • ${ins}\n`;
    await sleep(500);
  }
  yield `[${ts()}] [DATA] ${JSON.stringify({
    type: "insights",
    content: insights,
  })}\n`;

  if (mode === "full") {
    await sleep(600);
    yield `[${ts()}] [DATA] ${JSON.stringify({
      type: "quality",
      content: { completeness: 92, confidence: 78 },
    })}\n`;
  }

  // ── 完成 ──
  await sleep(800);
  yield `[${ts()}] [DONE] 全部分析流程完成\n`;
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

    // 创建 ReadableStream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of generateStages(body)) {
            controller.enqueue(new TextEncoder().encode(chunk));
          }
        } catch (err) {
          console.error("[hv-analysis] stream error:", err);
          controller.enqueue(
            new TextEncoder().encode(
              `[${ts()}] [ERROR] 分析过程发生异常: ${err instanceof Error ? err.message : String(err)}\n`,
            ),
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[hv-analysis] parse error:", err);
    return new Response(
      JSON.stringify({ error: "请求解析失败" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }
}
