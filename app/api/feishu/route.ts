// app/api/feishu/route.ts
import { NextResponse } from "next/server";
import {
  handleFeishuMenuEvent,
  type FeishuMenuReply,
} from "@/tools/aihot-router";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FEISHU_API = "https://open.feishu.cn/open-apis";

type FeishuApiResponse = {
  code?: number;
  msg?: string;
};

type FeishuWebhookBody = {
  type?: string;
  challenge?: string;
  header?: { event_type?: string };
  event?: {
    message?: {
      chat_id?: string;
      message_type?: string;
      content?: string;
      message_id?: string;
    };
  };
};

/** 获取飞书 Tenant Access Token */
async function getFeishuToken(): Promise<string> {
  const appId = process.env.FEISHU_APP_ID?.trim();
  const appSecret = process.env.FEISHU_APP_SECRET?.trim();
  if (!appId || !appSecret) {
    throw new Error("缺少 FEISHU_APP_ID 或 FEISHU_APP_SECRET");
  }

  const res = await fetch(
    `${FEISHU_API}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    },
  );

  const data = (await res.json()) as FeishuApiResponse & {
    tenant_access_token?: string;
  };
  if (data.code !== 0 || !data.tenant_access_token) {
    throw new Error(`获取 Token 失败: ${data.msg ?? `HTTP ${res.status}`}`);
  }
  return data.tenant_access_token;
}

/** 主动向飞书发送 interactive 卡片 */
async function sendFeishuCard(
  chatId: string,
  cardPayload: Extract<FeishuMenuReply, { msg_type: "interactive" }>,
  token: string,
) {
  const url = `${FEISHU_API}/im/v1/messages?receive_id_type=chat_id`;

  const bodyPayload = {
    receive_id: chatId,
    msg_type: "interactive",
    content: JSON.stringify(cardPayload.card),
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(bodyPayload),
  });

  const data = (await res.json()) as FeishuApiResponse;
  if (data.code !== 0) {
    console.error("发送飞书卡片失败:", data);
    throw new Error(data.msg ?? "发送飞书卡片失败");
  }
  return data;
}

/** 主动向飞书发送纯文本（雷达失联等兜底） */
async function sendFeishuText(
  chatId: string,
  text: string,
  token: string,
) {
  const url = `${FEISHU_API}/im/v1/messages?receive_id_type=chat_id`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify({
      receive_id: chatId,
      msg_type: "text",
      content: JSON.stringify({ text }),
    }),
  });

  const data = (await res.json()) as FeishuApiResponse;
  if (data.code !== 0) {
    console.error("发送飞书文本失败:", data);
    throw new Error(data.msg ?? "发送飞书文本失败");
  }
  return data;
}

async function pushFeishuReply(
  chatId: string,
  payload: FeishuMenuReply,
  token: string,
) {
  if (payload.msg_type === "text") {
    await sendFeishuText(chatId, payload.content.text, token);
  } else {
    await sendFeishuCard(chatId, payload, token);
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as FeishuWebhookBody;

  // 1. 飞书 Webhook URL 验证挑战
  if (body.type === "url_verification") {
    return NextResponse.json({ challenge: body.challenge });
  }

  // 2. 接收菜单点击 / 文本消息事件
  if (body.header?.event_type === "im.message.receive_v1") {
    try {
      const message = body.event?.message;
      if (!message?.chat_id || message.message_type !== "text" || !message.content) {
        return NextResponse.json({ success: true });
      }

      const messageContent = JSON.parse(message.content) as { text?: string };
      const userText = (messageContent.text ?? "").trim();
      const chatId = message.chat_id;

      if (!userText) {
        return NextResponse.json({ success: true });
      }

      console.log(`[飞书请求] 收到用户指令: ${userText}`);

      const cardPayload = await handleFeishuMenuEvent(userText);

      const token = await getFeishuToken();
      await pushFeishuReply(chatId, cardPayload, token);

      console.log(`[飞书响应] 消息已成功推送到 chat_id: ${chatId}`);
    } catch (error) {
      console.error("处理飞书事件异常:", error);
    }
  }

  // 3. 快速签收 Webhook（飞书要求尽快返回 200）
  return NextResponse.json({ success: true });
}
