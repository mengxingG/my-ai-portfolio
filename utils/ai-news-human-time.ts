import { AI_NEWS_TIMEZONE } from "@/utils/ai-news-time-range";
import type { AINews } from "@/utils/notion";
import { getNewsSortMs } from "@/utils/ai-news-category";

const MS_MIN = 60_000;
const MS_HOUR = 3_600_000;

type ShanghaiParts = {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
};

function partsInShanghai(date: Date): ShanghaiParts {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: AI_NEWS_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const p = fmt.formatToParts(date);
  const pick = (type: string) => Number(p.find((x) => x.type === type)?.value ?? 0);
  return {
    y: pick("year"),
    mo: pick("month"),
    d: pick("day"),
    h: pick("hour"),
    mi: pick("minute"),
  };
}

function ymdKey(parts: Pick<ShanghaiParts, "y" | "mo" | "d">): string {
  return `${parts.y}-${String(parts.mo).padStart(2, "0")}-${String(parts.d).padStart(2, "0")}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function daypartLabel(h: number): string {
  if (h < 6) return "凌晨";
  if (h < 12) return "上午";
  if (h < 14) return "中午";
  if (h < 18) return "下午";
  return "晚上";
}

/** 解析条目时间为 Date；优先 publishedAt，否则 date 当日中午上海 */
export function parseNewsInstant(item: AINews): Date | null {
  if (item.publishedAt) {
    const d = new Date(item.publishedAt);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const day = item.date?.trim().slice(0, 10);
  if (day && day.length >= 10) {
    const d = new Date(`${day}T12:00:00+08:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const ms = getNewsSortMs(item);
  if (ms > 0) return new Date(ms);
  return null;
}

/**
 * 列表主时间文案：禁止 ISO / YYYY-MM-DD HH:mm:ss
 * 今天 →「2 小时前」或「今天上午 09:48」；昨天 →「昨天 16:43」；更早 →「5/7 00:43」
 */
export function formatHumanNewsTime(item: AINews, now: Date = new Date()): string {
  const instant = parseNewsInstant(item);
  if (!instant) return "时间未知";

  const t = partsInShanghai(instant);
  const n = partsInShanghai(now);
  const todayKey = ymdKey(n);
  const itemKey = ymdKey(t);
  const clock = `${pad2(t.h)}:${pad2(t.mi)}`;

  const diffMs = now.getTime() - instant.getTime();
  if (diffMs < 0) return `今天${daypartLabel(t.h)} ${clock}`;

  if (itemKey === todayKey) {
    if (diffMs < MS_MIN) return "刚刚";
    if (diffMs < 60 * MS_MIN) {
      const mins = Math.max(1, Math.floor(diffMs / MS_MIN));
      return `${mins} 分钟前`;
    }
    if (diffMs < 6 * MS_HOUR) {
      const hours = Math.max(1, Math.floor(diffMs / MS_HOUR));
      return `${hours} 小时前`;
    }
    return `今天${daypartLabel(t.h)} ${clock}`;
  }

  const yesterday = new Date(now.getTime() - 86_400_000);
  if (itemKey === ymdKey(partsInShanghai(yesterday))) {
    return `昨天 ${clock}`;
  }

  if (t.y === n.y) {
    return `${t.mo}/${t.d} ${clock}`;
  }
  return `${t.y}/${t.mo}/${t.d} ${clock}`;
}

/** 时间轴圆点旁：仅时分 HH:mm */
export function formatTimelineClock(item: AINews): string {
  const instant = parseNewsInstant(item);
  if (!instant) return "--:--";
  const t = partsInShanghai(instant);
  return `${pad2(t.h)}:${pad2(t.mi)}`;
}
