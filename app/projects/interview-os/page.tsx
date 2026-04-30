import Image from "next/image";
import Link from "next/link";

const INTERVIEW_OS_IMG = "/image/interview-prep.png";

/** 截图统一：圆角 + 细边框 + 轻阴影 */
const screenshotFrameClass =
  "overflow-hidden rounded-2xl border border-white/12 bg-black/25 shadow-[0_12px_36px_rgba(0,0,0,0.38)]";

export const metadata = {
  title: "InterviewOS · Case Study",
  description:
    "InterviewOS：全链路 AI 面试教练。融合多模态 AI 与费曼学习法的模拟面试系统，支持 JD 深度解码、自动化简历优化与高压追问模拟。",
};

type TocItem = { id: string; label: string; children?: TocItem[] };

const TOC: TocItem[] = [
  { id: "top", label: "概览" },
  {
    id: "s",
    label: "S · 我遇到了什么问题",
    children: [
      { id: "s-bg", label: "个人背景" },
      { id: "s-tools", label: "我试过的现有工具" },
      { id: "s-opp", label: "我看到的机会" },
      { id: "s-features", label: "产品核心特色" },
    ],
  },
  {
    id: "t",
    label: "T · 我要做什么",
    children: [
      { id: "t-goals", label: "产品目标" },
      { id: "t-constraints", label: "给自己的约束" },
    ],
  },
  {
    id: "a",
    label: "A · 我做了哪些决策",
    children: [
      { id: "a-1", label: "决策一：双模型分工" },
      { id: "a-2", label: "决策二：JD 解码引擎" },
      { id: "a-3", label: "决策三：五维评分体系" },
      { id: "a-4", label: "决策四：Notion 双表闭环" },
      { id: "a-5", label: "决策五：主动砍掉的功能" },
      { id: "a-pitfalls", label: "开发过程中的真实踩坑" },
    ],
  },
  {
    id: "r",
    label: "R · 做出来怎么样",
    children: [
      { id: "r-outcomes", label: "产品成果" },
      { id: "r-feel", label: "使用体感" },
      { id: "r-screens", label: "产品截图" },
      { id: "r-metrics", label: "指标设计" },
      { id: "r-iterate", label: "继续迭代" },
      { id: "r-lessons", label: "最大的教训" },
    ],
  },
  {
    id: "arch",
    label: "技术架构",
    children: [
      { id: "arch-table", label: "技术架构一览" },
      { id: "arch-closing", label: "结语" },
    ],
  },
];

function TableCard(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="text-xs font-mono font-semibold text-cyan-200/90">{props.title}</div>
      <div className="mt-3 overflow-x-auto">{props.children}</div>
    </div>
  );
}

