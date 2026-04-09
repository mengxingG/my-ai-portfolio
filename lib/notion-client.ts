import { Client } from "@notionhq/client";

/** Notion 直连，不使用 HTTPS_PROXY / 本地代理，避免 ETIMEDOUT 或错误路由 */
const NOTION_FETCH_TIMEOUT_MS = 10_000;

function createDirectFetchWithTimeout(timeoutMs: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(input, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };
}

export function createNotionClient(token: string) {
  return new Client({
    auth: token,
    fetch: createDirectFetchWithTimeout(NOTION_FETCH_TIMEOUT_MS),
  });
}
