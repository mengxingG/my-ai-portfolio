import { createOpenAI } from "@ai-sdk/openai";
import { generateObject, generateText, type LanguageModel } from "ai";
import { z } from "zod";
import type { HvQaItem, HvQaResult } from "@/lib/hv-analysis/qa-types";

/** 允许的质检模型（中转站） */
export const HV_QA_MODEL_IDS = ["claude-sonnet-4-6", "gpt-5.4"] as const;
export type HvQaModelId = (typeof HV_QA_MODEL_IDS)[number];
const DEFAULT_QA_MODEL: HvQaModelId = "claude-sonnet-4-6";

/** 14 条军规：固定 id / 标题 / 检查要点 */
const QA_CRITERIA = [
  { id: "narrative", title: "纵轴叙事故事体", check: "纵轴是否为叙事故事体，而非流水账？" },
  { id: "founder", title: "创始人动机深度", check: "创始人动机是否有深度？" },
  { id: "details", title: "关键节点展开", check: "关键节点是否展开（无跳过）？" },
  { id: "logic", title: "决策逻辑还原", check: "决策逻辑是否还原（为什么选 A）？" },
  { id: "horizontal", title: "竞品场景与横轴深度", check: "竞品场景判断（A/B/C）与分析深度？" },
  { id: "voices", title: "真实用户声音", check: "是否引用了真实用户声音？" },
  { id: "insight", title: "交汇洞察", check: "交汇洞察是否产出了新判断？" },
  { id: "scenarios", title: "未来推演剧本", check: "未来推演是否有三个逻辑支撑的剧本？" },
  { id: "style", title: "写作节奏感", check: "写作是否有节奏感（非冷冰冰报告）？" },
  { id: "forbidden", title: "套话禁区", check: "是否避开了套话禁区（如「综上所述」）？" },
  { id: "citations", title: "关键事实来源", check: "关键事实是否有信息来源？" },
  { id: "honesty", title: "信息缺口诚实标注", check: "搜不到的信息是否诚实标注了「暂缺」？" },
  { id: "structure", title: "排版结构清晰", check: "排版结构是否清晰？" },
  { id: "word_count", title: "万字量级", check: "总字数是否达到万字量级（10,000+）？" },
] as const;

const QA_ITEM_IDS = QA_CRITERIA.map((c) => c.id);
const qaItemIdSchema = z.enum(QA_ITEM_IDS as [string, ...string[]]);

const qaResultSchema = z.object({
  overallScore: z.number().min(0).max(100),
  items: z
    .array(
      z.object({
        id: qaItemIdSchema,
        title: z.string(),
        pass: z.boolean(),
        reason: z.string(),
      }),
    )
    .min(14)
    .max(14),
});

function buildQaSystemPrompt(): string {
  const rulesBlock = QA_CRITERIA.map(
    (c, i) => `${i + 1}. [${c.id}] ${c.title}：${c.check}`,
  ).join("\n");

  return `你是横纵分析法（HV-Analysis）报告的最高质检官。你必须严格依据以下「14 条军规」对整份报告逐项裁决，不得放水。

## 14 条军规（逐项检查）
${rulesBlock}

## 裁决原则
- 每条军规独立判断 pass（true/false），reason 用中文简要说明依据（可引用报告中的章节或缺失点）。
- word_count：以报告正文字符量估算，明显不足 10,000 字必须判 false。
- forbidden：出现「综上所述」「总而言之」等空洞套话且缺乏实质内容时判 false。
- honesty：对明显缺失的数据/来源，报告须标注「暂缺」或同等诚实表述，否则判 false。
- overallScore：0-100 整数，与 14 项通过率及严重程度一致（全通过建议 90+，多项不通过应显著降分）。

## 输出要求
- 必须输出且仅输出 schema 规定的 JSON 对象。
- items 数组必须恰好 14 条，id 与上述军规 id 完全一致，顺序与军规列表一致，title 使用军规标题。

【致命要求】：你必须且只能输出合法的 JSON 对象！绝对不允许在前后加上 \`\`\`json 标签！绝对不允许输出任何其他说明性文字！直接以 { 开头，以 } 结尾！`;
}

/** 从模型原始文本中剥离 Markdown 围栏并提取 JSON 对象字符串 */
export function extractJsonObjectFromModelText(text: string): string | null {
  const trimmed = String(text ?? "").trim();
  if (!trimmed) return null;

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = (fenced?.[1] ?? trimmed).trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return candidate.slice(start, end + 1);
}

function parseQaJsonText(jsonText: string): z.infer<typeof qaResultSchema> {
  const parsed = JSON.parse(jsonText) as unknown;
  return qaResultSchema.parse(parsed);
}

