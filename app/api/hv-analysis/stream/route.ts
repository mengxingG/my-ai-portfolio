/**
 * HV-Analysis 流式 API
 *
 * 1. 用 fetch 获取远程 Markdown（横纵分析法 Skill）作为 System Prompt
 * 2. 对接 Gemini 大模型（@ai-sdk/google + streamText）
 * 3. 按 [INFO] -> [WORKER] -> [DATA] -> [DONE] 协议流式推送
 *
 * 流式协议格式：
 *   [HH:MM:SS] [INFO] 普通信息
 *   [HH:MM:SS] [WORKER] 工作节点状态
 *   [HH:MM:SS] [DATA] {"type":"...","content":...}  结构化数据
 *   [HH:MM:SS] [DONE] 完成标记
 */

export const runtime = "nodejs";
export const maxDuration = 60;

import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { streamText } from "ai";

/** 远程 Skill Markdown 地址 */
const SKILL_URL =
  "https://raw.githubusercontent.com/KKKKhazix/khazix-skills/main/prompts/%E6%A8%AA%E7%BA%B5%E5%88%86%E6%9E%90%E6%B3%95.md";

interface AnalysisRequest {
  productName: string;
  researchMotivation: string;
  competitor: string;
  timeRange: "full" | "3years" | "1year";
  mode: "lite" | "full";
}

/** 生成时间戳 [HH:MM:SS] */
function ts(): string {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour12: false });
}

/** 获取远程 Skill Markdown 内容 */
async function fetchSkillPrompt(): Promise<string> {
  const res = await fetch(SKILL_URL, {
    headers: { "User-Agent": "my-ai-portfolio/1.0" },
  });
  if (!res.ok) {
    throw new Error(`获取 Skill 文件失败: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

/** 构建用户 Prompt */
function buildUserPrompt(req: AnalysisRequest): string {
  const { productName, researchMotivation, competitor, timeRange, mode } = req;

  const timeRangeLabel: Record<string, string> = {
    full: "追踪完整生命史",
    "3years": "仅看近三年",
    "1year": "仅看近一年",
  };

  const competitorList = competitor
    ? competitor.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  return `请对「${productName}」进行横纵交叉分析。

## 研究配置
- 分析对象：${productName}
- 时间追溯范围：${timeRangeLabel[timeRange] || timeRange}
- 分析模式：${mode === "lite" ? "精简版（仅输出核心洞察）" : "详细版（完整分析报告）"}
${researchMotivation ? `- 研究动机：${researchMotivation}` : ""}
${competitorList.length > 0 ? `- 指定对标竞品：${competitorList.join("、")}` : "- 对标竞品：由 AI 自动检索"}

## 输出要求

请严格按照以下流式协议格式输出，每行一条消息：

1. **[INFO]** 用于输出分析过程中的普通信息、状态说明、进度提示等
2. **[WORKER]** 用于输出各工作节点的执行状态（如竞品标定、时间线追溯、矩阵构建等）
3. **[DATA]** 用于输出结构化数据，格式为 JSON 对象，包含 type 和 content 字段：
   - \`[DATA] {"type":"timeline","content":[...]}\` — 时间线数据
   - \`[DATA] {"type":"competitor","content":[...]}\` — 竞品数据
   - \`[DATA] {"type":"matrix","content":{...}}\` — 交叉分析矩阵
   - \`[DATA] {"type":"insights","content":[...]}\` — 关键洞察
   - ${mode === "full" ? '- `[DATA] {"type":"quality","content":{...}}` — 数据质量评估' : ""}
4. **[DONE]** 最后输出一行标记分析完成

请确保分析过程覆盖横轴（空间对比/竞品对标）和纵轴（时间演进/发展脉络）两个维度，并在交叉点输出有价值的洞察。`;
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

    // 1. 获取远程 Skill 作为 System Prompt
    const systemPrompt = await fetchSkillPrompt();

    // 2. 构建用户 Prompt
    const userPrompt = buildUserPrompt(body);

    // 3. 初始化 Gemini Provider
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "服务端未配置 GEMINI_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      );
    }

    const googleProvider = createGoogleGenerativeAI({
      apiKey,
      baseURL: process.env.GOOGLE_GEMINI_BASE_URL?.trim() || undefined,
    });

    // 4. 调用 streamText
    const result = streamText({
      model: googleProvider("gemini-3-flash-preview"),
      system: systemPrompt,
      prompt: userPrompt,
      temperature: 0.7,
    });

    // 5. 将 AI 流转换为 [INFO]/[WORKER]/[DATA]/[DONE] 协议格式
    const encoder = new TextEncoder();

    const transformedStream = new ReadableStream({
      async start(controller) {
        try {
          // 发送启动信息
          controller.enqueue(
            encoder.encode(`[${ts()}] [INFO] 深度研究引擎已启动，正在加载横纵分析法框架...\n`)
          );
          controller.enqueue(
            encoder.encode(`[${ts()}] [INFO] 研究对象: ${body.productName}\n`)
          );
          if (body.researchMotivation) {
            controller.enqueue(
              encoder.encode(`[${ts()}] [INFO] 研究动机: ${body.researchMotivation}\n`)
            );
          }
          controller.enqueue(
            encoder.encode(`[${ts()}] [INFO] 分析框架加载完成，AI 分析引擎开始工作...\n`)
          );

          // 消费 AI 流
          let fullText = "";
          for await (const chunk of result.textStream) {
            fullText += chunk;

            // 按行处理，提取协议行
            const lines = fullText.split("\n");
            // 保留最后可能不完整的行
            fullText = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              // 检查是否已经是协议格式（[INFO], [WORKER], [DATA], [DONE]）
              if (/^\[(INFO|WORKER|DATA|DONE|SEARCH|ERROR|WARN)\]/.test(trimmed)) {
                controller.enqueue(encoder.encode(`[${ts()}] ${trimmed}\n`));
              } else {
                // 普通文本行，包装为 [INFO]
                controller.enqueue(encoder.encode(`[${ts()}] [INFO] ${trimmed}\n`));
              }
            }
          }

          // 处理剩余的文本
          if (fullText.trim()) {
            const trimmed = fullText.trim();
            if (/^\[(INFO|WORKER|DATA|DONE|SEARCH|ERROR|WARN)\]/.test(trimmed)) {
              controller.enqueue(encoder.encode(`[${ts()}] ${trimmed}\n`));
            } else {
              controller.enqueue(encoder.encode(`[${ts()}] [INFO] ${trimmed}\n`));
            }
          }

          // 发送完成标记
          controller.enqueue(
            encoder.encode(`[${ts()}] [DONE] 全部分析流程完成\n`)
          );
        } catch (err) {
          console.error("[hv-analysis-stream] stream error:", err);
          controller.enqueue(
            encoder.encode(
              `[${ts()}] [ERROR] 分析过程发生异常: ${err instanceof Error ? err.message : String(err)}\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(transformedStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[hv-analysis-stream] error:", err);
    return new Response(
      JSON.stringify({ error: "请求处理失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
