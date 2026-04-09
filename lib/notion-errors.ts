import {
  APIResponseError,
  RequestTimeoutError,
  UnknownHTTPResponseError,
} from "@notionhq/client";

/** 前端可根据 code 区分提示 */
export const NOTION_ERROR_CODES = {
  NETWORK_TIMEOUT: "NOTION_NETWORK_TIMEOUT",
  API_ERROR: "NOTION_API_ERROR",
  UNKNOWN: "NOTION_UNKNOWN",
} as const;

export type NotionErrorCode = (typeof NOTION_ERROR_CODES)[keyof typeof NOTION_ERROR_CODES];

export function notionErrorToRouteBody(
  error: unknown
): { status: number; body: { error: string; code: NotionErrorCode } } {
  if (APIResponseError.isAPIResponseError(error)) {
    return {
      status: 502,
      body: {
        code: NOTION_ERROR_CODES.API_ERROR,
        error: formatNotionApiMessage(error),
      },
    };
  }
  if (UnknownHTTPResponseError.isUnknownHTTPResponseError(error)) {
    const u = error;
    return {
      status: 502,
      body: {
        code: NOTION_ERROR_CODES.API_ERROR,
        error: u.message || "Notion 返回了无法解析的错误响应",
      },
    };
  }
  if (isNetworkTimeoutLike(error)) {
    return {
      status: 504,
      body: {
        code: NOTION_ERROR_CODES.NETWORK_TIMEOUT,
        error: "连接 Notion 超时，请稍后重试或检查本地网络",
      },
    };
  }
  const msg = error instanceof Error ? error.message : String(error ?? "Unknown error");
  return {
    status: 500,
    body: {
      code: NOTION_ERROR_CODES.UNKNOWN,
      error: msg,
    },
  };
}

function formatNotionApiMessage(err: InstanceType<typeof APIResponseError>): string {
  const base = err.message?.trim() || "Notion API 错误";
  const rid = err.request_id ? `（request_id: ${err.request_id}）` : "";
  return `${base}${rid}`.slice(0, 500);
}

function isNetworkTimeoutLike(error: unknown): boolean {
  if (RequestTimeoutError.isRequestTimeoutError(error)) return true;
  if (error instanceof Error && error.name === "AbortError") return true;
  const err = error as NodeJS.ErrnoException & { code?: string };
  if (err?.code === "ETIMEDOUT") return true;
  const msg = String((error as Error)?.message ?? error);
  if (/ETIMEDOUT|aborted|timeout|socket hang up|fetch failed/i.test(msg)) return true;
  return false;
}

/** 前端展示：与 `/api/knowledge/[id]` 返回的 `code` 对齐 */
export function userMessageFromKnowledgeApiPayload(data: {
  error?: string;
  code?: string;
} | null): string {
  if (!data) return "请求失败";
  if (data.code === NOTION_ERROR_CODES.NETWORK_TIMEOUT) {
    return "连接 Notion 超时，请稍后重试或检查本地网络。";
  }
  if (data.code === NOTION_ERROR_CODES.API_ERROR) {
    return data.error?.trim() ? `Notion 返回错误：${data.error}` : "Notion API 返回错误";
  }
  return data.error?.trim() || "请求失败";
}
