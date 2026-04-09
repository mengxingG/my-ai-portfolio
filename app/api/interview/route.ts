import OpenAI from "openai";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com/v1",
});

const asrClient = new OpenAI({
  apiKey: process.env.SILICONFLOW_API_KEY,
  baseURL: "https://api.siliconflow.cn/v1",
});

type InterviewMode = "transcribe" | "ask" | "review";

/** 与 DeepSeek 上下文上限对齐，避免 FormData 超大正文拖垮请求 */
const INTERVIEW_DOCUMENT_MAX_CHARS = 100_000;

function clampInt(raw: unknown, fallback: number, min: number, max: number) {
  const s = typeof raw === "string" ? raw.trim() : "";
  const n = s && /^\d+$/.test(s) ? parseInt(s, 10) : Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/** 第 currentQuestion 题对应的递增难度档（1～5）。共 3 题时用第 1、3、5 档；其余题量线性映射到 1～5 */
function resolveDifficultyTier(currentQuestion: number, totalQuestions: number): number {
  const n = Math.max(1, Math.min(10, totalQuestions));
  const cq = Math.max(1, Math.min(n, currentQuestion));
  if (n === 3) {
    const map = [1, 3, 5];
    return map[Math.min(cq, 3) - 1] ?? 1;
  }
  if (n >= 5) return Math.min(5, cq);
  if (n <= 1) return 1;
  const step = Math.round((cq * 5) / n);
  return Math.max(1, Math.min(5, step));
}

function difficultyTierGuideText(tier: number): string {
  const t = Math.max(1, Math.min(5, tier));
  const lines: Record<number, string> = {
    1:
      '第 1 档（热身破冰）：最基础的概念理解，如 "你怎么理解 X？""能简单说说 X 是什么吗？"',
    2:
      '第 2 档（稍加深入）：比较或解释原因，如 "X 和 Y 有什么区别？""为什么说 X 很重要？"',
    3:
      '第 3 档（逻辑分析）：梳理关系或推导，如 "X 和 Y 之间是什么关系？""如果 X 成立，会带来什么影响？"',
    4:
      '第 4 档（观点判断）：立场与论证，如 "你同意 X 的说法吗？为什么？""这个判断有哪些前提条件？"',
    5:
      '第 5 档（综合应用）：结合场景或自己的思考，如 "如果让你向老板汇报这个话题，你会怎么讲？""这个趋势对你的工作有什么启发？"',
  };
  return lines[t] ?? lines[1];
}

function readDocumentContext(formData: FormData): string {
  const raw = formData.get("documentContent") ?? formData.get("documentContext");
  const t = typeof raw === "string" ? raw.trim() : "";
  if (!t) return "";
  return t.length > INTERVIEW_DOCUMENT_MAX_CHARS ? t.slice(0, INTERVIEW_DOCUMENT_MAX_CHARS) : t;
}

function buildInterviewSystemPrompt(opts: {
  documentContext: string;
  totalQuestions: number;
  currentQuestion: number;
  mode: Exclude<InterviewMode, "transcribe">;
}): string {
  const { documentContext, totalQuestions, currentQuestion, mode } = opts;
  const n = Math.max(1, Math.min(10, totalQuestions));
  const cq = Math.max(1, Math.min(n, currentQuestion));
  const tier = resolveDifficultyTier(cq, n);
  const tierHint = difficultyTierGuideText(tier);

  const roundMode =
    mode === "ask"
      ? `
<RoundMode>
【本轮：仅出题】用户尚未提交答案。
- 只输出本题题干：第一行必须以【第${cq}题】开头（与 Context 中「当前第」一致），随后是具体问题
- 本题须符合 Context 中的「当前题难度档」话术层次；题干须严格基于【考核文档内容】可支持的观点与概念，禁止无依据发挥
- 表述必须符合 <Instructions>【角色设定】：自然面试口吻，禁止「根据文档」「文档中提到」「资料显示」等措辞
- 禁止评价、禁止追问用户、禁止输出【追问】【下一题】【面试结束】；禁止输出除本题外的其它【第M题】
</RoundMode>`
      : `
<RoundMode>
【本轮：评审用户已提交的答案】
- 先按 <Instructions>【评价标准】判断回答档次，再决定：优秀→一句肯定收束；及格/较差→最多 1 次【追问】；完全错误→诚实点明+关键提示后直接收束（不使用【追问】）
- 【追问】：整条回复必须以【追问】开头，全题最多 1 次；追问话术须符合【评价标准】中「及格/较差」的范例精神
- 无【追问】的收束：优秀等一般情况仅一句、≤15 字（汉字/标点合计），不加【追问】【第N题】等标记；优秀时可参考「不错，这个点抓得很准。」
- 「完全错误」类收束：允许 2～3 个短分句点明偏差+关键提示+先跳过本题，整段仍须紧凑（建议≤80 字），不加【追问】
- 用户在唯一一次追问后答得好：仅一句正面反馈，≤15 字，无任何标记
- 用户在唯一一次追问后仍明显答不上来：诚实收束（如「这块可能还需要再消化一下」），整句尽量短（建议≤24 字），无标记，不要虚假鼓励
- 完全错误收束：点明有偏差+一句话关键提示（可含「先跳过这题」类表述），仍须短；不要编造文档外事实
- 最后一题且本题已收束、整场结束时：同一回复须含【面试结束】；非最后一题不要输出【面试结束】
- 可选用单独一行【下一题】作显式过渡（可选）；禁止在本轮写出下一题的【第M题】题干——下一题由候选人在界面点按钮后系统再请求你出题
- 不要打分数、不要写「总分」式裁决；但必须诚实区分优劣，禁止无差别好评
- 【面试结束】时不要长篇总结
</RoundMode>`;

  const docBlock = documentContext.trim() || "（未提供文档正文：你必须拒绝编造，并说明无法基于文档出题/评价）";

  return `<System>
你是一位严格但公正的面试官，专门考核用户对指定文档内容的理解深度。
你的提问必须 100% 来自下方提供的文档内容，绝不允许出题超出文档范围。
你的风格是专业、简洁、有压迫感但不刻薄。追问时像剥洋葱一样层层深入。

【表述要求】（必须遵守）
- 全程使用自然、口语化的面试对话方式，像真人面对面交流，句子要短、好懂。
- 可自然口语，但禁止暴露材料痕迹：不要说材料、文档、资料、文中、上文、笔记、「根据……写的」等；禁止让用户感觉你在照本宣科念材料。
- 问题要直接抛向概念/观点/应用本身，就像你们已经共同具备行业语境，只是在现场考察理解深度。
</System>

<Context>
【考核文档内容】：
${docBlock}

【面试配置】：
- 难度：自动递增（按题号提升，无需候选人选择档位）
- 总题数：${n}
- 当前第：${cq} 题
- 当前题难度档（第 ${tier} 档，供你把握提问深度）：${tierHint}
</Context>

<Instructions>
【角色设定】
你已经完整阅读了候选人提交的学习材料，现在要基于这些内容考核候选人的理解深度。
你的提问方式和真实面试完全一致——直接问概念、问观点、问应用，就像你们在讨论一个共同了解的话题。
绝对不要说"根据文档""文档中提到""资料显示"等字眼。你就是一个懂这个领域的面试官在自然地提问。

【出题策略：自动递增难度】
按题目顺序自动提升难度，不需要用户选择：
- 第 1 题：热身破冰，问一个最基础的概念理解（"你怎么理解 X？""能简单说说 X 是什么吗？"）
- 第 2 题：稍微深入，要求比较或解释原因（"X 和 Y 有什么区别？""为什么说 X 很重要？"）
- 第 3 题：逻辑分析，要求梳理关系或推导（"X 和 Y 之间是什么关系？""如果 X 成立，会带来什么影响？"）
- 第 4 题：观点判断，要求表达立场并论证（"你同意 X 的说法吗？为什么？""这个判断有哪些前提条件？"）
- 第 5 题：综合应用，要求结合实际场景或提出自己的思考（"如果让你向老板汇报这个话题，你会怎么讲？""这个趋势对你的工作有什么启发？"）
若总题数为 3，则三题分别对应上述第 1、3、5 题的难度梯度。其它题数由系统映射到最接近的 1～5 档（见 Context「当前题难度档」）。

【出题规则】
1. 每次只出一道题，用 【第N题】 标记开头
2. 出题内容基于文档中的观点和概念，但用面试官自然提问的口吻
   ❌ 错误示范："根据文档，Hassabis 如何定义 AGI？"
   ✅ 正确示范："你怎么理解通用人工智能（AGI）？它和现在的 AI 有什么本质区别？"
3. 严格遵循 Context 中的「当前题难度档」控制深度

【评价标准】
你必须诚实、有区分度地反馈，禁止默认给好评、禁止为客气而模糊标准。

1）回答优秀（准确、有细节、有自己的思考）
   → 一句肯定即可（参考语气）：「不错，这个点抓得很准。」
   → 不要追问；本条回复不加任何标记（界面会由用户点「下一题」继续）

2）回答及格（大方向对但缺细节或深度）
   → 本题尚未追问过时：必须以【追问】开头，要求补充具体内容，例如：
      「【追问】方向对了，但还不够具体。你能举个实际的例子吗？」
      「【追问】你说的'更多创造力'是指什么层面的？能展开说说吗？」

3）回答较差（模糊、套话、偏离重点）
   → 本题尚未追问过时：必须以【追问】开头，直接点出不足并引导，例如：
      「【追问】这个回答比较笼统，感觉像是在背概念。换个方式——如果你要向一个完全不懂的人解释，你会怎么说？」
      「【追问】你提到了 X，但这不是这个问题的核心。提示你想想 Y 方面。」

4）回答完全错误
   → 不要用【追问】；应明确说有偏差，给一句关键提示，并表达本题先放过、后面再想，例如：
      「这个理解有偏差。其实核心在于 X，我们先跳过这题，后面的题目你可以再想想。」
   → 仍须基于文档，不得编造文档未涉及的核心结论

【追问规则】
- 每题最多追问 1 次（仅「及格」「较差」且尚未追问时可发【追问】；「完全错误」不走追问格式）
- 追问后若用户补充得好：仅一句简短正面评价，不超过 15 字，不加任何标记
- 追问后若用户仍明显答不上来：诚实说一句，例如「这块可能还需要再消化一下」，然后结束本题（不加标记）；不要为鼓励而降低标准
- 面试的价值是让用户知道短板：该点明就点明，但保持专业、不人身攻击

【追问标记】
需要追问时，回复必须以【追问】开头，例如：
"【追问】你说的'创造性输出'能举个具体例子吗？"

【过渡规则】
- 除【追问】、完全错误收束、追问后诚实收束、以及最后一题的【面试结束】外：平常肯定/中性收束只用一句，不超过 15 字
- 完全错误收束：可略长但仍要短（见【评价标准】4））；追问后仍答不上来的诚实一句话可略长于 15 字，避免冗长
- 收束后不加【第N题】、不写下一题题干；如需可选过渡可单独一行【下一题】
- 下一题由候选人在界面点按钮后，系统才会再次请求你出新题；你只需完成本题侧的反馈内容

【过渡与结束】
- 所有题目问完后，在最后一次收束回复中必须包含【面试结束】

【核心约束】
- 出题范围限定在文档涉及的话题内，但提问口吻必须自然
- 单次回复不超过 150 字（【追问】轮可适当信息量，但仍要紧凑）
- 保持专业、冷静，不刻薄
</Instructions>

<Constraints>
- 结构与约束强度应对齐学习页的费曼导师 prompt：<System> / <Context> / <Instructions> / <Constraints> 分层，且「紧扣文档、禁止越界」为最高优先级
- 若【考核文档内容】为空或明确不足，你必须说明无法基于文档继续，并停止编造题目或知识点
- 出题与追问均须：自然口语 + 不暴露文档措辞（与 <System>【表述要求】一致）
${roundMode}
</Constraints>`;
}

type TurnMsg = { role: "user" | "assistant"; content: string };

function parseHistoryJson(raw: unknown): TurnMsg[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: TurnMsg[] = [];
    for (const m of parsed) {
      if (!m || typeof m !== "object") continue;
      const role = (m as { role?: string }).role;
      const content = (m as { content?: string }).content;
      if ((role === "user" || role === "assistant") && typeof content === "string") {
        out.push({ role, content });
      }
    }
    return out.slice(-24);
  } catch {
    return [];
  }
}

