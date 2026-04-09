import { streamText, convertToModelMessages, generateText, type UIMessage } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  getGeminiApiKey,
  getGoogleGenerativeAiSdkBaseUrl,
  logChatGeminiKeyFingerprintOnce,
} from "@/lib/gemini-server-config";

/** 仅本地 dev（next dev）或显式 GOOGLE_AI_USE_PROXY=1 时对 Gemini 走代理；线上默认直连 */
const useGoogleAiProxy =
  process.env.NODE_ENV === "development" ||
  process.env.GOOGLE_AI_USE_PROXY === "1";

const googleAiProxyUrl =
  process.env.GOOGLE_AI_PROXY_URL ?? "http://127.0.0.1:7897";

function googleAiProxyFetch(url: string | URL | Request, init?: RequestInit) {
  return undiciFetch(
    url as Parameters<typeof undiciFetch>[0],
    {
      ...init,
      dispatcher: new ProxyAgent(googleAiProxyUrl),
    } as Parameters<typeof undiciFetch>[1]
  ) as unknown as Promise<Response>;
}

const googleProvider = createGoogleGenerativeAI({
  apiKey: getGeminiApiKey(),
  baseURL: getGoogleGenerativeAiSdkBaseUrl(),
  ...(useGoogleAiProxy ? { fetch: googleAiProxyFetch } : {}),
});

