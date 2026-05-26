/**
 * HV-Analysis 流式 API — 分章流水线版
 *
 * 双路分发：DeepSeek 官方 / 其他模型中转站 (gptsapi.net)
 * 前置：searchPlannerModel + Tavily 并行检索
 * 生成：TransformStream + 三章顺序 streamText（突破单次 Token 上限）
 *
 * 流式协议（text/plain）：
 *   [HH:MM:SS] [INFO|WORKER|ERROR|DONE] ...
 *   正文 Markdown 直接流式输出
 */

export const runtime = "nodejs";
export const maxDuration = 300;

import {
  buildAdaptationRules,
  buildHorizontalTypeChecklist,
  buildSearchPlannerTypeHint,
  buildVerticalTypeChecklist,
  objectTypeDisplayLabel,
  type HvObjectType,
} from "@/lib/hv-analysis/object-type-adaptation";
import type { HvQaResult } from "@/lib/hv-analysis/qa-types";
import {
  buildReportFooter,
  buildReportHeader,
  finalizeReportMarkdown,
} from "@/lib/hv-analysis/report-markdown";
import { runHvReportQa } from "@/lib/hv-analysis/run-hv-qa";
import {
  safeJsonParse,
  sanitizeDeepStrings,
  sanitizeForLlmPayload,
} from "@/lib/hv-analysis/sanitize-payload-text";
import { HV_STYLE_GUIDELINES } from "@/lib/hv-analysis/style-guidelines";
import { createOpenAI } from "@ai-sdk/openai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { generateText, streamText } from "ai";
import type { LanguageModel } from "ai";
import fs from "fs";
import path from "path";

interface AnalysisRequest {
  targetName: string;
  additionalContext?: string;
  modelId?: string;
  competitor?: string;
  timeRange?: string;
  /** product | company | concept | person | auto（默认 auto） */
  objectType?: HvObjectType | string;
}

const STYLE_GUIDELINES = HV_STYLE_GUIDELINES;

/** 三章共用的 baseSystem：检索资料 + 文风 + 自适应 + 核心指令 */
function buildBaseSystem(
  targetName: string,
  searchContext: string,
  objectType?: string,
): string {
  const safeContext = sanitizeForLlmPayload(searchContext);
  return `你是一个极具洞察力的资深技术商业研究分析师。请基于以下最新全网检索资料：
${safeContext}

${STYLE_GUIDELINES}

${buildAdaptationRules(targetName, objectType)}

【核心指令】：开始深度研究【${targetName}】。`;
}

/** 生成时间戳 [HH:MM:SS] */
function ts(): string {
  const now = new Date();
  return now.toLocaleTimeString("zh-CN", { hour12: false });
}

function loadPromptTemplate(): string {
  const filePath = path.join(process.cwd(), "src", "prompts", "hv-analysis.md");
  return fs.readFileSync(filePath, "utf-8");
}

function injectTargetName(template: string, targetName: string): string {
  return template.replace(/研究对象\s*=\s*.+/, `研究对象 = ${targetName}`);
}

function buildSearchPlannerPrompt(
  targetName: string,
  additionalContext?: string,
  objectType?: string,
): string {
  const lines = [
    "你是横纵分析任务的搜索关键词规划器。请为研究对象生成 4-8 条用于 Tavily 联网检索的搜索词。",
    `研究对象：${targetName}`,
    buildSearchPlannerTypeHint(targetName, objectType),
  ];
  if (additionalContext?.trim()) {
    lines.push(`用户附加说明：${sanitizeForLlmPayload(additionalContext.trim())}`);
  }
  lines.push(
    "输出要求：仅输出一行，多条查询词用英文逗号(,)分隔，不要编号、不要解释、不要 Markdown。",
    "内容要求：兼顾纵向（起源、里程碑、最新进展）与横向（2-3 个竞品或同类、口碑/评测）。",
    `【学术类自适应】若对象为概念/技术范式，或名称明显属于学术主题（${targetName}），至少 1-2 条查询必须含 site:arxiv.org 或 paper pdf 后缀。`,
  );
  return lines.join("\n");
}