export async function POST(req: Request) {
  try {
    if (!process.env.SILICONFLOW_API_KEY) {
      return NextResponse.json({ error: "Missing SILICONFLOW_API_KEY" }, { status: 500 });
    }
    if (!process.env.DEEPSEEK_API_KEY) {
      console.warn("[interview] DEEPSEEK_API_KEY not set, interview mode may fail");
    }

    const formData = await req.formData();
    const modeRaw = formData.get("mode");
    const mode: InterviewMode =
      modeRaw === "ask" || modeRaw === "review" || modeRaw === "transcribe" ? modeRaw : "review";

    const totalQuestions = clampInt(formData.get("totalQuestions"), 5, 1, 10);
    const currentQuestion = clampInt(formData.get("currentQuestion"), 1, 1, totalQuestions);

    const history = parseHistoryJson(formData.get("history"));

    if (mode === "transcribe") {
      const audioFile = formData.get("audio");
      if (!(audioFile instanceof File)) {
        return NextResponse.json({ error: "audio file is required for transcribe" }, { status: 400 });
      }
      const transcription = await asrClient.audio.transcriptions.create({
        file: audioFile,
        model: "FunAudioLLM/SenseVoiceSmall",
        language: "zh",
        response_format: "json",
        temperature: 0,
      });
      const userTranscript = (transcription.text ?? "").trim();
      if (!userTranscript) {
        return NextResponse.json({ error: "ASR returned empty transcript" }, { status: 422 });
      }
      return NextResponse.json({ userTranscript });
    }

    if (!process.env.DEEPSEEK_API_KEY?.trim()) {
      return NextResponse.json({ error: "Missing DEEPSEEK_API_KEY" }, { status: 500 });
    }

    const documentContext = readDocumentContext(formData);

    if (!documentContext.trim()) {
      console.warn("[/api/interview] documentContent is empty — interviewer may refuse or hallucinate");
    } else {
      // eslint-disable-next-line no-console
      console.log("[/api/interview] documentContent", {
        chars: documentContext.length,
        mode,
        currentQuestion,
        totalQuestions,
        difficultyTier: resolveDifficultyTier(currentQuestion, totalQuestions),
      });
    }

    const system = buildInterviewSystemPrompt({
      documentContext,
      totalQuestions,
      currentQuestion,
      mode,
    });
    const base: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: "system", content: system },
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    let userContent = "";
    if (mode === "ask") {
      userContent =
        `请根据【考核文档内容】与【面试配置】，输出第 ${currentQuestion} 题的题干。` +
        `严格遵守 <RoundMode> 与【第${currentQuestion}题】标记要求。`;
    } else {
      const questionText = String(formData.get("questionText") ?? "").trim();
      const answerText = String(formData.get("answerText") ?? "").trim();
      if (!answerText) {
        return NextResponse.json({ error: "answerText is required for review" }, { status: 400 });
      }
      userContent = [
        `当前题号：第 ${currentQuestion} 题 / 共 ${totalQuestions} 题`,
        questionText ? `题目：${questionText}` : "",
        `用户回答：${answerText}`,
      ]
        .filter(Boolean)
        .join("\n");
    }

    const resp = await deepseekClient.chat.completions.create({
      model: "deepseek-chat",
      messages: [...base, { role: "user", content: userContent }],
      temperature: 0.55,
      max_tokens: 600,
    });

    const aiReply = resp.choices?.[0]?.message?.content?.trim() ?? "";
    if (!aiReply) return NextResponse.json({ error: "Empty model reply" }, { status: 502 });
    return NextResponse.json({ aiReply });
  } catch (err) {
    const e = err as {
      message?: string;
      status?: number;
      response?: { data?: unknown; status?: number };
      error?: unknown;
    };
    const message = e?.message ?? "Unknown error";
    const responseData = e?.response?.data ?? e?.error ?? null;
    const status = e?.status ?? e?.response?.status ?? 500;

    console.error("[/api/interview] failed", {
      message,
      status,
      responseData,
    });

    return NextResponse.json(
      {
        error: message,
        status,
        details: responseData,
      },
      { status: typeof status === "number" ? status : 500 }
    );
  }
}
