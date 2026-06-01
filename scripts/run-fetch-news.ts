/**
 * 本地/CI 执行：调用 ai-news-update Engine A → 写入 Notion
 * 运行：npm run fetch-news
 * 前置：ai-news-update 服务已启动（默认 http://127.0.0.1:8000）
 */
import dotenv from "dotenv";
dotenv.config({ override: true });

import { formatCronFetchError, runCronFetchNews } from "../lib/cron-fetch-news";

async function main() {
  try {
    const stats = await runCronFetchNews();
    console.log("[fetch_news] 完成:", stats);
  } catch (err) {
    console.error("[fetch_news] 失败:", formatCronFetchError(err));
    process.exitCode = 1;
  }
}

main();