function parsePlannedQueries(text: string): string[] {
  const line = text
    .trim()
    .split("\n")
    .map((l) => l.replace(/^[\d.)\-\s]+/, "").trim())
    .find((l) => l.length > 0);
  if (!line) return [];
  return line
    .split(",")
    .map((q) => sanitizeForLlmPayload(q.trim().replace(/^["']|["']$/g, "")))
    .filter(Boolean);
}

type TavilySearchHit = { query: string; results: unknown[] };

async function runTavilySearches(queries: string[]): Promise<TavilySearchHit[]> {
  if (queries.length === 0) return [];
  const searchPromises = queries.map(async (query) => {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        include_answer: true,
        max_results: 3,
      }),
    });
    if (!res.ok) {
      throw new Error(`Tavily API 返回 ${res.status}: ${await res.text()}`);
    }
    const rawBody = await res.text();
    const data = sanitizeDeepStrings(
      safeJsonParse<{ results?: unknown[] }>(rawBody),
    );
    return { query: sanitizeForLlmPayload(query), results: data.results ?? [] };
  });
  return Promise.all(searchPromises);
}

function formatPrefetchedSearchContext(hits: TavilySearchHit[]): string {
  if (hits.length === 0) return "（暂无联网检索结果，请基于已有知识撰写，缺失处标注「暂缺」）";
  const blocks = hits.map((hit) => {
    const items = (hit.results as Array<{ title?: string; url?: string; content?: string }>)
      .slice(0, 3)
      .map((r, i) => {
        const snippet = sanitizeForLlmPayload(String(r.content ?? "")).slice(0, 400);
        const title = sanitizeForLlmPayload(String(r.title ?? "无标题"));
        const url = sanitizeForLlmPayload(String(r.url ?? ""));
        return `  ${i + 1}. ${title} (${url})\n     ${snippet}`;
      })
      .join("\n");
    return `### 查询：${sanitizeForLlmPayload(hit.query)}\n${items || "  （无结果）"}`;
  });
  return sanitizeForLlmPayload(blocks.join("\n\n"));
}

function createSearchPlannerModel(): LanguageModel | null {
  if (!process.env.DEEPSEEK_API_KEY) return null;
  const deepseek = createDeepSeek({
    apiKey: process.env.DEEPSEEK_API_KEY,
  });
  return deepseek("deepseek-chat");
}

function resolveGenerationModel(modelId: string): LanguageModel | { error: string } {
  if (modelId.startsWith("deepseek")) {
    if (!process.env.DEEPSEEK_API_KEY) {
      return { error: "模型调用失败: 未配置 DEEPSEEK_API_KEY" };
    }
    const deepseek = createDeepSeek({ apiKey: process.env.DEEPSEEK_API_KEY });
    return deepseek("deepseek-chat");
  }
  if (!process.env.OPENAI_API_KEY) {
    return { error: "模型调用失败: 环境变量 OPENAI_API_KEY 未配置" };
  }
  const relay = createOpenAI({
    baseURL: "https://api.gptsapi.net/v1",
    apiKey: process.env.OPENAI_API_KEY,
  });
  return relay.chat(modelId);
}

type ChapterPrompts = {
  system: string;
  promptCh0: string;
  promptCh1: string;
  promptCh2: string;
  promptCh3: string;
};

