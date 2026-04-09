/** 解析面试官回复中的题号与结束标记 */
export function parseInterviewReplyMarkers(reply: string, totalQuestions: number) {
  const qMatch = reply.match(/【第(\d+)题】/);
  let currentN: number | null = null;
  if (qMatch) {
    const n = parseInt(qMatch[1], 10);
    if (Number.isFinite(n)) {
      currentN = Math.max(1, Math.min(Math.max(1, totalQuestions), n));
    }
  }
  const ended = /【面试结束】/.test(reply);
  return { currentN, ended };
}

/** 解析评审轮回复：追问 / 下一题标记 / 题号 / 结束 */
export type ParsedReviewReply = {
  ended: boolean;
  isFollowUp: boolean;
  hasNextTopicMarker: boolean;
  currentN: number | null;
};

export function parseReviewReply(reply: string, totalQuestions: number): ParsedReviewReply {
  const t = String(reply ?? "");
  const ended = /【面试结束】/.test(t);
  const trimmedStart = t.trimStart();
  const isFollowUp = trimmedStart.startsWith("【追问】");
  const hasNextTopicMarker = /【下一题】/.test(t);
  const { currentN } = parseInterviewReplyMarkers(t, totalQuestions);
  return { ended, isFollowUp, hasNextTopicMarker, currentN };
}

/** 从含【第N题】的完整回复中提取题干正文（去掉第一行标记行） */
export function extractQuestionBodyAfterMarker(reply: string): string {
  const t = String(reply ?? "").trim();
  if (!t) return "";
  const lines = t.split(/\r?\n/);
  const first = lines[0]?.trim() ?? "";
  if (first.match(/^【第\d+题】$/)) {
    return lines.slice(1).join("\n").trim() || t;
  }
  // 同一行：【第N题】题干…
  const sameLine = t.replace(/^【第\d+题】\s*/u, "").trim();
  if (sameLine !== t) return sameLine || t;
  return t;
}

/** 语音播报时去掉机器可读标记，避免读「第括号」 */
export function stripInterviewMarkersForSpeech(text: string): string {
  return String(text ?? "")
    .replace(/【第\d+题】/g, "")
    .replace(/【面试结束】/g, "")
    .replace(/【追问】/g, "")
    .replace(/【下一题】/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
