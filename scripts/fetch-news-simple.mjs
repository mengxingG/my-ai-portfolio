const API_BASE = (process.env.AI_NEWS_UPDATE_API_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const TOPIC = process.env.AI_NEWS_UPDATE_TOPIC?.trim() || "AI";
const DAYS = Math.min(366, Math.max(1, Number(process.env.AI_NEWS_UPDATE_DAYS ?? "1") || 1));
const FETCH_URL = `${API_BASE}/api/news?topic=${encodeURIComponent(TOPIC)}&days=${DAYS}`;
const FETCH_TIMEOUT_MS = Number(process.env.AI_NEWS_UPDATE_TIMEOUT_MS ?? "180000");
const NOTION_API = "https://api.notion.com/v1";
const NOTION_V = "2022-06-28";
const BEIJING_TZ = "Asia/Shanghai";
const ENGINE_A_AUTHOR_PREFIX = "Engine A";

const API_KEY = process.env.NOTION_API_KEY?.trim();
const DB_ID = process.env.NOTION_AI_NEWS_DB_ID?.trim();
if (!API_KEY) { console.error("缺少 NOTION_API_KEY"); process.exit(1); }
if (!DB_ID) { console.error("缺少 NOTION_AI_NEWS_DB_ID"); process.exit(1); }

const AUTH = { "Authorization": `Bearer ${API_KEY}`, "Content-Type": "application/json", "Notion-Version": NOTION_V };

function tzYmd(input) {
  const d = new Date(input);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA", { timeZone: BEIJING_TZ });
}

function formatAuthor(raw) {
  const author = String(raw ?? "").trim();
  if (!author || author === "Unknown") return ENGINE_A_AUTHOR_PREFIX;
  if (author.startsWith(ENGINE_A_AUTHOR_PREFIX)) return author;
  return `${ENGINE_A_AUTHOR_PREFIX} · ${author}`;
}

function richChunks(text) {
  const t = String(text ?? "").trim() || "无摘要";
  const chunks = [];
  for (let i = 0; i < t.length; i += 2000)
    chunks.push({ type: "text", text: { content: t.slice(i, i + 2000) } });
  return chunks;
}

async function notionFetch(path, body) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(`${NOTION_API}${path}`, {
      method: "POST",
      headers: AUTH,
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const data = await r.json();
    if (!r.ok) throw new Error(`${r.status}: ${data.message || JSON.stringify(data).substring(0, 200)}`);
    return data;
  } finally { clearTimeout(timer); }
}

async function main() {
  console.log("[fetch-news] 拉取 Engine A (ai-news-update) 新闻...");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  let rows;
  try {
    const res = await fetch(FETCH_URL, { headers: { Accept: "application/json" }, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Engine A API ${res.status}`);
    rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("返回格式异常");
  } finally {
    clearTimeout(timer);
  }
  console.log(`[fetch-news] ✓ ${rows.length} 条`);

  const now = new Date();
  const today = tzYmd(now);
  const yesterday = tzYmd(new Date(now.getTime() - 86400000));
  console.log(`[fetch-news] 日期范围: ${yesterday} ~ ${today}`);

  const filtered = rows.filter(item => {
    const dateYmd = item.Date?.slice(0, 10);
    return item.URL && dateYmd && [today, yesterday].includes(dateYmd);
  });
  console.log(`[fetch-news] 今日/昨日: ${filtered.length} 条`);
  for (const x of filtered) console.log(`  [${x.Date?.slice(0, 10)}] ${x.Title?.substring(0, 60)}`);

  if (filtered.length === 0) {
    console.log("[fetch-news] 无需写入");
    return;
  }

  let created = 0, failed = 0;

  for (const item of filtered) {
    try {
      const dateYmd = item.Date.slice(0, 10);
      const props = {
        Title: { title: [{ text: { content: (item.Title || "未命名").substring(0, 2000) } }] },
        OriginalText: { rich_text: richChunks(item.OriginalText) },
        URL: { url: item.URL },
        Source: { rich_text: [{ text: { content: (item.Source || "Unknown").substring(0, 2000) } }] },
        Date: { date: { start: `${dateYmd}T12:00:00+08:00` } },
        Author: { rich_text: [{ text: { content: formatAuthor(item.Author) } }] }
      };

      await notionFetch(`/pages`, {
        parent: { database_id: DB_ID },
        properties: props
      });
      created++;
      console.log(`[fetch-news] ✓ ${item.Title?.substring(0, 40)}`);
    } catch (e) {
      if (e.message.includes("409") || e.message.includes("conflict") || e.message.includes("duplicate")) {
        console.log(`[fetch-news] ↺ 跳过重复: ${item.Title?.substring(0, 40)}`);
      } else {
        failed++;
        console.error(`[fetch-news] ✗ ${item.Title?.substring(0, 30)}: ${e.message.substring(0, 200)}`);
      }
    }
  }

  console.log(`[fetch-news] 完成: 获取=${rows.length}, 过滤=${filtered.length}, 新增=${created}, 失败=${failed}`);
}

main().catch(e => { console.error("[fetch-news] 失败:", e.message); process.exit(1); });
