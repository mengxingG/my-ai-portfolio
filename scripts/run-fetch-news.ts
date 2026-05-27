/**
 * 本地/CI 执行：与 GET /api/cron-fetch-news 共用逻辑
 * 运行：npm run fetch-news
 */
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
