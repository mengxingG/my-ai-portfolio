import { objectTypeDisplayLabel } from "@/lib/hv-analysis/object-type-adaptation";

/** 从流式协议文本中提取纯正文 Markdown（去掉 [INFO]/[WORKER] 等行） */
export function stripProtocolLines(raw: string): string {
  return raw
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return true;
      return !/^\[\d{2}:\d{2}:\d{2}\]\s*\[(INFO|WORKER|DATA|DONE|SEARCH|ERROR|WARN)\]/.test(
        line,
      );
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeReportFilename(targetName: string): string {
  return targetName.replace(/[/\\?%*:|"<>]/g, "_").trim().slice(0, 80) || "report";
}

export type AssembleReportOptions = {
  targetName: string;
  body: string;
  /** 联网检索摘要，用于文末「信息来源」 */
  searchContext?: string;
  competitor?: string;
  timeRange?: string;
  objectType?: string;
};

/** 报告封面 H1 + 元信息引用块（md_to_pdf 会提取到封面） */
export function buildReportHeader(opts: AssembleReportOptions): string {
  const date = new Date().toISOString().slice(0, 10);
  const domain = opts.competitor?.trim()
    ? `对标竞品：${opts.competitor.trim()}`
    : "所属领域：待补充";
  const timeLabel =
    opts.timeRange === "3years"
      ? "仅看近三年"
      : opts.timeRange === "1year"
        ? "仅看近一年"
        : "追踪完整生命史";
  const typeLabel = objectTypeDisplayLabel(opts.objectType);

  return `# ${opts.targetName}

> 研究时间：${date} | ${domain} | 时间范围：${timeLabel} | 研究对象类型：${typeLabel}

`;
}

/** 从检索摘要中提取 URL 列表 */
function extractSourceUrls(searchContext: string): string[] {
  const urls = new Set<string>();
  const re = /https?:\/\/[^\s)>\]]+/g;
  for (const m of searchContext.matchAll(re)) {
    urls.add(m[0].replace(/[.,;]+$/, ""));
  }
  return [...urls];
}

export function buildReportFooter(searchContext?: string): string {
  const accessed = new Date().toISOString().slice(0, 10);
  const urls = searchContext ? extractSourceUrls(searchContext) : [];
  const sourcesBlock =
    urls.length > 0
      ? urls.map((u, i) => `${i + 1}. ${u}（访问时间：${accessed}）`).join("\n")
      : "（本次检索摘要中未提取到可列出的 URL；请结合正文引用与「该信息暂缺」标注理解。）";

  return `

## 五、信息来源

${sourcesBlock}

## 方法论说明

本报告采用「横纵分析法」框架：纵轴沿时间追溯发展脉络，横轴在当下截面进行竞品与同类对比，并在交汇处给出综合判断。方法论由数字生命卡兹克提出，融合历时-共时分析、案例研究法与竞争战略分析等思想。
`;
}

/** 组装符合 md_to_pdf 规范的完整稿件 */
export function assembleHvReportMarkdown(opts: AssembleReportOptions): string {
  const body = stripProtocolLines(opts.body);
  const header = buildReportHeader(opts);
  const footer = buildReportFooter(opts.searchContext);
  return `${header}${body}${footer}`;
}

/** 流水线已写入封面/附录时不再重复包裹 */
export function finalizeReportMarkdown(opts: AssembleReportOptions): string {
  const body = stripProtocolLines(opts.body);
  if (body.startsWith("# ") && body.includes("## 五、信息来源")) {
    return body;
  }
  return assembleHvReportMarkdown({ ...opts, body });
}
