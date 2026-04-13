import type { LucideIcon } from "lucide-react";
import {
  Crosshair,
  Link2,
  MessageCircle,
  Newspaper,
  Twitter,
  Youtube,
} from "lucide-react";
import { canonicalAINewsSource } from "@/utils/ai-news-source-canonical";

export type AINewsSourceVisual = {
  /** 卡片底部等位置展示的文案 */
  footerLabel: string;
  Icon: LucideIcon;
  iconClassName: string;
  /** 左上角图标容器 ring */
  ringClassName: string;
};

const FALLBACK: AINewsSourceVisual = {
  footerLabel: "",
  Icon: Link2,
  iconClassName: "text-slate-400",
  ringClassName: "border-white/10",
};

/**
 * 根据 `AINews.source`（或 Notion 原始值）解析图标与文案；未知来源回退为 Link + 原文。
 */
export function getAINewsSourcePresentation(sourceRaw: string): AINewsSourceVisual {
  const key = canonicalAINewsSource(sourceRaw);

  switch (key) {
    case "YouTube":
      return {
        footerLabel: "YouTube",
        Icon: Youtube,
        iconClassName: "text-red-500",
        ringClassName: "border-red-500/35",
      };
    case "X":
      return {
        footerLabel: "X",
        Icon: Twitter,
        iconClassName: "text-white",
        ringClassName: "border-white/10",
      };
    case "Polymarket":
      return {
        footerLabel: "Polymarket",
        Icon: Crosshair,
        iconClassName: "text-violet-300",
        ringClassName: "border-violet-500/35",
      };
    case "Hacker News":
      return {
        footerLabel: "Hacker News",
        Icon: Newspaper,
        iconClassName: "text-orange-400",
        ringClassName: "border-orange-500/35",
      };
    case "Reddit":
      return {
        footerLabel: "Reddit",
        Icon: MessageCircle,
        iconClassName: "text-orange-500",
        ringClassName: "border-orange-500/30",
      };
    case "Unknown":
      return {
        ...FALLBACK,
        footerLabel: "Unknown",
      };
    default:
      return {
        ...FALLBACK,
        footerLabel: key,
      };
  }
}

type IconSlotProps = {
  source: string;
  size?: "sm" | "md";
};

/** 左上角来源图标（与全站雷达卡片一致） */
export function AINewsSourceIconSlot({ source, size = "md" }: IconSlotProps) {
  const { Icon, iconClassName, ringClassName } = getAINewsSourcePresentation(source);
  const dim = size === "sm" ? "h-4 w-4" : "h-4 w-4";
  return (
    <div
      className={`flex items-center justify-center rounded-full border bg-black/30 p-1.5 ${ringClassName}`}
    >
      <Icon className={`${dim} shrink-0 ${iconClassName}`} aria-hidden />
    </div>
  );
}
