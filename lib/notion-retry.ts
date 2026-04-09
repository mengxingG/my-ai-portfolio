import { APIResponseError, RequestTimeoutError, isNotionClientError } from "@notionhq/client";

/**
 * 仅对「网络层」失败重试一次（超时、连接重置等）。
 * Notion 已返回 HTTP 业务错误（4xx/5xx 且带 body）不重试。
 */
export async function withNotionRetryOnce<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (e) {
    if (!isRetryableNetworkError(e)) throw e;
    return await operation();
  }
}

function isRetryableNetworkError(e: unknown): boolean {
  if (APIResponseError.isAPIResponseError(e)) return false;
  if (isNotionClientError(e)) {
    if (RequestTimeoutError.isRequestTimeoutError(e)) return true;
    return false;
  }
  if (e instanceof Error && e.name === "AbortError") return true;
  const err = e as NodeJS.ErrnoException & { code?: string };
  const code = err?.code;
  if (code === "ETIMEDOUT" || code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ENOTFOUND") {
    return true;
  }
  const msg = String((e as Error)?.message ?? e);
  if (/ETIMEDOUT|ECONNRESET|ECONNREFUSED|ENOTFOUND|socket hang up|fetch failed|aborted|network/i.test(msg)) {
    return true;
  }
  return false;
}
