// feishu-local-api.ts — 仅供本地 Python 网关调用的卡片引擎
import express from "express";
import { handleFeishuMenuEvent } from "./tools/aihot-router";

const PORT = Number(process.env.FEISHU_LOCAL_API_PORT) || 3001;
const HOST = "127.0.0.1";

const app = express();
app.use(express.json({ limit: "1mb" }));

app.post("/internal/news-card", async (req, res) => {
  const userText = typeof req.body?.text === "string" ? req.body.text.trim() : "";
  if (!userText) {
    res.status(400).json({ error: "缺少 text 字段" });
    return;
  }

  console.log(`[Node.js 内部收到指令] -> ${userText}`);

  try {
    const cardPayload = await handleFeishuMenuEvent(userText);
    res.json(cardPayload);
  } catch (error) {
    console.error("生成卡片失败:", error);
    res.status(500).json({ error: "生成卡片失败" });
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "feishu-local-api" });
});

app.listen(PORT, HOST, () => {
  console.log(`📦 Node.js 内部卡片引擎已启动，监听 ${HOST}:${PORT} ...`);
});