const deepseekProvider = createOpenAICompatible({
  name: "deepseek",
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

function isGeminiQuotaError(error: unknown): boolean {
  const e = error as { status?: number; statusCode?: number; code?: string; message?: string };
  const status = e?.status ?? e?.statusCode;
  if (status === 429) return true;
  const msg = String(e?.message ?? "");
  if (/RESOURCE_EXHAUSTED/i.test(msg)) return true;
  if (/quota/i.test(msg) && /exceed/i.test(msg)) return true;
  return false;
}

function quotaErrorBrief(error: unknown) {
  const e = error as { status?: number; statusCode?: number; code?: string; message?: string; name?: string };
  return {
    name: String(e?.name ?? ""),
    status: e?.status ?? e?.statusCode,
    code: e?.code,
    message: String(e?.message ?? "").slice(0, 600),
  };
}

function logGeminiQuota(tag: string, error: unknown) {
  // Next dev 对 console.warn 有时不明显；用 console.log + stringify 确保可见
  // eslint-disable-next-line no-console
  console.log(tag, JSON.stringify(quotaErrorBrief(error)));
}

function fallbackHeaders(error: unknown): Record<string, string> {
  const b = quotaErrorBrief(error);
  return {
    "x-ai-fallback": "gemini_quota",
    "x-ai-fallback-status": String(b.status ?? ""),
    "x-ai-fallback-code": String(b.code ?? ""),
    // message 仅截断后透传，方便前端展示；避免过长 header
    "x-ai-fallback-message": String(b.message ?? "").slice(0, 180),
  };
}

const SYSTEM_PROMPT_PORTFOLIO = `你是拥有 4 年经验的 AI 产品经理（AI PM）梦星的数字分身。你部署在我的作品集网站上 (mengxing-ai-pm.vercel.app)，负责 24 小时接待 HR、猎头和同行。你需要主动热情地打招呼，并邀请对方提供 JD 进行能力匹配。当被问及实战项目时，请极其专业地讲解“金融合规智能助手”项目——向对方说明该系统的目标用户是交易员 (Traders)、销售 (Sales) 和合规经理 (Compliance Managers)，并清晰拆解核心模块、技术架构以及它带来的核心业务价值。你的语气要自信、专业、Result-driven。`;

function buildLearningSystemPrompt(documentContext: string, learningRole: "feynman" | "interview") {
  const modeHint =
    learningRole === "interview"
      ? "\n\n【当前模式：模拟面试】以专业面试官口吻提问与追问，但仍必须严格围绕上述文档；不得编造文档未出现的事实或细节。"
      : "\n\n【当前模式：费曼学习法】用通俗类比帮助理解，但必须紧扣文档中的概念与论述；不要为了好懂而引入文档未讨论的话题作为核心例子。";

  return `
<System>
你是一位出色的阐释者，能像理查德·费曼那样将复杂概念
分解为简单直观的真理。你擅长通过类比、追问和迭代改进
帮助用户真正理解一个主题——不是死记硬背，而是能够用
自己的话讲给别人听。
你的语气始终耐心、温暖、鼓励。当用户回答不完整或出现
理解偏差时，不批评，而是用"这是个很常见的误解"或
"让我们换个角度看"来引导。
</System>

<Context>
【当前学习文档】：
${documentContext}

你需要：
- 优先基于用户上传的文档内容进行讲解
- 文档内容不足时才补充自身知识
- 始终以费曼学习循环推进：
  简化 → 发现缺口 → 质疑假设 → 修正理解 → 应用 → 
  压缩为可传授的洞见
</Context>

<Instructions>
【第一轮：建立基础】
1. 如果用户没有指定主题，从文档中提炼核心主题供用户确认
2. 询问理解水平：完全陌生 / 听说过但不清楚 / 有些了解但不系统
3. 用一个生活化比喻给出初步解释（100-150字，避免专业术语）
4. 主动指出这个主题最常见的 1-2 个误解

【第二轮：发现缺口】
5. 提出 3-5 个针对性问题，覆盖以下维度：
   • 是什么——概念本质
   • 为什么——背后原理
   • 如果……会怎样——边界条件
   • 和……有什么不同——与相似概念的区别
   避免是非题，要求用户用自己的话解释

【第三轮：迭代改进】
6. 根据用户回答，分 2-3 步逐步深化解释
   每步比上一步多加入一个新维度
   每次引入专业术语前先给出简单定义
   用"你刚才说的 X 很接近，让我们再进一步"衔接

【第四轮：检验理解】
7. 给出真实场景或小任务，要求用户：
   用自己的话解释给一个完全不懂的朋友
   或解决一个和主题相关的具体小问题

【第五轮：教学概要】
8. 生成最终教学概要：
   核心概念：（一句话）
   最好的类比：（一句话）
   关键原理：（2-3条，每条不超过20字）
   最常见误解：（1-2条）
   一句话讲给朋友：（留空由用户填写）
</Instructions>

<Constraints>
- 每次解释必须包含至少一个具体类比
- 初步解释阶段严格禁止专业术语
- 任何术语必须先用一句话定义再使用
- 每次迭代解释必须比上一次更清晰，不能只是更长
- 单次回复不超过400字，避免信息过载
- 如用户表现出困惑或沮丧，立刻退回更简单的类比
- 如用户的提问与文档内容明显无关，温和地引导回文档主题

【核心约束】：你接下来的所有教学和解释，必须且只能基于以下文档内容进行；不能凭常识“自由发挥”到与文档无关的领域。若文档未提及某主题，请明确说明文档未涉及，并引导回到文档内容。

若用户的提问与该文档明显无关，请温和地引导用户把问题改写为与该文档相关的问题（可提示从标题、章节或核心论点切入）。

当你判断用户已经能够：
- 用自己的话清晰解释核心概念
- 正确回答你提出的追问
- 给出合理的类比或例子
满足以上三点时，在你的回复末尾加上特殊标记：
[MASTERY_ACHIEVED:score]
其中 score 是0-100的掌握度评分
例如：[MASTERY_ACHIEVED:85]
这个标记对用户不可见，只用于系统判断

${modeHint}
</Constraints>
`;
}

export const maxDuration = 60;

type ChatModelId =
  | "gemini-2.5-flash"
  | "gemini-2.5-pro"
  | "gemini-2.5-pro-thinking"
  | "gemini-2.5-flash-image-preview"
  | "gemini-3-flash-preview"
  | "gemini-3-pro-preview"
  | "gemini-3-pro-preview-thinking"
  | "gemini-3-pro-preview-thinking-*"
  | "gemini-3.1-pro-preview"
  | "gemini-3.1-pro-preview-thinking"
  | "deepseek-chat";

function resolveChatModelId(raw: unknown): ChatModelId {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (
    s === "gemini-2.0-flash" ||
    s === "gemini-2.0-flash-001" ||
    s === "gemini-2.0-flash-lite" ||
    s === "gemini-2.0-flash-lite-001"
  ) {
    return "gemini-2.5-flash";
  }
  if (
    s === "gemini-2.5-pro" ||
    s === "gemini-2.5-pro-thinking" ||
    s === "gemini-2.5-flash" ||
    s === "gemini-2.5-flash-image-preview" ||
    s === "gemini-3-flash-preview" ||
    s === "gemini-3-pro-preview" ||
    s === "gemini-3-pro-preview-thinking" ||
    s === "gemini-3-pro-preview-thinking-*" ||
    s === "gemini-3.1-pro-preview" ||
    s === "gemini-3.1-pro-preview-thinking" ||
    s === "deepseek-chat"
  ) {
    return s;
  }
  return "gemini-2.5-pro";
}

type ChatRequestBody = {
  messages: UIMessage[];
  documentContext?: string;
  learningRole?: "feynman" | "interview";
  /** Learning 页传入；未传或非法时默认 gemini-2.5-pro */
  model?: string;
  /** 默认 true，与 DefaultChatTransport / useChat 流式兼容；Learning 页可用 false 拿 JSON */
  stream?: boolean;
};

export async function POST(req: Request) {
  logChatGeminiKeyFingerprintOnce();

  let body: ChatRequestBody;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages } = body;
  if (!messages || !Array.isArray(messages)) {
    return new Response(JSON.stringify({ error: "Missing messages array." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const documentContext =
    typeof body.documentContext === "string" ? body.documentContext.trim() : "";
  const learningRole = body.learningRole === "interview" ? "interview" : "feynman";
  const useStream = body.stream !== false;
  const modelId = resolveChatModelId(body.model);

  const system =
    documentContext.length > 0
      ? buildLearningSystemPrompt(documentContext, learningRole)
      : SYSTEM_PROMPT_PORTFOLIO;

  const modelMessages = await convertToModelMessages(messages);

  if (!useStream) {
    try {
      if (modelId === "deepseek-chat") {
        if (!process.env.DEEPSEEK_API_KEY?.trim()) {
          throw new Error("Missing DEEPSEEK_API_KEY");
        }
        const { text } = await generateText({
          model: deepseekProvider("deepseek-chat"),
          system,
          messages: modelMessages,
          temperature: 0.4,
        });
        return new Response(JSON.stringify({ text: text.trim() || "", engine: "deepseek" }), {
          status: 200,
          headers: { "Content-Type": "application/json", "x-ai-engine": "deepseek" },
        });
      }
      if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim()) {
        throw new Error("Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
      }
      const { text } = await generateText({
        model: googleProvider(modelId),
        system,
        messages: modelMessages,
        temperature: 0.4,
      });
      return new Response(JSON.stringify({ text: text.trim() || "", engine: "gemini" }), {
        status: 200,
        headers: { "Content-Type": "application/json", "x-ai-engine": "gemini" },
      });
    } catch (error: any) {
      if (isGeminiQuotaError(error)) {
        logGeminiQuota("[chat] fallback->deepseek (gemini quota)", error);
      }
      try {
        if (!process.env.DEEPSEEK_API_KEY?.trim()) {
          throw new Error("Missing DEEPSEEK_API_KEY");
        }
        const { text } = await generateText({
          model: deepseekProvider("deepseek-chat"),
          system,
          messages: modelMessages,
          temperature: 0.4,
        });
        return new Response(
          JSON.stringify({
            text: text.trim() || "",
            engine: "deepseek",
            ...(isGeminiQuotaError(error)
              ? { fallback: { kind: "gemini_quota", ...quotaErrorBrief(error) } }
              : {}),
          }),
          {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "x-ai-engine": "deepseek",
            ...(isGeminiQuotaError(error) ? fallbackHeaders(error) : {}),
          },
        }
        );
      } catch (fallbackErr: any) {
        console.error("[chat ERROR] type:", fallbackErr?.constructor?.name);
        console.error("[chat ERROR] message:", fallbackErr?.message);
        console.error("[chat ERROR] status:", fallbackErr?.status || fallbackErr?.statusCode);
        console.error("[chat ERROR] full:", JSON.stringify(fallbackErr, null, 2));

        return new Response(
          JSON.stringify({
            error: fallbackErr?.message || "Unknown error",
            type: fallbackErr?.constructor?.name,
          }),
          { status: 500, headers: { "Content-Type": "application/json" } }
        );
      }
    }
  }

  try {
    if (modelId === "deepseek-chat") {
      if (!process.env.DEEPSEEK_API_KEY?.trim()) {
        return new Response(JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        });
      }
      const result = streamText({
        model: deepseekProvider("deepseek-chat"),
        system,
        messages: modelMessages,
      });
      return result.toUIMessageStreamResponse({
        headers: { "x-ai-engine": "deepseek" },
      });
    }
    if (!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY)?.trim()) {
      throw new Error("Missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY");
    }

    /**
     * IMPORTANT:
     * Some provider errors (notably Gemini 429 / RESOURCE_EXHAUSTED) may surface
     * during streaming, after the response has already started, which makes it
     * impossible to "switch engines" mid-stream.
     *
     * We do a tiny preflight request (maxTokens=1) to catch quota errors early
     * and fallback to DeepSeek BEFORE starting the stream.
     */
    try {
      await generateText({
        model: googleProvider(modelId),
        system,
        messages: modelMessages,
        temperature: 0,
        maxOutputTokens: 1,
      });
    } catch (preflightErr: any) {
      if (isGeminiQuotaError(preflightErr)) {
        logGeminiQuota("[chat] preflight fallback->deepseek (gemini quota)", preflightErr);
        if (!process.env.DEEPSEEK_API_KEY?.trim()) {
          return new Response(JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        const deepseekResult = streamText({
          model: deepseekProvider("deepseek-chat"),
          system,
          messages: modelMessages,
        });
        return deepseekResult.toUIMessageStreamResponse({
          headers: {
            "x-ai-engine": "deepseek",
            ...fallbackHeaders(preflightErr),
          },
        });
      }
      throw preflightErr;
    }

    const result = streamText({
      model: googleProvider(modelId),
      system,
      messages: modelMessages,
    });
    return result.toUIMessageStreamResponse({
      headers: { "x-ai-engine": "gemini" },
    });
  } catch (error: any) {
    if (isGeminiQuotaError(error)) {
      logGeminiQuota("[chat] streaming fallback->deepseek (gemini quota)", error);
    }
    if (!process.env.DEEPSEEK_API_KEY?.trim()) {
      return new Response(
        JSON.stringify({ error: "Missing DEEPSEEK_API_KEY" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
    const result = streamText({
      model: deepseekProvider("deepseek-chat"),
      system,
      messages: modelMessages,
    });
    return result.toUIMessageStreamResponse({
      headers: {
        "x-ai-engine": "deepseek",
        ...(isGeminiQuotaError(error)
          ? fallbackHeaders(error)
          : {}),
      },
    });
  }
}
