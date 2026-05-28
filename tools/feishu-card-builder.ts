// tools/feishu-card-builder.ts

type FeishuCardPayload = { msg_type: "interactive"; card: Record<string, unknown> };

function itemLink(item: { url?: string; sourceUrl?: string }): string {
  return item.url || item.sourceUrl || "#";
}

function itemSource(item: { source?: string; sourceName?: string }): string {
  return item.source || item.sourceName || "";
}

/** 去掉孤立 UTF-16 代理项，避免 Python json.dumps surrogates not allowed */
function sanitizeText(text: string): string {
  return text.replace(/[\uD800-\uDFFF]/g, "\uFFFD");
}

/** 处理 /daily 接口的杂志日报卡片 */
export function buildDailyCard(data: Record<string, unknown>): FeishuCardPayload {
  const sections = (data.sections as Array<Record<string, unknown>>) || [];
  const dateStr = (data.date as string) || "";
  const leadTitle = sanitizeText(
    (data.leadTitle as string) ||
      ((data.lead as { title?: string } | null)?.title ?? ""),
  );

  const card: Record<string, unknown> = {
    config: { wide_screen_mode: true, enable_forward: true },
    header: {
      title: { tag: "plain_text", content: `📰 AI HOT 日报 · ${dateStr}` },
      template: "emerald",
    },
    elements: [] as Array<Record<string, unknown>>,
  };

  const elements = card.elements as Array<Record<string, unknown>>;

  if (leadTitle) {
    elements.push({
      tag: "markdown",
      content: `🔥 **今日导读**\n${leadTitle}\n***`,
    });
  }

  sections.forEach((section, index) => {
    const sectionIndex = String(index + 1).padStart(2, "0");
    const label = sanitizeText((section.label as string) || "版块");
    let markdownContent = `### 📌 ${sectionIndex} ${label}\n`;

    const items = (section.items as Array<Record<string, unknown>>) || [];
    items.forEach((item, itemIdx) => {
      const title = sanitizeText((item.title as string) || "无标题");
      const url = itemLink(item as { url?: string; sourceUrl?: string });
      markdownContent += `${itemIdx + 1}. **[${title}](${url})**\n`;
      const summary = item.summary as string | undefined;
      if (summary) {
        markdownContent += `> <font color='gray'>${sanitizeText(summary)}</font>\n`;
      }
    });

    elements.push({
      tag: "markdown",
      content: markdownContent,
    });

    if (index < sections.length - 1) {
      elements.push({ tag: "hr" });
    }
  });

  return { msg_type: "interactive", card };
}

/** 处理 /items 接口的扁平流式卡片（精选、全部、分类追踪） */
export function buildItemsCard(
  title: string,
  data: Record<string, unknown>,
): FeishuCardPayload {
  const items = (data.items as Array<Record<string, unknown>>) || [];

  const card: Record<string, unknown> = {
    config: { wide_screen_mode: true, enable_forward: true },
    header: {
      title: { tag: "plain_text", content: `📡 ${title}` },
      template: "blue",
    },
    elements: [] as Array<Record<string, unknown>>,
  };

  const elements = card.elements as Array<Record<string, unknown>>;
  let markdownContent = "";

  if (items.length === 0) {
    markdownContent = "🤖 雷达未探测到相关动态，请稍后再试。";
  } else {
    const displayItems = items.slice(0, 10);
    displayItems.forEach((item, index) => {
      const titleText = sanitizeText((item.title as string) || "无标题");
      const url = itemLink(item as { url?: string; sourceUrl?: string });
      const source = sanitizeText(
        itemSource(item as { source?: string; sourceName?: string }),
      );
      const sourceBadge = source ? ` \`[${source}]\` ` : "";
      markdownContent += `${index + 1}. **[${titleText}](${url})**${sourceBadge}\n`;
      const summary = item.summary as string | undefined;
      if (summary) {
        const safe = sanitizeText(summary);
        const shortSummary = safe.length > 80 ? `${safe.slice(0, 80)}...` : safe;
        markdownContent += `> <font color='gray'>${shortSummary}</font>\n`;
      }
      markdownContent += "\n";
    });
  }

  elements.push({
    tag: "markdown",
    content: markdownContent,
  });

  elements.push({
    tag: "note",
    elements: [{ tag: "plain_text", content: "💡 数据实时源自 AI HOT 精选探针" }],
  });

  return { msg_type: "interactive", card };
}
