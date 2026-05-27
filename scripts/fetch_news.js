#!/usr/bin/env node
/**
 * 通过 HTTP 触发已部署的 cron API（可选，供服务器 crontab 使用）
 *
 * 环境变量：
 *   CRON_FETCH_NEWS_URL — 默认 http://localhost:3000/api/cron-fetch-news
 *   CRON_SECRET         — 与 API 鉴权一致，自动附加 Authorization: Bearer …
 *
 * 本地开发与 API 共用逻辑请使用：npm run fetch-news
 */

const url =
  process.env.CRON_FETCH_NEWS_URL?.trim() ||
  "http://localhost:3000/api/cron-fetch-news";

async function main() {
  const secret = process.env.CRON_SECRET?.trim();
  const headers = {};
  if (secret) headers.Authorization = `Bearer ${secret}`;

  const res = await fetch(url, { method: "GET", headers });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error("[fetch_news] HTTP", res.status, body);
    process.exitCode = 1;
    return;
  }
  console.log("[fetch_news]", body);
}

main().catch((err) => {
  console.error("[fetch_news]", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
