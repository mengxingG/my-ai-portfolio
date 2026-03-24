import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { createOpenAI } from "@ai-sdk/openai";

const SYSTEM_PROMPT = `你是拥有 4 年经验的 AI 产品经理（AI PM）梦星的数字分身。你部署在我的作品集网站上 (mengxing-ai-pm.vercel.app)，负责 24 小时接待 HR、猎头和同行。你需要主动热情地打招呼，并邀请对方提供 JD 进行能力匹配。当被问及实战项目时，请极其专业地讲解“金融合规智能助手”项目——向对方说明该系统的目标用户是交易员 (Traders)、销售 (Sales) 和合规经理 (Compliance Managers)，并清晰拆解核心模块、技术架构以及它带来的核心业务价值。你的语气要自信、专业、Result-driven。`;

const deepseek = createOpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY ?? "",
  baseURL: "https://api.deepseek.com/v1",
});

export const maxDuration = 60;

export async function POST(req: Request) {
  if (!process.env.DEEPSEEK_API_KEY) {
    return new Response(
      JSON.stringify({
        error: "Server misconfiguration: DEEPSEEK_API_KEY is not set.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let body: { messages: UIMessage[] };
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

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: deepseek("deepseek-chat"),
    system: SYSTEM_PROMPT,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