function buildChapterPrompts(params: {
  targetName: string;
  searchContext: string;
  frameworkExcerpt: string;
  additionalContext?: string;
  objectType?: string;
}): ChapterPrompts {
  const { targetName, searchContext, frameworkExcerpt, additionalContext, objectType } =
    params;

  const userAddon = additionalContext?.trim()
    ? `\n【用户特别附加指令（最高优先级）】\n${sanitizeForLlmPayload(additionalContext.trim())}`
    : "";

  const baseSystem = buildBaseSystem(targetName, searchContext, objectType);
  const verticalHint = buildVerticalTypeChecklist(objectType);
  const horizontalHint = buildHorizontalTypeChecklist(objectType);

  const system = `${baseSystem}

【方法论摘录】
${frameworkExcerpt.slice(0, 6000)}
${userAddon}

【章节输出约束】严格遵循《横纵分析法》方法论；只输出本章正文（Markdown），不要输出目录、元说明或「本章完」等废话。`;

  const promptCh0 = `请撰写【一、一句话定义】。

研究对象：${targetName}

篇幅：100–300 字。用一句话说清楚它是什么，再用 2–3 句补充边界与语境。

只输出本章 Markdown，必须以「## 一、一句话定义」为唯一 H2 标题，不要写封面 H1。`;

  const promptCh1 = `请撰写【二、纵向分析：从诞生到当下】全文。

研究对象：${targetName}

篇幅：6,000–15,000 字（本章尽量写满，历史节点须逐一展开，禁止跳过）。

必须覆盖：
1. 起源追溯：诞生背景、技术/理念/需求、创始团队、当时行业环境
2. 诞生节点：首次发布/成立时间与最初形态定位
3. 演进历程：按时间梳理版本、融资、团队、战略、架构、用户里程碑、合作/收购、危机等
4. 决策逻辑：关键节点为何选 A 而非 B，当时约束是什么
5. 阶段划分：用叙事故事体串起起承转合，禁止流水账年表

${verticalHint}

只输出本章 Markdown，必须以「## 二、纵向分析：从诞生到当下」为章节 H2 标题。`;

  const promptCh2 = `请撰写【三、横向分析：竞争图谱】全文。

研究对象：${targetName}

篇幅：3,000–10,000 字。

必须先判断竞品场景（在正文中明确写出属于 A/B/C 哪一种）：
- 场景 A：无直接竞品 → 分析为何无竞品、潜在竞争者方向、间接替代
- 场景 B：1–2 个竞品 → 逐一深度对比
- 场景 C：3 个及以上 → 选 3–5 个代表竞品，每个主要竞品至少 1,500 字独立剖析

必须覆盖：核心差异、用户真实口碑（引用社区/评价中的「声音」）、生态位、趋势与机会风险。
可用对比表辅助，但主体必须是文字论述。

${horizontalHint}

只输出本章 Markdown，必须以「## 三、横向分析：竞争图谱」为章节 H2 标题。`;

  const promptCh3 = `${baseSystem}

请撰写【第四步：横纵交汇洞察】。

研究对象：${targetName}

要求字数 1,500–3,000 字。这是报告精华，禁止复述前两章摘要，必须给出新的综合判断。

必须回答以下核心问题（逐条可见，可用小标题）：
1. 历史如何塑造了当下的竞争位置？
2. 主要竞品的纵向路径差异，如何导致今日各自特点？
3. 今日核心优势的历史根源（追溯到具体节点/决策）？
4. 今日核心劣势的历史根源（「昔日好决策」是否变成包袱）？
5. 未来推演：给出 3 个逻辑支撑的剧本——最可能 / 最危险 / 最乐观。

【特殊修辞要求】：在交汇洞察时，请进行适度的「文化升维」（自然地联系到更大的商业/哲学/历史参照物），并与第一部分（纵向分析）埋下的细节进行「回环呼应」，形成前后因果的闭合感！

只输出本章 Markdown，必须以「## 四、横纵交汇洞察」为章节 H2 标题。`;

  return { system, promptCh0, promptCh1, promptCh2, promptCh3 };
}

/** 将单章 streamText 输出写入管道 */
async function pipeChapterStream(
  model: LanguageModel,
  system: string,
  prompt: string,
  pushStream: (text: string) => Promise<void>,
): Promise<void> {
  const result = streamText({
    model,
    system,
    prompt,
    temperature: 0.7,
    maxOutputTokens: 16_384,
  });
  for await (const chunk of result.textStream) {
    await pushStream(chunk);
  }
}

