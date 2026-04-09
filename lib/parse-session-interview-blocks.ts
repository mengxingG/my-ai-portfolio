import type { InterviewEvaluation } from "@/app/api/interview/evaluate/route";

type NotionBlock = {
  type?: string;
  [key: string]: unknown;
};

function rtToPlain(rich: unknown): string {
  const arr = (rich as { rich_text?: Array<{ plain_text?: string }> } | undefined)?.rich_text;
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => String(x?.plain_text ?? "")).join("");
}

function blockPlain(b: NotionBlock): string {
  const t = b?.type;
  if (!t || typeof t !== "string") return "";
  const node = b[t] as { rich_text?: unknown } | undefined;
  return rtToPlain(node?.rich_text ?? []).trim();
}

/**
 * 解析 save-report 写入的 Notion 块序列，尽量恢复 InterviewEvaluation（用于复习入口）。
 */
export function parseInterviewReportFromNotionBlocks(
  blocks: NotionBlock[],
  fallbackScore: number,
  fallbackStatus: InterviewEvaluation["suggestedStatus"]
): InterviewEvaluation {
  let scoreFromParagraph: number | null = null;
  const questions: InterviewEvaluation["questions"] = [];
  let strengths = "";
  let improvements = "";
  let inReport = false;
  let phase: "idle" | "questions" | "overall" = "idle";
  let current: InterviewEvaluation["questions"][0] | null = null;
  let field: "missed" | null = null;

  const flushQ = () => {
    if (current && (current.questionText || current.feedback || current.userAnswer)) {
      questions.push({ ...current });
    }
    current = null;
    field = null;
  };

  for (const raw of blocks) {
    const b = raw as NotionBlock;
    const type = String(b?.type ?? "");

    if (type === "heading_2") {
      const h = blockPlain(b);
      if (h.includes("面试考核报告")) {
        inReport = true;
        phase = "questions";
      }
      continue;
    }

    if (!inReport) continue;

    if (type === "heading_3") {
      const h = blockPlain(b);
      if (h.includes("整体评价")) {
        flushQ();
        phase = "overall";
        continue;
      }
      const m = h.match(/第\s*(\d+)\s*题/);
      if (m) {
        flushQ();
        current = {
          questionText: "",
          userAnswer: "",
          score: 0,
          feedback: "",
          missedPoints: [],
        };
        phase = "questions";
        field = null;
      }
      continue;
    }

    if (type === "bulleted_list_item") {
      const plain = blockPlain(b);
      if (phase === "questions" && field === "missed" && current) {
        if (plain && plain !== "（无）") current.missedPoints.push(plain);
      }
      continue;
    }

    if (type !== "paragraph") continue;
    const text = blockPlain(b);
    if (!text) continue;

    if (phase === "overall") {
      if (text.startsWith("优势：")) strengths = text.replace(/^优势：\s*/, "").trim();
      else if (text.startsWith("改进建议：")) improvements = text.replace(/^改进建议：\s*/, "").trim();
      continue;
    }

    if (phase === "questions") {
      if (text.startsWith("考核时间：") || text.startsWith("难度：")) {
        continue;
      }
      if (text.startsWith("总分：")) {
        const mm = text.match(/(\d+)\s*\/\s*100/);
        if (mm) scoreFromParagraph = Math.max(0, Math.min(100, parseInt(mm[1]!, 10)));
        continue;
      }

      if (!current) continue;

      if (text.startsWith("题目：")) {
        current.questionText = text.replace(/^题目：\s*/, "").trim();
        field = null;
      } else if (text.startsWith("你的回答：")) {
        current.userAnswer = text.replace(/^你的回答：\s*/, "").trim();
        field = null;
      } else if (text.startsWith("得分：")) {
        const mm = text.match(/(\d+)\s*\/\s*100/);
        if (mm) current.score = Math.max(0, Math.min(100, parseInt(mm[1]!, 10)));
        field = null;
      } else if (text.startsWith("反馈：")) {
        current.feedback = text.replace(/^反馈：\s*/, "").trim();
        field = null;
      } else if (text.startsWith("遗漏知识点：")) {
        field = "missed";
      }
    }
  }

  flushQ();

  const st = fallbackStatus;
  const avgFromQs = questions.length
    ? Math.round(questions.reduce((s, q) => s + q.score, 0) / questions.length)
    : null;
  const overallScore =
    scoreFromParagraph ??
    avgFromQs ??
    Math.max(0, Math.min(100, Math.round(fallbackScore)));

  return {
    overallScore,
    questions,
    strengths: strengths || "（见历史会话页）",
    improvements: improvements || "（见历史会话页）",
    suggestedStatus: st,
  };
}

/** save-report 仅追加顶层块，无需递归。 */
export async function listAllBlockChildren(
  notion: import("@notionhq/client").Client,
  blockId: string
): Promise<NotionBlock[]> {
  const out: NotionBlock[] = [];
  let cursor: string | undefined;
  do {
    const res = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const block of res.results ?? []) {
      out.push(block as NotionBlock);
    }
    cursor = res.has_more ? res.next_cursor ?? undefined : undefined;
  } while (cursor);
  return out;
}
