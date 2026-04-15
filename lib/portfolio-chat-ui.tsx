"use client";

import type { ReactNode } from "react";

/** 将 useChat / AI SDK 抛出的英文或冗长报错转为中文，并判断是否要提示改用 DeepSeek */
export function mapPortfolioChatError(
  raw: string | undefined,
  options: { preferDeepSeek: boolean }
): { summary: string; suggestDeepSeek: boolean } {
  const msg = (raw ?? "").trim();
  const lower = msg.toLowerCase();
  const { preferDeepSeek } = options;

  if (!msg) {
    return { summary: "请求失败，请稍后重试。", suggestDeepSeek: !preferDeepSeek };
  }

  // 已选用 DeepSeek 仍失败：不再提示「换 DeepSeek」
  if (preferDeepSeek) {
    let summary = "暂时无法完成回复，请检查网络后重试。";
    if (
      lower.includes("tls") ||
      lower.includes("socket") ||
      lower.includes("disconnected") ||
      lower.includes("econn") ||
      lower.includes("etimedout") ||
      lower.includes("enotfound") ||
      lower.includes("fetch failed") ||
      lower.includes("network") ||
      lower.includes("connect")
    ) {
      summary = "网络连接不稳定或无法访问对话服务，请检查网络、代理或防火墙后再试。";
    } else if (
      lower.includes("deepseek") &&
      (lower.includes("missing") || lower.includes("api_key") || lower.includes("401"))
    ) {
      summary = "DeepSeek 接口未配置或密钥无效，需服务端检查环境变量。";
    } else if (lower.includes("429") || lower.includes("rate")) {
      summary = "请求过于频繁，请稍等片刻再试。";
    }
    return { summary, suggestDeepSeek: false };
  }

  // 默认走 Gemini：可向用户建议 DeepSeek
  let summary = "对话暂时失败，请稍后重试。";
  let suggestDeepSeek = true;

  if (
    lower.includes("tls") ||
    lower.includes("socket") ||
    lower.includes("disconnected") ||
    lower.includes("econn") ||
    lower.includes("etimedout") ||
    lower.includes("failed after") ||
    lower.includes("fetch failed") ||
    (lower.includes("cannot connect") && lower.includes("api"))
  ) {
    summary =
      "当前网络无法稳定连接 Google 模型（常见于代理或 TLS 中断）。可点击下方按钮改用 DeepSeek 再试。";
    suggestDeepSeek = true;
  } else if (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("exhausted")
  ) {
    summary =
      "Gemini 额度或频率限制触发。可稍后重试，或直接改用 DeepSeek。";
    suggestDeepSeek = true;
  } else if (
    lower.includes("gemini") &&
    (lower.includes("403") || lower.includes("401") || lower.includes("api key") || lower.includes("permission"))
  ) {
    summary = "Gemini 接口鉴权失败，请检查服务端密钥配置，或改用 DeepSeek。";
    suggestDeepSeek = true;
  } else if (lower.includes("missing") && lower.includes("gemini")) {
    summary = "未配置 Gemini 密钥，请联系站点维护者或改用 DeepSeek。";
    suggestDeepSeek = true;
  } else {
    suggestDeepSeek = true;
  }

  return { summary, suggestDeepSeek };
}

export function PortfolioThinkingIndicator({
  className = "",
  label = "正在思考",
}: {
  className?: string;
  label?: string;
}): ReactNode {
  return (
    <div
      className={`portfolio-chat-thinking flex items-center justify-center gap-2.5 text-xs text-purple-300/90 ${className}`}
      role="status"
      aria-live="polite"
    >
      <span className="inline-flex h-4 items-center gap-1" aria-hidden>
        <span
          className="h-1.5 w-1.5 rounded-full bg-purple-400/90 [animation:chat-think-dot_0.9s_ease-in-out_infinite]"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-fuchsia-400/85 [animation:chat-think-dot_0.9s_ease-in-out_infinite]"
          style={{ animationDelay: "120ms" }}
        />
        <span
          className="h-1.5 w-1.5 rounded-full bg-cyan-400/80 [animation:chat-think-dot_0.9s_ease-in-out_infinite]"
          style={{ animationDelay: "240ms" }}
        />
      </span>
      <span className="font-medium tracking-wide">{label}</span>
    </div>
  );
}
