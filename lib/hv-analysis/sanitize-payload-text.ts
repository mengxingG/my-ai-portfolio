/**
 * 清理 Tavily / 网页抓取文本中的残缺转义，避免：
 * - JSON.parse（Tavily 响应体）报 unexpected end of hex escape
 * - DeepSeek / OpenAI 请求体序列化或网关二次解析失败
 */

/** 修复 JSON 源码中非法的 \\u / \\x 转义（parse 前兜底） */
export function repairJsonStringBeforeParse(jsonText: string): string {
  return String(jsonText ?? "")
    .replace(/\\x(?![0-9a-fA-F]{2})/g, "x")
    .replace(/\\u(?![0-9a-fA-F]{4})/g, "u");
}

export function safeJsonParse<T>(raw: string): T {
  const text = String(raw ?? "");
  try {
    return JSON.parse(text) as T;
  } catch {
    return JSON.parse(repairJsonStringBeforeParse(text)) as T;
  }
}

/**
 * 清理将进入 LLM system/prompt 或业务 JSON 的纯文本。
 */
export function sanitizeForLlmPayload(text: string): string {
  let s = String(text ?? "");

  s = s.replace(/\r\n?/g, "\n");

  // 残缺 \uXXXX（常见于前端转义残留）
  s = s.replace(/\\u(?![0-9a-fA-F]{4})/gi, "u");

  // 非标准 JSON 的 \xHH；残缺或完整均改为字面量 x，避免 hex escape 错误
  s = s.replace(/\\x[0-9a-fA-F]{0,2}/gi, "x");

  // 反斜杠 + 非法转义字母 → 去掉反斜杠，保留字符
  s = s.replace(/\\([^"\\/bfnrtu])/g, "$1");

  // 行尾孤立反斜杠
  s = s.replace(/\\$/gm, "");

  // C0 控制符（保留 \t \n）
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

  // 非法 Unicode 代理对
  s = s.replace(/[\uD800-\uDFFF]/g, "\uFFFD");

  return s;
}

/** 递归清理对象/数组中所有字符串字段 */
export function sanitizeDeepStrings<T>(value: T): T {
  if (typeof value === "string") {
    return sanitizeForLlmPayload(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeDeepStrings(item)) as T;
  }
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = sanitizeDeepStrings(val);
    }
    return out as T;
  }
  return value;
}