export async function POST(req: Request) {
  try {
    const body: AnalysisRequest = await req.json();

    if (!body.targetName?.trim()) {
      return new Response(
        JSON.stringify({ error: "缺少必要参数: targetName" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const targetName = body.targetName.trim();

    if (!process.env.TAVILY_API_KEY) {
      return new Response(
        `[${ts()}] [ERROR] 环境变量 TAVILY_API_KEY 未配置，无法使用联网搜索能力\n`,
        {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-cache",
          },
        },
      );
    }

    const modelId = body.modelId || "deepseek-v4-flash";
    const resolved = resolveGenerationModel(modelId);
    if ("error" in resolved) {
      return new Response(`[${ts()}] [ERROR] ${resolved.error}\n`, {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-cache",
        },
      });
    }
    const modelToUse = resolved;

    // —— 前置：搜索规划 + Tavily 并行（保留原逻辑）——
    let searchContext = "（暂无联网检索结果，请基于已有知识撰写，缺失处标注「暂缺」）";
    const searchPlannerModel = createSearchPlannerModel();
    if (searchPlannerModel) {
      try {
        const { text: plannedRaw } = await generateText({
          model: searchPlannerModel,
          prompt: buildSearchPlannerPrompt(
            targetName,
            body.additionalContext,
            body.objectType,
          ),
          temperature: 0.3,
        });
        const plannedQueries = parsePlannedQueries(plannedRaw);
        if (plannedQueries.length > 0) {
          const prefetched = await runTavilySearches(plannedQueries);
          searchContext = formatPrefetchedSearchContext(prefetched);
        }
      } catch (planErr) {
        console.warn(
          "[hv-analysis] searchPlannerModel failed:",
          planErr instanceof Error ? planErr.message : planErr,
        );
      }
    }

    const frameworkTemplate = injectTargetName(loadPromptTemplate(), targetName);
    const { system, promptCh0, promptCh1, promptCh2, promptCh3 } =
      buildChapterPrompts({
        targetName,
        searchContext,
        frameworkExcerpt: frameworkTemplate,
        additionalContext: body.additionalContext,
        objectType: body.objectType,
      });

    const reportHeader = buildReportHeader({
      targetName,
      body: "",
      competitor: body.competitor,
      timeRange: body.timeRange,
      objectType: body.objectType,
    });
    const reportFooter = buildReportFooter(searchContext);

    // —— 原生 TransformStream 分章流水线（主线程立即返回）——
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    let fullMarkdown = "";
    const pushStream = async (text: string) => {
      fullMarkdown += text;
      await writer.write(encoder.encode(text));
    };

    const pushProtocol = async (
      level: "INFO" | "WORKER" | "ERROR",
      message: string,
    ) => {
      await pushStream(`[${ts()}] [${level}] ${message}\n`);
    };

    (async () => {
      let pipelineSucceeded = false;
      let qaResult: HvQaResult | null = null;
      try {
        await pushProtocol(
          "INFO",
          "深度研究引擎已启动，采用分章流水线（定义 → 纵向 → 横向 → 交汇 → 附录）",
        );
        await pushProtocol(
          "INFO",
          `研究对象: ${targetName} · 类型: ${objectTypeDisplayLabel(body.objectType)} · 模型: ${modelId}`,
        );
        await pushProtocol("INFO", "联网检索摘要已注入写作上下文");

        await pushStream(reportHeader);

        await pushProtocol("WORKER", "正在生成一句话定义...");
        await pipeChapterStream(modelToUse, system, promptCh0, pushStream);

        await pushStream("\n\n---\n\n");
        await pushProtocol("WORKER", "正在生成纵向分析（预计 6,000–15,000 字）...");
        await pipeChapterStream(modelToUse, system, promptCh1, pushStream);

        await pushStream("\n\n---\n\n");
        await pushProtocol("WORKER", "正在生成横向分析（预计 3,000–10,000 字）...");
        await pipeChapterStream(modelToUse, system, promptCh2, pushStream);

        await pushStream("\n\n---\n\n");
        await pushProtocol("WORKER", "正在生成横纵交汇洞察（预计 1,500–3,000 字）...");
        await pipeChapterStream(modelToUse, system, promptCh3, pushStream);

        await pushProtocol(
          "WORKER",
          "正在组装信息来源与方法论附录（PDF 排版友好）...",
        );
        await pushStream(reportFooter);
        await pushProtocol(
          "INFO",
          "完整 Markdown 稿件已就绪，可下载 .md 或使用「导出 PDF」调用 md_to_pdf 排版",
        );

        // 先 [DONE]：前端立刻进入 success，展示导出按钮；质检在流未关闭时继续
        await pushStream(`\n[${ts()}] [DONE] 全部分析流程完成\n`);
        pipelineSucceeded = true;

        await pushProtocol(
          "WORKER",
          "正在后台执行 14 条军规质检（报告正文已全部推送，请继续阅读）…",
        );

        const reportForQa = finalizeReportMarkdown({
          targetName,
          body: fullMarkdown,
          competitor: body.competitor,
          timeRange: body.timeRange,
          objectType: body.objectType,
        });

        const qaModelId =
          process.env.HV_QA_MODEL_ID?.trim() || "claude-sonnet-4-6";

        try {
          qaResult = await runHvReportQa({
            reportText: reportForQa,
            modelId: qaModelId,
          });
          await pushStream(
            `[${ts()}] [DATA] ${JSON.stringify({ type: "qa", content: qaResult })}\n`,
          );
          await pushProtocol(
            "INFO",
            `质检完成：综合得分 ${qaResult.overallScore}/100（${qaResult.meta?.passCount ?? qaResult.items.filter((i) => i.pass).length}/14 项通过）`,
          );
        } catch (qaErr) {
          qaResult = null;
          console.warn(
            "[hv-analysis] inline QA failed:",
            qaErr instanceof Error ? qaErr.message : qaErr,
          );
          await pushProtocol(
            "WARN",
            `后台质检解析失败（${qaErr instanceof Error ? qaErr.message : String(qaErr)}），可稍后点击「存入 Notion」手动归档`,
          );
        }
      } catch (err) {
        console.error("[hv-analysis] pipeline error:", err);
        const errMsg = err instanceof Error ? err.message : String(err);
        await pushProtocol("ERROR", `分析过程发生异常: ${errMsg}`);
      } finally {
        try {
          await writer.close();
        } catch {
          /* already closed */
        }
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("[hv-analysis] error:", err);
    return new Response(
      JSON.stringify({ error: "请求处理失败" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
