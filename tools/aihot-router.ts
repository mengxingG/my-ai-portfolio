// tools/aihot-router.ts

import { buildDailyCard, buildItemsCard } from "./feishu-card-builder";

export const AIHOT_PUBLIC_BASE = "https://aihot.virxact.com/api/public";

export const AIHOT_BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/** 飞书底部子菜单暗号（与 feishu_gateway.AI_HOT_MENU_COMMANDS 一字不差） */
export const FEISHU_AI_HOT_MENU_COMMANDS = [
  "看今日日报",
  "看精选条目",
  "看本周动态",
  "模型发布",
  "产品发布",
  "行业动态",
] as const;

export function isAIHotMenuCommand(userText: string): boolean {
  const trimmed = userText.trim();
  return (FEISHU_AI_HOT_MENU_COMMANDS as readonly string[]).includes(trimmed);
}

/** 飞书暗号 → API 路径（不含 base） */
export function resolveAIHotEndpoint(userText: string): string {
  return resolveEndpointForMenu(userText.trim());
}

function resolveEndpointForMenu(trimmed: string): string {
  switch (trimmed) {
    case "看今日日报":
      return "/daily";

    case "看精选条目":
      return "/items?mode=selected";

    case "看本周动态": {
      const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
      return `/items?mode=selected&since=${encodeURIComponent(lastWeek)}`;
    }

    case "模型发布":
      return "/items?mode=selected&category=ai-models";

    case "产品发布":
      return "/items?mode=selected&category=ai-products";

    case "行业动态":
      return "/items?mode=selected&category=industry";

    default:
      return "/items?mode=selected";
  }
}

export async function fetchAIHotByMenu(userText: string) {
  const trimmed = userText.trim();
  let endpoint: string;

  switch (trimmed) {
    case "看今日日报":
      endpoint = "/daily";
      break;

    case "看精选条目":
      endpoint = "/items?mode=selected";
      break;

    case "看本周动态": {
      const lastWeek = new Date(Date.now() - 7 * 86400000).toISOString();
      endpoint = `/items?mode=selected&since=${encodeURIComponent(lastWeek)}`;
      break;
    }

    case "模型发布":
      endpoint = "/items?mode=selected&category=ai-models";
      break;

    case "产品发布":
      endpoint = "/items?mode=selected&category=ai-products";
      break;

    case "行业动态":
      endpoint = "/items?mode=selected&category=industry";
      break;

    default:
      endpoint = "/items?mode=selected";
  }

  const headers = {
    "User-Agent": AIHOT_BROWSER_UA,
    Accept: "application/json",
  };

  try {
    const response = await fetch(`${AIHOT_PUBLIC_BASE}${endpoint}`, { headers });

    if (response.status === 403) {
      throw new Error("🚨 核心探针被拦截：User-Agent 校验失败。");
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`HTTP ${response.status}${body ? `: ${body.slice(0, 200)}` : ""}`);
    }

    return await response.json();
  } catch (error) {
    console.error("雷达抓取异常:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "数据源连接失败，请检查网络或后端日志。",
    };
  }
}

type FeishuTextPayload = {
  msg_type: "text";
  content: { text: string };
};

export type FeishuMenuReply = FeishuTextPayload | ReturnType<typeof buildDailyCard>;

/** 飞书菜单：拉取 AI HOT 数据并打包为 interactive 卡片或错误文本 */
export async function handleFeishuMenuEvent(userText: string): Promise<FeishuMenuReply> {
  const trimmed = userText.trim();
  const rawData = await fetchAIHotByMenu(trimmed);

  if (!rawData || (typeof rawData === "object" && "error" in rawData && rawData.error)) {
    return {
      msg_type: "text",
      content: { text: "🚨 资讯雷达暂时失联，请稍后再试。" },
    };
  }

  const data = rawData as Record<string, unknown>;

  if (trimmed === "看今日日报") {
    return buildDailyCard(data);
  }

  let cardTitle = "AI 资讯雷达";
  if (trimmed === "看精选条目") cardTitle = "今日高维精选资讯";
  if (trimmed === "看本周动态") cardTitle = "过去 7 天冷启动追踪";
  if (trimmed === "模型发布") cardTitle = "专项追踪 · 模型发布";
  if (trimmed === "产品发布") cardTitle = "专项追踪 · 产品发布";
  if (trimmed === "行业动态") cardTitle = "专项追踪 · 行业动态";

  return buildItemsCard(cardTitle, data);
}
