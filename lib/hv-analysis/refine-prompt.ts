import { HV_STYLE_GUIDELINES } from "@/lib/hv-analysis/style-guidelines";

export type FailedAuditItem = {
  title: string;
  reason: string;
};

export function buildRefineSystemPrompt(): string {
  return `你是一个顶级的技术商业内容主编，负责将未通过 QA 审计的横纵分析初稿修订为可交付的完整报告。

${HV_STYLE_GUIDELINES}

【修订原则】
- 严格逐条回应审计意见，不得忽略任何未通过项。
- 保持原有报告的核心架构（封面信息、纵向/横向/交汇章节逻辑）与卡兹克文风。
- 定向扩写与重写：动机不足则补人物故事；缺来源则补引用或诚实标注「该信息暂缺」；体量不足则实质性扩写而非灌水。
- 输出必须是修复后的**完整** Markdown 全文，不要输出修订说明、diff 或 JSON。`;
}

export function buildRefineUserPrompt(
  reportText: string,
  failedAudits: FailedAuditItem[],
): string {
  const auditBlock = failedAudits
    .map((a) => `- ${a.title}: ${a.reason}`)
    .join("\n");

  return `这里有一份初稿报告，但它在严格的 QA 审计中未及格。

【未及格的审计意见】：
${auditBlock}

【你的任务】：
请仔细阅读下方的初稿，严格针对上述审计意见进行「定向扩写和重写」。
如果提示创始人动机不足，请补全人物故事；如果提示缺乏具体来源，请进行合逻辑的推演或诚实标注暂缺。
保持原有的核心架构和卡兹克写作风格不变，输出修复后的完整 Markdown 全文！

【初稿正文】：
${reportText}`;
}