function normalizeQaResult(raw: z.infer<typeof qaResultSchema>): HvQaResult {
  const byId = new Map(raw.items.map((item) => [item.id, item]));

  const items: HvQaItem[] = QA_CRITERIA.map((criterion) => {
    const hit = byId.get(criterion.id);
    return {
      id: criterion.id,
      title: hit?.title?.trim() || criterion.title,
      pass: hit?.pass === true,
      reason: hit?.reason?.trim() || "模型未返回该项说明",
    };
  });

  const passCount = items.filter((i) => i.pass).length;
  const scoreFromPasses = Math.round((passCount / 14) * 100);
  const modelScore = Number.isFinite(raw.overallScore)
    ? Math.max(0, Math.min(100, Math.round(raw.overallScore)))
    : scoreFromPasses;
  const overallScore = Math.round(modelScore * 0.6 + scoreFromPasses * 0.4);

  return { overallScore, items };
}

function resolveRelayModel(modelId?: string) {
  const chosen = (modelId?.trim() || DEFAULT_QA_MODEL) as string;
  if (!HV_QA_MODEL_IDS.includes(chosen as HvQaModelId)) {
    return {
      error: `不支持的 modelId: ${chosen}，可选: ${HV_QA_MODEL_IDS.join(", ")}`,
    } as const;
  }
  if (!process.env.OPENAI_API_KEY) {
    return { error: "服务端未配置 OPENAI_API_KEY（中转站）" } as const;
  }
  const relay = createOpenAI({
    baseURL: "https://api.gptsapi.net/v1",
    apiKey: process.env.OPENAI_API_KEY,
  });
  return { model: relay.chat(chosen), modelId: chosen as HvQaModelId } as const;
}

export type RunHvQaOptions = {
  reportText: string;
  modelId?: string;
};

async function runQaWithTextFallback(args: {
  model: LanguageModel;
  modelId: HvQaModelId;
  reportChars: number;
  reportForModel: string;
}): Promise<HvQaResult> {
  const system = buildQaSystemPrompt();
  const prompt = `请对以下完整横纵分析报告执行 14 条军规质检（报告约 ${args.reportChars} 字）：\n\n---\n${args.reportForModel}\n---`;

  try {
    const { object } = await generateObject({
      model: args.model,
      schema: qaResultSchema,
      schemaName: "HvQaResult",
      schemaDescription: "横纵分析报告14条军规质检结果",
      system,
      prompt,
      temperature: 0.2,
    });
    const result = normalizeQaResult(object);
    return {
      ...result,
      meta: {
        modelId: args.modelId,
        reportChars: args.reportChars,
        passCount: result.items.filter((i) => i.pass).length,
      },
    };
  } catch (objectErr) {
    console.warn(
      "[runHvReportQa] generateObject failed, trying generateText + JSON extract:",
      objectErr instanceof Error ? objectErr.message : objectErr,
    );

    const { text } = await generateText({
      model: args.model,
      system,
      prompt: `${prompt}\n\n再次强调：只输出一个 JSON 对象，以 { 开头、以 } 结尾，禁止 markdown 代码块与任何解释文字。`,
      temperature: 0.1,
    });

    const jsonStr = extractJsonObjectFromModelText(text);
    if (!jsonStr) {
      throw objectErr instanceof Error ? objectErr : new Error(String(objectErr));
    }

    try {
      const parsed = parseQaJsonText(jsonStr);
      const result = normalizeQaResult(parsed);
      return {
        ...result,
        meta: {
          modelId: args.modelId,
          reportChars: args.reportChars,
          passCount: result.items.filter((i) => i.pass).length,
          parseFallback: "generateText",
        },
      };
    } catch (parseErr) {
      console.warn("[runHvReportQa] JSON parse failed:", parseErr);
      throw objectErr instanceof Error ? objectErr : new Error(String(objectErr));
    }
  }
}

/**
 * 对完整 HV 报告执行 14 条军规质检（与 POST /api/hv-qa 同源逻辑）。
 */
export async function runHvReportQa(options: RunHvQaOptions): Promise<HvQaResult> {
  const reportText = options.reportText?.trim();
  if (!reportText) {
    throw new Error("reportText 不能为空");
  }

  const resolved = resolveRelayModel(options.modelId);
  if ("error" in resolved) {
    throw new Error(resolved.error);
  }

  const { model, modelId } = resolved;
  const reportChars = reportText.length;
  const reportForModel =
    reportChars > 120_000
      ? `${reportText.slice(0, 120_000)}\n\n[…报告已截断，原文共 ${reportChars} 字，请基于已给部分质检]`
      : reportText;

  return runQaWithTextFallback({
    model,
    modelId,
    reportChars,
    reportForModel,
  });
}
