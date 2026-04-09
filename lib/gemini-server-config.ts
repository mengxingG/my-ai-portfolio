/**
 * 服务端 Gemini 配置：与 /api/chat 使用相同的密钥解析顺序与 base URL，
 * 便于其它直连 REST 的路由（如 /api/voice）与 AI SDK 行为一致。
 */

export type GeminiKeySource = "GEMINI_API_KEY" | "GOOGLE_GENERATIVE_AI_API_KEY" | null;

/** 与 createGoogleGenerativeAI({ baseURL }) 一致：未配置时交给 SDK 默认 */
export function getGoogleGenerativeAiSdkBaseUrl(): string | undefined {
  const b = process.env.GOOGLE_GEMINI_BASE_URL?.trim();
  return b || undefined;
}

/**
 * 拼接 REST `.../v1beta/models/{model}:generateContent` 时使用。
 * 未设置 GOOGLE_GEMINI_BASE_URL 时为官方 v1beta 根路径。
 */
export function getGeminiV1BetaBaseUrl(): string {
  const fromEnv = getGoogleGenerativeAiSdkBaseUrl();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  return "https://generativelanguage.googleapis.com/v1beta";
}

/** 与 /api/chat 中 googleProvider 的 apiKey 解析顺序一致 */
export function getGeminiApiKey(): string | undefined {
  const g = process.env.GEMINI_API_KEY?.trim();
  if (g) return g;
  const gg = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  return gg || undefined;
}

export function getGeminiApiKeyWithSource(): { key: string; source: GeminiKeySource } {
  const g = process.env.GEMINI_API_KEY?.trim();
  if (g) return { key: g, source: "GEMINI_API_KEY" };
  const gg = process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  if (gg) return { key: gg, source: "GOOGLE_GENERATIVE_AI_API_KEY" };
  return { key: "", source: null };
}

let loggedChatGeminiKeyFingerprint = false;

/** 开发环境下每个进程最多打一次，便于与 [voice] 日志对比前缀 */
export function logChatGeminiKeyFingerprintOnce(): void {
  if (loggedChatGeminiKeyFingerprint) return;
  if (process.env.NODE_ENV !== "development") return;
  loggedChatGeminiKeyFingerprint = true;
  const { key, source } = getGeminiApiKeyWithSource();
  if (!key || !source) {
    // eslint-disable-next-line no-console
    console.log("[chat] gemini key: (none)");
    return;
  }
  // eslint-disable-next-line no-console
  console.log(`[chat] gemini key from ${source}, prefix=${key.slice(0, 8)}…`);
}
