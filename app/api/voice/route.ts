import { ProxyAgent, fetch as undiciFetch } from "undici";
import {
  getGeminiApiKey,
  getGeminiApiKeyWithSource,
  getGeminiV1BetaBaseUrl,
} from "@/lib/gemini-server-config";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** 与 /api/chat 一致：仅本地 dev 或显式 GOOGLE_AI_USE_PROXY=1 时走代理 */
const useGoogleAiProxy =
  process.env.NODE_ENV === "development" || process.env.GOOGLE_AI_USE_PROXY === "1";

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

const geminiHttpFetch: typeof fetch = useGoogleAiProxy
  ? (googleAiProxyFetch as typeof fetch)
  : globalThis.fetch.bind(globalThis);

/** 默认与 /api/chat 所选 Flash 同级：低延迟；可用 VOICE_GEMINI_MODEL 覆盖 */
const GEMINI_TRANSCRIBE_MODEL =
  process.env.VOICE_GEMINI_MODEL?.trim() || "gemini-2.5-flash";

const TRANSCRIBE_PROMPT =
  "请将这段音频中的语音逐字转写成文字。只输出说话内容本身，保持说话者的语言（中文则输出中文），不要翻译，不要加任何说明或前后缀。";

/**
 * 调用 Gemini `generateContent`，与 @ai-sdk/google 同源路径：
 * `{baseURL}/models/{model}:generateContent`
 * 多模态：文本 + inline_data（base64 音频），由模型做音频理解并转写。
 */
async function transcribeWithGemini(
  buffer: Buffer,
  mimeType: string,
  apiKey: string
): Promise<string> {
  const base = getGeminiV1BetaBaseUrl();
  const pathModel = GEMINI_TRANSCRIBE_MODEL.includes("/")
    ? GEMINI_TRANSCRIBE_MODEL
    : `models/${GEMINI_TRANSCRIBE_MODEL}`;
  const url = new URL(`${base}/${pathModel}:generateContent`);
  url.searchParams.set("key", apiKey);

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          { text: TRANSCRIBE_PROMPT },
          {
            inline_data: {
              mime_type: mimeType,
              data: buffer.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 8192,
    },
  };

  const res = await geminiHttpFetch(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // 与 Google 文档一致；部分网关同时接受 query key
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }

  const json = (await res.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text =
    json.candidates?.[0]?.content?.parts
      ?.map((p) => p.text ?? "")
      .join("")
      .trim() ?? "";
  return text;
}

function resolveAudioMime(formType: string | undefined, fileName: string): string {
  const t = (formType ?? "").trim().toLowerCase();
  if (t && t !== "application/octet-stream") return t;
  const n = fileName.toLowerCase();
  if (n.endsWith(".webm")) return "audio/webm";
  if (n.endsWith(".m4a") || n.endsWith(".mp4") || n.endsWith(".aac")) return "audio/mp4";
  if (n.endsWith(".ogg")) return "audio/ogg";
  if (n.endsWith(".wav")) return "audio/wav";
  return "audio/webm";
}

export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data." }, { status: 400 });
  }

  const raw = form.get("audio");
  if (!(raw instanceof File)) {
    return Response.json({ error: "Missing audio file." }, { status: 400 });
  }

  if (raw.size > MAX_AUDIO_BYTES) {
    return Response.json({ error: "Audio too large." }, { status: 413 });
  }

  if (raw.size === 0) {
    return Response.json({ error: "Empty audio." }, { status: 400 });
  }

  const apiKey = getGeminiApiKey()?.trim();
  if (!apiKey) {
    return Response.json(
      { error: "Server missing GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY." },
      { status: 500 }
    );
  }

  const { source: keySource } = getGeminiApiKeyWithSource();

  if (process.env.NODE_ENV === "development" || process.env.VOICE_DEBUG_KEY === "1") {
    // eslint-disable-next-line no-console
    console.log(
      `[voice] gemini key from ${keySource ?? "?"}, prefix=${apiKey.slice(0, 8)}… | base=${getGeminiV1BetaBaseUrl()} | model=${GEMINI_TRANSCRIBE_MODEL}`
    );
  }

  const buf = Buffer.from(await raw.arrayBuffer());
  const mimeType = resolveAudioMime(raw.type, raw.name);

  try {
    const text = await transcribeWithGemini(buf, mimeType, apiKey);
    if (text.length > 0) {
      return Response.json({ text });
    }
  } catch (e) {
    console.error("[voice] Gemini transcription failed:", e);
  }

  return Response.json({ error: "transcription_failed" }, { status: 502 });
}