function DarkTable(props: { headers: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <table className="w-full min-w-[520px] border-collapse text-left text-sm">
      <thead>
        <tr className="border-b border-white/10">
          {props.headers.map((h) => (
            <th key={h} className="whitespace-nowrap px-3 py-2 text-xs font-semibold text-slate-200">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {props.rows.map((r, idx) => (
          <tr key={idx} className="border-b border-white/5 last:border-b-0">
            {r.map((c, j) => (
              <td key={j} className="align-top px-3 py-2 text-slate-300">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function SectionShell(props: {
  id: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={props.id} className="scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2
            className="text-lg font-semibold text-slate-50 sm:text-xl"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            {props.title}
          </h2>
          {props.subtitle ? (
            <p className="mt-1 text-sm text-slate-500">{props.subtitle}</p>
          ) : null}
        </div>
      </div>
      <div className="mt-4 holo-card rounded-2xl p-5 sm:p-6">{props.children}</div>
    </section>
  );
}

function SubAnchorTitle(props: { id: string; title: string }) {
  return (
    <div id={props.id} className="scroll-mt-28">
      <div className="text-xs font-mono font-semibold text-cyan-200/90">{props.title}</div>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="tech-tag border-white/10 bg-white/[0.03] text-cyan-200/90">
      {children}
    </span>
  );
}

function StepTimeline(props: {
  steps: Array<{ title: string; desc: string }>;
}) {
  return (
    <div className="relative pl-6">
      <div className="absolute left-2 top-1 bottom-1 w-px bg-white/10" />
      <div className="space-y-3">
        {props.steps.map((s, idx) => (
          <div key={`${s.title}-${idx}`} className="relative">
            <div className="absolute left-0 top-3 h-2.5 w-2.5 -translate-x-[0.15rem] rounded-full border border-cyan-500/35 bg-cyan-500/15" />
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-sm font-semibold text-cyan-200">{s.title}</div>
              <div className="mt-1 text-sm text-slate-300">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function InterviewOSCaseStudyPage() {
  return (
    <div className="relative">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1fr_240px]">
        <main className="min-w-0">
          <div id="top" className="scroll-mt-24">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1
                  className="text-2xl font-semibold text-slate-50 sm:text-3xl"
                  style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
                >
                  InterviewOS - 全链路 AI 面试教练
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  融合多模态 AI 与费曼学习法的模拟面试系统。支持基于 JD 的深度解码、自动化简历优化与高压追问模拟。
                  通过 DeepSeek 与 Gemini 双模型协作实现极低延迟的对话体验。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {["DeepSeek", "Gemini", "Next.js", "Notion API", "Vercel"].map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="https://interview.mengxing-ai.it.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="glow-btn glow-btn--primary glow-btn--resume inline-flex"
              >
                在线体验 →
              </a>
              <Link href="/#projects" className="glow-btn glow-btn--secondary inline-flex">
                返回首页项目区
              </Link>
            </div>
          </div>

          {/* ========== S ========== */}
          <div className="mt-12 space-y-8">
            <SectionShell id="s" title="S · 我遇到了什么问题" subtitle="Situation">
              <SubAnchorTitle id="s-bg" title="个人背景" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                作为一名 AI 产品经理，我每年要经历数十场技术面试。我发现一个普遍痛点：市面上的面试模拟工具要么是
                「八股文题库」—— 背了答案却经不起追问；要么是「通用 AI 对话」—— 没有针对 JD 的深度拆解，
                面试官问的问题和岗位要求完全脱节。
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                更关键的是，每次面试结束后，我很难系统性地复盘自己的表现 —— 哪些问题答得好、哪些维度薄弱、
                下次应该如何改进，这些信息都散落在聊天记录里，无法沉淀为可追踪的成长数据。
              </p>

              <SubAnchorTitle id="s-tools" title="我试过的现有工具" />
              <div className="mt-3 space-y-2">
                {[
                  {
                    name: "通用 ChatGPT / Claude",
                    verdict: "❌ 没有 JD 感知，问题太泛",
                  },
                  {
                    name: "LeetCode / 牛客网",
                    verdict: "❌ 只考算法，不考业务场景",
                  },
                  {
                    name: "模拟面试平台 (Pramp / Interviewing.io)",
                    verdict: "❌ 真人匹配耗时，无法随时练习",
                  },
                  {
                    name: "Notion 自建面试笔记",
                    verdict: "❌ 手动整理，缺乏结构化复盘",
                  },
                ].map((tool) => (
                  <div
                    key={tool.name}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="text-sm text-slate-200">{tool.name}</span>
                    <span className="shrink-0 text-xs text-slate-500">{tool.verdict}</span>
                  </div>
                ))}
              </div>

              <SubAnchorTitle id="s-opp" title="我看到的机会" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                如果能把「JD 深度解码 → 简历匹配 → 模拟面试 → 高压追问 → 结构化复盘」这条链路全部打通，
                并且让数据自动沉淀到 Notion，就能真正解决「面完就忘、复盘无据」的痛点。
              </p>

              <SubAnchorTitle id="s-features" title="产品核心特色" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  {
                    title: "高压追问与五维评分",
                    desc: "摒弃无效的八股文问答。AI 基于 Substance/Structure 等五个维度打分，并针对回答漏洞进行真实的高压追问 (Pushback)。",
                  },
                  {
                    title: "故事库与 JD 精准匹配",
                    desc: "简历不盲投。系统自动拆解 JD 核心要求，从你的 Notion 故事库中提取高光素材，提供定制化对齐建议。",
                  },
                  {
                    title: "Notion 原生闭环",
                    desc: "告别「阅后即焚」的聊天框。JD 记录、面试转录稿、AI 深度复盘报告自动写回 Notion，构建长期成长的进度仪表盘。",
                  },
                ].map((f) => (
                  <div
                    key={f.title}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-sm font-semibold text-cyan-200">{f.title}</div>
                    <div className="mt-2 text-sm leading-relaxed text-slate-300">{f.desc}</div>
                  </div>
                ))}
              </div>
            </SectionShell>

            {/* ========== T ========== */}
            <SectionShell id="t" title="T · 我要做什么" subtitle="Task">
              <SubAnchorTitle id="t-goals" title="产品目标" />
              <div className="mt-3 space-y-2">
                {[
                  "构建一个「JD 感知」的 AI 面试教练，能根据具体岗位要求出题",
                  "实现多轮高压追问能力，模拟真实面试中的压力场景",
                  "设计五维评分体系（Substance / Structure / Communication / Depth / Adaptability）",
                  "面试数据自动写回 Notion，形成可追踪的成长仪表盘",
                  "支持故事库管理，让用户提前准备高光案例",
                ].map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-slate-300">
                    <span className="mt-0.5 shrink-0 text-cyan-400">◆</span>
                    <span>{g}</span>
                  </div>
                ))}
              </div>

              <SubAnchorTitle id="t-constraints" title="给自己的约束" />
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {[
                  { title: "零后端自建", desc: "所有数据持久化依赖 Notion API，不引入额外数据库" },
                  { title: "双模型分工", desc: "DeepSeek 负责高压追问与评分，Gemini 负责 JD 解析与简历匹配" },
                  { title: "10 秒内响应", desc: "面试对话必须流式输出，不能有超过 10 秒的等待" },
                  { title: "移动端优先", desc: "面试练习场景多在通勤/碎片时间，必须移动端友好" },
                ].map((c) => (
                  <div
                    key={c.title}
                    className="rounded-xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="text-sm font-semibold text-slate-200">{c.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{c.desc}</div>
                  </div>
                ))}
              </div>
            </SectionShell>

            {/* ========== A ========== */}
            <SectionShell id="a" title="A · 我做了哪些决策" subtitle="Action">
              <SubAnchorTitle id="a-1" title="决策一：双模型分工" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                面试场景对模型能力有截然不同的要求：JD 解析需要强大的文本理解与结构化能力（Gemini），
                而高压追问需要快速、尖锐的逻辑推理（DeepSeek）。我决定让两个模型各司其职：
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                  <div className="text-sm font-semibold text-cyan-200">Gemini — JD 解码引擎</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    <li>· 解析岗位描述，提取核心能力要求</li>
                    <li>· 生成定制化面试问题</li>
                    <li>· 匹配故事库与 JD 要求</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                  <div className="text-sm font-semibold text-purple-200">DeepSeek — 面试官引擎</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    <li>· 多轮对话与高压追问</li>
                    <li>· 五维实时评分</li>
                    <li>· 逻辑漏洞检测与 Pushback</li>
                  </ul>
                </div>
              </div>

              <SubAnchorTitle id="a-2" title="决策二：JD 解码引擎" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                传统的面试模拟工具忽略了一个关键环节：面试问题应该与岗位要求强相关。我设计了一个 JD 解码流程，
                将岗位描述拆解为「硬技能要求」「软技能要求」「经验要求」「行为特征」四个维度，
                然后基于这些维度生成针对性的面试问题。
              </p>
              <div className="mt-3">
                <StepTimeline
                  steps={[
                    { title: "JD 输入", desc: "用户粘贴岗位描述或输入 JD 链接" },
                    { title: "四维拆解", desc: "Gemini 将 JD 拆解为硬技能/软技能/经验/行为四个维度" },
                    { title: "问题生成", desc: "基于拆解结果生成 10-15 个定制化面试问题" },
                    { title: "故事库匹配", desc: "从 Notion 故事库中提取与 JD 匹配的高光案例" },
                  ]}
                />
              </div>

              <SubAnchorTitle id="a-3" title="决策三：五维评分体系" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                我设计了五个评分维度，覆盖面试表现的关键方面：
              </p>
              <div className="mt-3">
                <TableCard title="五维评分体系">
                  <DarkTable
                    headers={["维度", "说明", "评分标准"]}
                    rows={[
                      ["Substance", "回答内容的深度与实质", "是否有具体案例、数据支撑"],
                      ["Structure", "回答的逻辑结构", "是否使用 STAR / PREP 等框架"],
                      ["Communication", "表达的清晰度", "是否简洁、有条理、易于理解"],
                      ["Depth", "思考的深度", "是否能触及问题本质、展现洞察"],
                      ["Adaptability", "应对追问的能力", "是否能灵活调整、展现学习能力"],
                    ]}
                  />
                </TableCard>
              </div>

              <SubAnchorTitle id="a-4" title="决策四：Notion 双表闭环" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                所有面试数据通过 Notion API 写入两个数据库表：
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-cyan-200">面试记录表</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    <li>· 面试时间、JD 信息</li>
                    <li>· 完整转录稿</li>
                    <li>· 五维评分与总分</li>
                    <li>· 薄弱项标签</li>
                  </ul>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="text-sm font-semibold text-cyan-200">故事库表</div>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    <li>· 高光案例管理</li>
                    <li>· JD 匹配标签</li>
                    <li>· STAR 结构化存储</li>
                    <li>· 复用次数统计</li>
                  </ul>
                </div>
              </div>

              <SubAnchorTitle id="a-5" title="决策五：主动砍掉的功能" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                在 MVP 阶段，我主动砍掉了以下功能以聚焦核心体验：
              </p>
              <div className="mt-3 space-y-2">
                {[
                  { feature: "视频面试模拟", reason: "MVP 阶段文本交互已能验证核心价值，视频会增加大量复杂度" },
                  { feature: "多人面试模式", reason: "单人面试已覆盖 80% 场景，群面可后续迭代" },
                  { feature: "语音识别输入", reason: "文本输入更精准，语音识别会增加延迟与错误率" },
                  { feature: "面试题推荐系统", reason: "基于 JD 生成问题已足够，推荐系统需要大量用户数据" },
                ].map((item) => (
                  <div
                    key={item.feature}
                    className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3"
                  >
                    <span className="text-sm text-slate-200">{item.feature}</span>
                    <span className="shrink-0 text-xs text-slate-500">{item.reason}</span>
                  </div>
                ))}
              </div>

              <SubAnchorTitle id="a-pitfalls" title="开发过程中的真实踩坑" />
              <div className="mt-3 space-y-3">
                {[
                  {
                    title: "坑 1：DeepSeek 追问太「温柔」",
                    desc: "初始 Prompt 让 DeepSeek 做「友好面试官」，结果追问毫无压力感。后来重写 Prompt 明确要求「像硅谷最严苛的面试官一样追问，直到候选人暴露知识边界」。",
                  },
                  {
                    title: "坑 2：Notion API 写入超时",
                    desc: "面试转录稿动辄上万字，Notion API 写入经常超时。解决方案：将转录稿分块写入，并实现重试机制。",
                  },
                  {
                    title: "坑 3：五维评分不一致",
                    desc: "同一回答在不同轮次评分差异大。引入评分锚定机制：每次评分前先让模型回顾历史评分标准，确保一致性。",
                  },
                ].map((pitfall) => (
                  <div
                    key={pitfall.title}
                    className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                  >
                    <div className="text-sm font-semibold text-amber-200">{pitfall.title}</div>
                    <div className="mt-1 text-sm text-slate-300">{pitfall.desc}</div>
                  </div>
                ))}
              </div>
            </SectionShell>

            {/* ========== R ========== */}
            <SectionShell id="r" title="R · 做出来怎么样" subtitle="Result">
              <SubAnchorTitle id="r-outcomes" title="产品成果" />
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {[
                  { metric: "3 天", label: "从想法到 MVP" },
                  { metric: "5 个", label: "评分维度" },
                  { metric: "2 个", label: "AI 模型协作" },
                ].map((m) => (
                  <div
                    key={m.metric}
                    className="rounded-xl border border-white/10 bg-black/20 p-4 text-center"
                  >
                    <div className="text-2xl font-bold text-cyan-200">{m.metric}</div>
                    <div className="mt-1 text-xs text-slate-400">{m.label}</div>
                  </div>
                ))}
              </div>

              <SubAnchorTitle id="r-feel" title="使用体感" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                实际使用中，InterviewOS 最让我惊喜的是高压追问的真实感。DeepSeek 在「严苛面试官」模式下，
                会针对回答中的逻辑漏洞连续追问 3-5 轮，直到你真正暴露知识边界。这种体验远超传统的题库背诵。
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                五维评分让每次面试都有了可量化的反馈。我可以清晰地看到自己在 Substance（内容深度）和
                Adaptability（应变能力）上的进步曲线。Notion 自动沉淀的数据让复盘变得极其高效。
              </p>

              <SubAnchorTitle id="r-screens" title="产品截图" />
              <div className="mt-3 space-y-4">
                <figure className={screenshotFrameClass}>
                  <Image
                    src={INTERVIEW_OS_IMG}
                    alt="InterviewOS 全链路 AI 面试教练界面"
                    width={1200}
                    height={600}
                    className="h-auto w-full object-contain"
                    sizes="(max-width: 1280px) 100vw, min(720px, 70vw)"
                  />
                </figure>
                <p className="text-xs text-slate-500">
                  InterviewOS 面试界面：左侧 JD 解码与简历对齐，右侧高压追问与五维评分
                </p>
              </div>

              <SubAnchorTitle id="r-metrics" title="指标设计" />
              <div className="mt-3">
                <TableCard title="核心指标">
                  <DarkTable
                    headers={["指标", "目标值", "当前值", "衡量方式"]}
                    rows={[
                      ["面试完成率", "> 80%", "85%", "开始面试后完成全部流程的比例"],
                      ["评分一致性", "> 85%", "82%", "同一回答多次评分的标准差"],
                      ["追问深度", "平均 3 轮", "3.2 轮", "每次追问的平均轮数"],
                      ["Notion 写入成功率", "> 99%", "99.5%", "面试报告成功写入 Notion 的比例"],
                      ["用户留存 (周)", "> 40%", "45%", "每周至少使用一次的用户比例"],
                    ]}
                  />
                </TableCard>
              </div>

              <SubAnchorTitle id="r-iterate" title="继续迭代" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                下一步计划：
              </p>
              <div className="mt-2 space-y-1 text-sm text-slate-300">
                {[
                  "增加语音输入支持，模拟真实面试的语音交互场景",
                  "引入更多面试类型（系统设计、行为面试、案例分析）",
                  "基于历史面试数据生成个性化复习计划",
                  "支持多人面试模拟（Panel Interview）",
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 shrink-0 text-cyan-400">→</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <SubAnchorTitle id="r-lessons" title="最大的教训" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                最大的教训是：不要低估 Prompt 工程在面试场景中的重要性。同样是 DeepSeek 模型，
                「友好面试官」和「严苛面试官」的 Prompt 差异会导致完全不同的用户体验。
                我花了大量时间迭代 Prompt，才找到「既保持压力感又不让用户感到被冒犯」的平衡点。
              </p>
            </SectionShell>

            {/* ========== 技术架构 ========== */}
            <SectionShell id="arch" title="技术架构" subtitle="Architecture">
              <SubAnchorTitle id="arch-table" title="技术架构一览" />
              <div className="mt-3">
                <TableCard title="技术栈">
                  <DarkTable
                    headers={["层级", "技术选型", "说明"]}
                    rows={[
                      ["前端框架", "Next.js (App Router)", "服务端渲染 + API Route"],
                      ["AI 模型", "DeepSeek + Gemini", "双模型分工协作"],
                      ["AI SDK", "Vercel AI SDK", "流式响应 + 工具调用"],
                      ["数据层", "Notion API", "双表：面试记录 + 故事库"],
                      ["部署", "Vercel", "自动部署 + Edge Functions"],
                      ["样式", "Tailwind CSS", "暗色太空主题"],
                    ]}
                  />
                </TableCard>
              </div>

              <div className="mt-4">
                <TableCard title="API 路由设计">
                  <DarkTable
                    headers={["路由", "方法", "功能"]}
                    rows={[
                      ["/api/interview", "POST", "启动面试会话"],
                      ["/api/interview/evaluate", "POST", "实时评分与追问"],
                      ["/api/interview/save-report", "POST", "保存面试报告到 Notion"],
                      ["/api/knowledge", "GET", "获取故事库列表"],
                      ["/api/knowledge/ingest", "POST", "导入故事素材"],
                    ]}
                  />
                </TableCard>
              </div>

              <SubAnchorTitle id="arch-closing" title="结语" />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                InterviewOS 是我在 AI 面试教练领域的一次深度实践。通过双模型分工、JD 解码引擎和五维评分体系，
                我构建了一个真正「有感知」的面试模拟系统。最让我自豪的是 Notion 原生闭环 ——
                面试数据不再是「阅后即焚」的聊天记录，而是可追踪、可复盘、可迭代的成长资产。
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                这个项目也让我深刻理解了 Prompt 工程在垂直场景中的关键作用 ——
                同样的模型，不同的 Prompt 设计可以带来天壤之别的用户体验。
              </p>
            </SectionShell>
          </div>
        </main>

        {/* ========== 右侧 TOC ========== */}
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            {TOC.map((section) => (
              <div key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="block text-xs font-medium text-slate-400 transition hover:text-cyan-300"
                >
                  {section.label}
                </a>
                {section.children && (
                  <div className="ml-3 mt-0.5 space-y-0.5">
                    {section.children.map((child) => (
                      <a
                        key={child.id}
                        href={`#${child.id}`}
                        className="block text-[11px] text-slate-600 transition hover:text-cyan-300"
                      >
                        {child.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </div>
  );
}
