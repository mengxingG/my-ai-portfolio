import OpenAI from "openai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const asrClient = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: "https://api.siliconflow.cn/v1",
});

const SYSTEM_PROMPT =
  "你是一个严格但具有引导性的 IT 面试官。用户正在用费曼技巧向你解释一个技术概念。你需要：1. 判断解释是否通俗易懂；2. 指出其中的漏洞；3. 抛出一个简短的、一针见血的追问。你的回复必须口语化、简短，不要超过 80 个字，因为你的回复会被直接转成语音播报。";

export async function POST(req: Request) {
  try {
    if (!process.env.SILICONFLOW_API_KEY) {
      return NextResponse.json({ error: "Missing SILICONFLOW_API_KEY" }, { status: 500 });
    }
    if (!process.env.DEEPSEEK_API_KEY) {
      return NextResponse.json({ error: "Missing DEEPSEEK_API_KEY" }, { status: 500 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio");
    if (!(audioFile instanceof File)) {
      return NextResponse.json({ error: "audio file is required" }, { status: 400 });
    }

    const transcription = await asrClient.audio.transcriptions.create({
      file: audioFile,
      model: "FunAudioLLM/SenseVoiceSmall",
      language: "zh",
      response_format: "json",
      temperature: 0,
    });

    const userTranscript = (transcription.text ?? "").trim();
    if (!userTranscript) {
      return NextResponse.json({ error: "ASR returned empty transcript" }, { status: 422 });
    }

    const resp = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userTranscript },
      ],
      temperature: 0.6,
      max_tokens: 140,
    });

    const aiReply = resp.choices?.[0]?.message?.content?.trim() ?? "";
    if (!aiReply) {
      return NextResponse.json({ error: "Empty model reply" }, { status: 502 });
    }

    return NextResponse.json({ userTranscript, aiReply });
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      response?: { data?: unknown; status?: number };
      error?: unknown;
    };
    const message = e?.message ?? "Unknown error";
    const responseData = e?.response?.data ?? e?.error ?? null;
    const status = e?.status ?? e?.response?.status ?? 500;

    console.error("[/api/interview] failed", {
      message,
      status,
      responseData,
    });

    return NextResponse.json(
      {
        error: message,
        status,
        details: responseData,
      },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}

