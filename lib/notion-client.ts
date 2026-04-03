import { Client } from "@notionhq/client";
import { HttpsProxyAgent } from "https-proxy-agent";

export const createNotionClient = (token: string) => {
  // ⚠️ 注意：这里默认写了 7897，如果用户的代理是 7890，请修改此处
  const proxyUrl = "http://127.0.0.1:7897";

  // 仅在本地开发环境启用底层代理
  const agent = process.env.NODE_ENV === "development" ? new HttpsProxyAgent(proxyUrl) : undefined;

  return new Client({
    auth: token,
    agent,
  });
};
