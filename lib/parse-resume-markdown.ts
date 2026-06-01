export type ResumeSubsection = {
  heading: string;
  body: string;
};

export type ResumeSection = {
  id: string;
  title: string;
  kicker: string;
  body: string;
  subsections: ResumeSubsection[];
};

export type ParsedResume = {
  nameLine: string;
  contactLine: string;
  sections: ResumeSection[];
};

const SECTION_KICKERS: Record<string, string> = {
  个人简介: "Summary",
  核心能力: "Skills",
  工作经历: "Experience",
  "独立 AI 产品": "Projects",
  教育背景: "Education",
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\u4e00-\u9fff\w]+/g, "-")
    .replace(/^-|-$/g, "");
}

function splitByHeading(content: string, pattern: RegExp): ResumeSubsection[] {
  const parts = content.split(pattern).filter(Boolean);
  if (parts.length <= 1) {
    return [{ heading: "", body: content.trim() }];
  }

  return parts.map((part, index) => {
    const lines = part.trim().split("\n");
    const firstLine = lines[0]?.trim() ?? "";
    const body = lines.slice(1).join("\n").trim();

    if (index === 0 && !pattern.test(firstLine + "\n")) {
      return { heading: "", body: part.trim() };
    }

    return { heading: firstLine.replace(/^#+\s*/, ""), body };
  });
}

function buildSubsections(title: string, body: string): ResumeSubsection[] {
  if (title === "独立 AI 产品") {
    const subs = splitByHeading(body, /\n(?=### )/);
    return subs.filter((s) => s.heading || s.body);
  }

  if (title === "工作经历") {
    const introMatch = body.match(/^([\s\S]*?)(?=\n\*\*产品经历 \d)/);
    const intro = introMatch?.[1]?.trim() ?? "";
    const rest = introMatch ? body.slice(introMatch[0].length).trim() : body;
    const products = splitByHeading(rest, /\n(?=\*\*产品经历 \d)/);

    const result: ResumeSubsection[] = [];
    if (intro) result.push({ heading: "", body: intro });
    for (const p of products) {
      result.push({
        heading: p.heading.replace(/\*\*/g, "").trim(),
        body: p.body || p.heading,
      });
    }
    return result.length ? result : [{ heading: "", body }];
  }

  return [{ heading: "", body }];
}

export function parseResumeMarkdown(markdown: string): ParsedResume {
  const blocks = markdown.split(/\n---\n/).map((b) => b.trim());
  const headerBlock = blocks[0] ?? "";

  const headerLines = headerBlock.split("\n").filter(Boolean);
  const nameLine = headerLines[0]?.replace(/^#\s*/, "") ?? "";
  const contactLine = headerLines.slice(1).join("\n");

  const sections: ResumeSection[] = blocks.slice(1).map((block) => {
    const lines = block.split("\n");
    const titleLine = lines.find((l) => l.startsWith("## "));
    const title = titleLine?.replace(/^##\s*/, "") ?? "Section";
    const bodyStart = titleLine ? lines.indexOf(titleLine) + 1 : 0;
    const body = lines.slice(bodyStart).join("\n").trim();

    return {
      id: slugify(title),
      title,
      kicker: SECTION_KICKERS[title] ?? "Section",
      body,
      subsections: buildSubsections(title, body),
    };
  });

  return { nameLine, contactLine, sections };
}
