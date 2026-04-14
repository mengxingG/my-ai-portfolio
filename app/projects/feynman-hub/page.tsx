import { MermaidFlowchartZoom } from "@/app/components/MermaidFlowchartZoom";
import { MermaidSimple } from "@/app/components/MermaidSimple";
import { FEYNMAN_LEARNING_DEMO_HREF } from "@/lib/feynman-demo-link";
import Image from "next/image";

const FEYNMAN_HUB_IMG = "/images/feynman-hub";

/** 截图统一：圆角 + 细边框 + 轻阴影 */
const screenshotFrameClass =
  "overflow-hidden rounded-2xl border border-white/12 bg-black/25 shadow-[0_12px_36px_rgba(0,0,0,0.38)]";

export const metadata = {
  title: "费曼学习工具 · Case Study",
  description:
    "费曼学习工具：NotebookLM 风格的双模态智能学习系统（费曼学习法 + AI 模拟面试 + 间隔复习）",
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
      { id: "a-1", label: "决策一：多模型分工" },
      { id: "a-2", label: "决策二：Prompt 即产品" },
      { id: "a-3", label: "决策三：Notion 数据层" },
      { id: "a-4", label: "决策四：ADHD 友好" },
      { id: "a-5", label: "决策五：主动砍掉" },
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

export default function FeynmanHubCaseStudyPage() {
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
                  费曼学习工具
                </h1>
                <p className="mt-2 text-sm text-slate-400">
                  类 NotebookLM 的双模态智能学习系统。融合费曼学习法 + AI 模拟面试 + 间隔复习，
                  专为 ADHD 友好设计，学习数据写回 Notion 知识库。
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    "Gemini 2.5",
                    "DeepSeek",
                    "Next.js",
                    "Notion API",
                    "Mermaid.js",
                    "Vercel AI SDK",
                  ].map((t) => (
                    <Pill key={t}>{t}</Pill>
                  ))}
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <a href={FEYNMAN_LEARNING_DEMO_HREF} className="glow-btn glow-btn--primary glow-btn--resume inline-flex">
                  体验 Demo →
                </a>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <figure className={screenshotFrameClass}>
                <Image
                  src={`${FEYNMAN_HUB_IMG}/learning-fullview.png`}
                  alt="费曼学习工具 学习页面：双栏布局与费曼对话"
                  width={1920}
                  height={1080}
                  className="h-auto w-full object-contain"
                  sizes="(max-width: 1024px) 100vw, min(896px, 50vw)"
                  priority
                />
                <figcaption className="sr-only">产品学习界面全貌</figcaption>
              </figure>

              <div className="holo-card rounded-2xl p-5 sm:p-6">
                <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
                  Quick nav
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-300">
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    一句话：让「学会」这件事可被验证，而不是靠自我感觉。
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <a
                      href="/projects/feynman-hub#s"
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
                    >
                      从痛点开始（S）→
                    </a>
                    <a
                      href="/projects/feynman-hub#a"
                      className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-200 transition hover:bg-white/[0.06]"
                    >
                      看关键决策（A）→
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="my-8 border-t border-white/10" />

          <div className="space-y-10">
            <SectionShell
              id="s"
              title="S · 我遇到了什么问题"
              subtitle="个人背景 + 竞品分析 + 机会判断"
            >
              <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="s-bg" title="个人背景" />
                  <p className="mt-2">
                    我做了 4 年 AI 产品经理，之前在公司负责金融风控 AI 系统——交易前合规检查、规则引擎、实时风险监控这些。
                    准备换工作的时候发现一个很尴尬的事情：我能设计复杂的风控产品，但面试时让我解释一个 AI 概念（比如 RAG 的工作原理），经常说到一半卡住。
                  </p>
                  <p className="mt-2">
                    不是不懂，是那种“看的时候觉得全懂了，嘴巴要说的时候才发现有很多模糊地带”的感觉。
                  </p>
                  <p className="mt-2">
                    每天最大的敌人不是“学不会”，而是“开始不了”。
                    打开学习资料这个动作本身就要消耗巨大的意志力，很多时候一天就这么过去了。
                  </p>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="s-tools" title="我试过的现有工具" />
                  <div className="mt-3">
                    <TableCard title="工具对比（我为什么不满足）">
                      <DarkTable
                        headers={["产品", "做得好的点", "我遇到的问题"]}
                        rows={[
                          [
                            <span key="p-nl" className="font-semibold text-slate-100">
                              NotebookLM
                            </span>,
                            "上传文档后总结与问答体验很好。",
                            "只做“输入”不做“输出”：不会反过来考你，容易造成“AI 讲得好 = 我懂了”的错觉。",
                          ],
                          [
                            <span key="p-fa" className="font-semibold text-slate-100">
                              Feynman AI（feynmanai.net）
                            </span>,
                            "让你用自己的话解释概念，再由 AI 打分，方向正确。",
                            "学完一轮就结束；没有复习提醒；数据不进 Notion；没有面试模拟（需要压力下也能讲清楚）。",
                          ],
                          [
                            <span key="p-st" className="font-semibold text-slate-100">
                              StudyTok AI、intellecs.ai
                            </span>,
                            "录音转笔记、闪卡、费曼测试等功能较全。",
                            "更像一次性练习工具：做完就结束，没有形成“学→考→复习”的循环。",
                          ],
                          [
                            <span key="p-an" className="font-semibold text-slate-100">
                              Anki
                            </span>,
                            "间隔复习机制非常强。",
                            "更适合记忆不适合理解；纯卡片模式对 ADHD 太枯燥，打开成本高、容易逃避。",
                          ],
                        ]}
                      />
                    </TableCard>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="s-opp" title="我看到的机会" />
                  <p className="mt-2">
                    不是说这些产品不好，而是它们各做了一段，没有人把整条链路串起来——尤其是“面试场景考核”，学习工具基本不碰，面试工具又不和学习过程挂钩。
                    还有一点：几乎没有产品认真考虑过 ADHD 的“启动困难”。
                  </p>
                  <pre className="mt-3 overflow-x-auto rounded-2xl border border-white/10 bg-black/30 p-4 text-xs text-slate-200">
{`上传资料 → AI 帮你理解 → 你用自己的话复述（费曼） → 面试场景压力测试
  → 精准评分找出知识盲点 → 间隔复习薄弱环节 → 数据沉淀到已有知识库`}
                  </pre>

                  <div className="mt-4">
                    <TableCard title="竞品对比矩阵（定位对比）">
                      <DarkTable
                        headers={[
                          "产品",
                          "费曼学习",
                          "面试模拟",
                          "间隔复习",
                          "知识库集成",
                          "ADHD 友好",
                        ]}
                        rows={[
                          [
                            "NotebookLM",
                            <span key="nl-f" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="nl-i" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="nl-s" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="nl-k" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="nl-a" className="text-slate-600">
                              ❌
                            </span>,
                          ],
                          [
                            "Feynman AI",
                            <span key="fa-f" className="text-cyan-200">
                              ✅
                            </span>,
                            <span key="fa-i" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="fa-s" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="fa-k" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="fa-a" className="text-slate-600">
                              ❌
                            </span>,
                          ],
                          [
                            "Anki",
                            <span key="an-f" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="an-i" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="an-s" className="text-cyan-200">
                              ✅
                            </span>,
                            <span key="an-k" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="an-a" className="text-slate-600">
                              ❌
                            </span>,
                          ],
                          [
                            "StudyTok AI",
                            <span key="st-f" className="text-cyan-200">
                              ✅
                            </span>,
                            <span key="st-i" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="st-s" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="st-k" className="text-slate-600">
                              ❌
                            </span>,
                            <span key="st-a" className="text-slate-600">
                              ❌
                            </span>,
                          ],
                          [
                            <span key="fh" className="font-semibold text-slate-50">
                              Feynman Hub
                            </span>,
                            <span key="fh-f" className="font-semibold text-cyan-200">
                              ✅
                            </span>,
                            <span key="fh-i" className="font-semibold text-cyan-200">
                              ✅
                            </span>,
                            <span key="fh-s" className="font-semibold text-cyan-200">
                              ✅
                            </span>,
                            <span key="fh-k" className="font-semibold text-cyan-200">
                              ✅
                            </span>,
                            <span key="fh-a" className="font-semibold text-cyan-200">
                              ✅
                            </span>,
                          ],
                        ]}
                      />
                      <div className="mt-2 rounded-xl border border-cyan-500/15 bg-cyan-500/5 px-3 py-2 text-xs text-slate-400">
                        ✅ 用青色强调，❌ 用暗灰色；最后一行高亮展示完整闭环能力。
                      </div>
                    </TableCard>
                  </div>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="s-features" title="产品核心特色" />
                  <p className="mt-2 text-sm text-slate-400">
                    把「读懂 → 讲清楚 → 被考住 → 接着学」串成一条线时的关键体验点。
                  </p>
                  <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_min(380px,42%)] lg:items-start">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          title: "大白话翻译 + 溯源标注",
                          body:
                            "AI 解析文档后不是给你一堆要点，而是先用大白话说「这篇文章到底在讲什么」，再列核心逻辑，每个观点都标注了原文出处，方便你回去查证。",
                        },
                        {
                          title: "双向跳转联动",
                          body:
                            "点击大纲章节标题或思维导图节点，右侧直接进入该知识点的费曼对话。不需要手动复制粘贴，学习流程是连贯的。",
                        },
                        {
                          title: "面试考核自动递增难度",
                          body:
                            "同一场面试从概念理解 → 逻辑分析 → 应用场景自动升级。答模糊了会追问，答错了会引导，不会直接给答案。",
                        },
                        {
                          title: "宠物伴侣系统",
                          body:
                            "不是花瓶。自动跟随学习状态计时，完成学习获得经验值升级，连续学习有火焰标记，断了不惩罚只说「欢迎回来」。",
                        },
                      ].map((c) => (
                        <div
                          key={c.title}
                          className="rounded-2xl border border-white/10 bg-black/25 p-4"
                        >
                          <div className="text-xs font-semibold text-cyan-200/90">{c.title}</div>
                          <p className="mt-2 text-sm leading-relaxed text-slate-300">{c.body}</p>
                        </div>
                      ))}
                    </div>
                    <figure className={`${screenshotFrameClass} shrink-0`}>
                      <Image
                        src={`${FEYNMAN_HUB_IMG}/ai-outlines.png`}
                        alt="AI 大纲、大白话翻译与溯源标注界面"
                        width={1200}
                        height={1600}
                        className="h-auto w-full object-contain"
                        sizes="(max-width: 1024px) 100vw, 380px"
                      />
                    </figure>
                  </div>
                </div>
              </div>
            </SectionShell>

            <SectionShell id="t" title="T · 我要做什么" subtitle="产品目标表格 + 约束条件">
              <div className="space-y-4 text-sm text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  一句话：<span className="font-semibold text-slate-100">让“学会”这件事可以被验证，而不是靠自我感觉。</span>
                </div>

                <TableCard title="产品目标（拆解）">
                  <div id="t-goals" className="scroll-mt-28" />
                  <DarkTable
                    headers={["目标", "说明"]}
                    rows={[
                      [
                        <span key="g1" className="font-semibold text-slate-100">
                          学习效果可量化
                        </span>,
                        "每个知识点有 0-100 掌握度评分；不是自评，而是 AI 基于你的表达质量打分。",
                      ],
                      [
                        <span key="g2" className="font-semibold text-slate-100">
                          学和考打通
                        </span>,
                        "费曼学习结束后可直接进面试模拟；面试暴露的盲点能回到学习环节补。",
                      ],
                      [
                        <span key="g3" className="font-semibold text-slate-100">
                          数据不孤立
                        </span>,
                        "所有学习记录写回 Notion，融入已有知识管理体系。",
                      ],
                      [
                        <span key="g4" className="font-semibold text-slate-100">
                          ADHD 能用
                        </span>,
                        "最低 5 分钟完成一次有效学习：不设目标、不做计划，点一个按钮就能开始。",
                      ],
                    ]}
                  />
                </TableCard>

                <TableCard title="给自己的约束（MVP 约束条件）">
                  <div id="t-constraints" className="scroll-mt-28" />
                  <DarkTable
                    headers={["约束", "含义"]}
                    rows={[
                      ["一人开发", "用 Cursor + Claude 辅助编码，目标两周出 MVP。"],
                      ["低成本", "个人项目不能烧钱，模型选型需考虑成本。"],
                      ["链路优先", "不追求功能多，追求核心链路跑通。"],
                    ]}
                  />
                </TableCard>

                <div className="mt-2">
                  <TableCard title="学习闭环流程图（从输入到复习）">
                    <MermaidFlowchartZoom>
                      <MermaidSimple
                        className="min-h-[200px] !border-0 !bg-transparent py-1 px-0 sm:py-2"
                        code={[
                        "---",
                        "config:",
                        "  theme: dark",
                        "  flowchart:",
                        "    useMaxWidth: false",
                        "    nodeSpacing: 80",
                        "    rankSpacing: 72",
                        "    padding: 28",
                        "  themeVariables:",
                        "    fontSize: 18px",
                        "---",
                        "flowchart LR",
                        "A[是否上传资料] --> B[AI 解析生成大纲]",
                        "B --> C[费曼学习对话]",
                        "C --> D[掌握度评分]",
                        "D -->|≥ 80 分| E[标记已掌握]",
                        "D -->|< 80 分| F[模拟面试考核]",
                        "F --> G[评分报告 + 知识盲点]",
                        "E --> H[写入 Notion]",
                        "G --> H[写入 Notion]",
                        "H --> I[间隔复习提醒]",
                      ].join("\n")}
                      />
                    </MermaidFlowchartZoom>
                  </TableCard>
                </div>
              </div>
            </SectionShell>

            <SectionShell
              id="a"
              title="A · 我做了哪些决策"
              subtitle="5 个决策：标题 + 对比/表格 + 解释"
            >
              <div className="grid gap-3">
                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4" open>
                  <summary id="a-1" className="cursor-pointer select-none scroll-mt-28 text-sm font-semibold text-slate-100">
                    决策一：多模型分工（速度/成本/准确率分层）
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p>
                      一开始想全用 GPT-4，算过账后不现实。最终按场景分配模型：快的跑实时、准的做评估。
                      这也来自风控经验：实时检测用轻量模型（快），事后审计用重模型（准）。
                    </p>
                    <TableCard title="模型架构图（前端 / API / 模型 / 数据）">
                      <MermaidSimple
                        code={[
                          "flowchart LR",
                          "UI[Next.js 前端\\n双栏学习界面] --> CHAT[/api/chat/]",
                          "UI --> INT[/api/interview/]",
                          "INT --> EVAL[/api/interview/evaluate/]",
                          "CHAT --> G1[Gemini 2.5 Flash\\n费曼对话 · 文档解析]",
                          "EVAL --> D1[DeepSeek Chat\\n面试考核 · 评分报告]",
                          "UI --> N1[Notion 知识输入库]",
                          "CHAT --> N2[Notion 学习会话库]",
                          "EVAL --> N2",
                        ].join("\n")}
                      />
                    </TableCard>
                    <TableCard title="模型分工（按场景选型）">
                      <DarkTable
                        headers={["场景", "模型", "为什么选它"]}
                        rows={[
                          [
                            "文档解析 + 费曼对话",
                            <span key="m1" className="font-semibold text-slate-100">
                              Gemini 2.5 Flash
                            </span>,
                            "上下文窗口大、速度快、免费额度够个人用。",
                          ],
                          [
                            "面试考核 + 评分报告",
                            <span key="m2" className="font-semibold text-slate-100">
                              DeepSeek Chat
                            </span>,
                            "推理与判断力更强、成本低；面试对延迟容忍更高。",
                          ],
                        ]}
                      />
                    </TableCard>
                  </div>
                </details>

                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <summary id="a-2" className="cursor-pointer select-none scroll-mt-28 text-sm font-semibold text-slate-100">
                    决策二：Prompt 设计是产品设计（费曼 5 轮框架 + 面试官更像真人）
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p>
                      费曼对话 prompt 迭代了十几版：最初“你是老师用费曼技巧教我”会让 AI 自己讲得很清楚，
                      用户变成被动听讲。后来固定为 5 轮框架，把主动思考与复述强制嵌入对话流程。
                    </p>
                    <TableCard title="费曼 5 轮流程图（纵向时间线）">
                      <StepTimeline
                        steps={[
                          {
                            title: "第 1 轮 · 建立基础",
                            desc: "生活化比喻 + 了解用户水平",
                          },
                          {
                            title: "第 2 轮 · 发现缺口",
                            desc: "3-5 个问题覆盖：是什么 / 为什么 / 边界 / 区别",
                          },
                          { title: "第 3 轮 · 迭代改进", desc: "逐步加深，每次多一个维度" },
                          {
                            title: "第 4 轮 · 检验理解",
                            desc: "真实场景：解释给不懂的朋友",
                          },
                          {
                            title: "第 5 轮 · 教学概要",
                            desc: "核心概念 / 最佳类比 / 关键原理 / 常见误解",
                          },
                        ]}
                      />
                    </TableCard>
                    <TableCard title="费曼对话 · 5 轮框架">
                      <DarkTable
                        headers={["轮次", "做什么", "关键点"]}
                        rows={[
                          ["1. 建立基础", "生活化比喻 + 询问现有理解", "初步解释阶段避免专业术语。"],
                          ["2. 发现缺口", "连续 3-5 个问题覆盖关键维度", "要求用自己的话回答，不能背书。"],
                          ["3. 迭代改进", "根据回答逐步加深", "每次多一个维度。"],
                          ["4. 检验理解", "真实场景：讲给完全不懂的朋友", "把理解落到表达与类比。"],
                          ["5. 生成教学概要", "提炼核心概念/最佳类比/关键原理/常见误解", "输出可沉淀到知识库。"],
                        ]}
                      />
                    </TableCard>
                    <p>
                      面试官 prompt 的关键规则：不要说“根据文档/资料显示”，而是像真人一样自然提问；
                      难度不让用户选，改为自动递增（概念 → 逻辑 → 应用），避免“永远选基础”。
                    </p>
                  </div>
                </details>

                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <summary id="a-3" className="cursor-pointer select-none scroll-mt-28 text-sm font-semibold text-slate-100">
                    决策三：用 Notion 当数据层（换来“生态融合”，用工程妥协处理性能）
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p>
                      Notion API 慢、弱、还限流（约 3 req/s），但用户画像（我自己和身边 PM）本来就把知识体系放在 Notion。
                      如果自建数据库，学习记录会被锁在产品里，与既有笔记体系割裂。
                    </p>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="text-xs font-mono text-slate-500">针对 Notion 的妥协</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        <li>面试过程数据暂存前端 state，结束后一次性批量写入。</li>
                        <li>写入串行执行（不 `Promise.all`），遵守 rate limit。</li>
                        <li>Dashboard 统计在前端聚合计算，不指望 Notion 做聚合。</li>
                      </ul>
                    </div>
                    <p className="text-slate-400">
                      如果未来有几千人用，再换数据层；现在过度设计只会拖慢交付。
                    </p>
                  </div>
                </details>

                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <summary id="a-4" className="cursor-pointer select-none scroll-mt-28 text-sm font-semibold text-slate-100">
                    决策四：ADHD 友好设计（和“常识”反着来）
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <p>
                      目标不是“让用户更自律”，而是把启动摩擦降到最低：5 分钟可完成一次有效学习，且只奖励不惩罚。
                    </p>
                    <TableCard title="ADHD 友好设计原则（对照表）">
                      <DarkTable
                        headers={["常规做法", "我的做法", "为什么"]}
                        rows={[
                          ["番茄钟 25 分钟倒计时", "正计时：显示已学多久", "倒计时制造压力；正计时制造成就感。"],
                          ["设定今日学习目标", "只学 5 分钟按钮", "ADHD 最难是启动，不是坚持。"],
                          ["断更扣分/降级", "断了只说欢迎回来", "避免额外内疚感。"],
                          ["详细计划表", "打开就看到薄弱点", "让数据替你做计划。"],
                        ]}
                      />
                    </TableCard>
                  </div>
                </details>

                <details className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <summary id="a-5" className="cursor-pointer select-none scroll-mt-28 text-sm font-semibold text-slate-100">
                    决策五：主动砍掉的功能（宁可三件事做扎实）
                  </summary>
                  <div className="mt-4 space-y-3 text-sm text-slate-300">
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="font-semibold text-slate-100">情绪检测（语音分析认知负荷）</div>
                      <div className="mt-1 text-slate-300">
                        原理可行但准确率难自证，做成半成品会更扣分。
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="font-semibold text-slate-100">SM-2 间隔复习算法</div>
                      <div className="mt-1 text-slate-300">
                        需要大量数据才能收敛；当前数据量小，用简化版更稳定。
                      </div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3">
                      <div className="font-semibold text-slate-100">多用户社交功能</div>
                      <div className="mt-1 text-slate-300">
                        一个人都没用好之前就做社交，是“解决方案先于问题”。
                      </div>
                    </div>
                  </div>
                </details>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                  <SubAnchorTitle id="a-pitfalls" title="开发过程中的真实踩坑" />
                  <p className="mt-2 text-sm text-slate-400">
                    默认收起，点击展开。都是真问题上手才遇得到的细节。
                  </p>
                  <div className="mt-4 space-y-2">
                    <details className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
                        ▸ PDF 过大导致解析超时
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        大 PDF（上万字）传给 Gemini 经常超时。表格和图片的解析质量也不稳定——PDF
                        里嵌的表格经常被识别成乱码。最后的方案是对长文档做分块处理，复杂表格走视觉模型解析。这让我意识到「上传
                        PDF 一键解析」这个看起来简单的功能，背后有大量的边界情况要处理。
                      </p>
                    </details>
                    <details className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
                        ▸ 面试官 AI 太好说话，没有考核价值
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        第一版面试官无论用户回答什么都说「理解到位」。原因是 prompt
                        没有设定评价标准。我迭代了三版 prompt，加了评价梯度（优秀 / 及格 / 较差 / 错误）和追问机制。这个经历让我理解了一件事：AI
                        产品的体验质量，80% 取决于 prompt 设计，不是模型能力。
                      </p>
                    </details>
                    <details className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
                        ▸ 面试问的内容和文档完全对不上
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        有一次面试官在问「进程和线程」，但文档是关于 AGI
                        的。查了半天发现是前端没把文档内容传给面试 API——典型的「功能看起来做完了但其实是断的」。这也是为什么我后来给每个功能都加了调试日志。
                      </p>
                    </details>
                    <details className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
                        ▸ Notion API 的性能和限制
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        本地开发时 Notion API
                        频繁超时，排查后发现是翻墙代理干扰了请求。还有 rate limit（每秒 3 请求）和 rich_text 2000
                        字符限制的问题。这些都是文档上写了但你不踩一遍不会真正注意到的东西。
                      </p>
                    </details>
                    <details className="rounded-xl border border-white/10 bg-black/20 px-4 py-2">
                      <summary className="cursor-pointer select-none text-sm font-semibold text-slate-100">
                        ▸ 语音转文字试了三种方案都不理想
                      </summary>
                      <p className="mt-3 text-sm leading-relaxed text-slate-300">
                        先用 Gemini 转写（太慢，9 个字要 30 秒），再试 Web Speech API（大陆网络连不上
                        Google 服务），最后发现最好的方案是直接用系统输入法的语音功能。有时候最简单的方案就是最好的方案。
                      </p>
                    </details>
                  </div>
                </div>
              </div>
            </SectionShell>

            <SectionShell
              id="r"
              title="R · 做出来怎么样"
              subtitle="成果 + 体感 + 指标设计表格 + 迭代方向 + 教训"
            >
              <div className="space-y-6 text-sm leading-relaxed text-slate-300">
                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="r-outcomes" title="产品成果" />
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    <li>一周时间（Cursor + Claude 辅助）从零做出可用系统。</li>
                    <li>6 个 API 路由，双模型协作（Gemini + DeepSeek）。</li>
                    <li>费曼学习：文档解析 → AI 对话 → 5 轮框架 → 掌握度评分 → 费曼笔记 → 写入 Notion。</li>
                    <li>模拟面试：配置 → 递增难度 → 追问机制 → 评分报告 → 知识盲点 → 写入 Notion。</li>
                    <li>Dashboard：学习热力图 + 掌握度雷达图 + 艾宾浩斯复习提醒。</li>
                    <li>左右面板联动：点击大纲/思维导图节点直接进入费曼对话。</li>
                    <li>ADHD 友好：只学 5 分钟入口 + 宠物伴侣系统 + 只奖励不惩罚。</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="r-feel" title="使用体感" />
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    <li>以前看完文章就觉得“懂了”，现在会主动进费曼模式讲一遍，常常讲到一半发现没懂。</li>
                    <li>面试模拟几轮后，掌握度从 30-40 分提升到 70-80 分左右，表达更稳定。</li>
                    <li>“只学 5 分钟”用得最多：本来只想 5 分钟，进入状态后常常变成半小时。</li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="r-screens" title="产品截图" />
                  <p className="mt-2 text-sm text-slate-400">
                    学习界面、解析能力、面试报告与 Dashboard 数据一览。
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        {
                          label: "截图一",
                          caption: "学习页面全貌（双栏布局 + 费曼对话）",
                          file: "learning-fullview.png",
                          alt: "学习页面全貌：双栏布局与费曼对话",
                          w: 1920,
                          h: 1080,
                        },
                        {
                          label: "截图二",
                          caption: "AI 大纲 + 大白话翻译 + 溯源标注",
                          file: "ai-outlines.png",
                          alt: "AI 大纲、大白话翻译与溯源标注",
                          w: 1200,
                          h: 1600,
                        },
                        {
                          label: "截图三",
                          caption: "面试评分报告",
                          file: "interview-report.png",
                          alt: "模拟面试评分报告界面",
                          w: 1200,
                          h: 900,
                        },
                        {
                          label: "截图四",
                          caption: "Dashboard（热力图 + 雷达图 + 复习提醒）",
                          file: "dashboard.png",
                          alt: "学习 Dashboard：热力图、雷达图与复习提醒",
                          w: 1400,
                          h: 900,
                        },
                      ] as const
                    ).map((shot) => (
                      <figure key={shot.file} className={screenshotFrameClass}>
                        <Image
                          src={`${FEYNMAN_HUB_IMG}/${shot.file}`}
                          alt={shot.alt}
                          width={shot.w}
                          height={shot.h}
                          className="h-auto w-full object-contain"
                          sizes="(max-width: 640px) 100vw, 50vw"
                        />
                        <figcaption className="border-t border-white/10 bg-white/[0.03] px-3 py-2 text-left text-xs text-slate-400">
                          <span className="font-mono font-semibold text-cyan-200/80">
                            {shot.label}
                          </span>
                          ：{shot.caption}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </div>

                <TableCard title="如果有 10 万用户，我会看什么指标（指标设计）">
                  <div id="r-metrics" className="scroll-mt-28" />
                  <DarkTable
                    headers={["指标", "怎么算", "为什么重要", "目标"]}
                    rows={[
                      [
                        <span key="k1" className="font-semibold text-slate-100">
                          周活跃学习天数（北极星）
                        </span>,
                        "每周有学习记录的天数",
                        "学习类不必天天打开，但要持续；比 DAU 更贴近学习场景。",
                        <span key="t1" className="font-semibold text-cyan-200">
                          ≥ 3 天/周
                        </span>,
                      ],
                      ["启动转化率", "打开产品 → 开始第一次对话", "衡量启动门槛是否够低。", "> 60%"],
                      ["学习完成率", "开始费曼 → 拿到掌握度评分", "衡量体验是否顺畅，中途放弃是否多。", "> 40%"],
                      ["学→考转化率", "完成费曼 → 进入面试考核", "衡量闭环是否形成。", "> 30%"],
                      ["复习回访率", "收到复习提醒 → 回来复习", "衡量间隔复习机制是否有效。", "> 25%"],
                    ]}
                  />
                </TableCard>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="r-iterate" title="如果继续迭代" />
                  <ul className="mt-3 list-disc space-y-1 pl-5">
                    <li>
                      <span className="font-semibold text-slate-100">最想做的：</span>
                      面试答错的知识点自动加入费曼复习队列（把学→考→复习闭环真正闭上）。
                    </li>
                    <li>
                      <span className="font-semibold text-slate-100">需要数据验证的：</span>
                      AI PM 专项题库（可沉淀成垂直壁垒）。
                    </li>
                    <li>
                      <span className="font-semibold text-slate-100">时机不对的：</span>
                      认知负荷自适应（需要足够用户数据校准）。
                    </li>
                    <li>
                      <span className="font-semibold text-slate-100">不会做的：</span>
                      通用学习平台（差异化在 PM 垂直场景 + Notion 生态 + 面试闭环）。
                    </li>
                  </ul>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                  <SubAnchorTitle id="r-lessons" title="回头看，最大的教训" />
                  <ol className="mt-3 list-decimal space-y-1 pl-5">
                    <li>几乎没有真正空白市场，关键是你对现有方案的不满具体在哪里，以及你为什么不一样。</li>
                    <li>砍功能比加功能难：宁可把三个核心功能做扎实，也不要十个半吊子。</li>
                    <li>用自己当第一个用户：创始人就是目标用户的项目，迭代速度最快。</li>
                  </ol>
                </div>
              </div>
            </SectionShell>

            <SectionShell id="arch" title="技术架构" subtitle="架构表格 + 结语">
              <div className="space-y-3">
                <div id="arch-table" className="scroll-mt-28" />
                <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
                  <div className="text-xs font-mono font-semibold text-cyan-200/90">
                    技术栈分层图
                  </div>
                  <div className="mt-3 overflow-hidden rounded-2xl border border-white/10">
                    <div className="px-4 py-4 bg-white/[0.04]">
                      <div className="text-xs font-mono font-semibold text-cyan-200/90">前端</div>
                      <div className="mt-1 text-sm text-slate-200">
                        Next.js + Tailwind + Mermaid
                      </div>
                    </div>
                    <div className="border-t border-white/10 px-4 py-4 bg-white/[0.03]">
                      <div className="text-xs font-mono font-semibold text-cyan-200/90">AI</div>
                      <div className="mt-1 text-sm text-slate-200">
                        Gemini Flash + DeepSeek Chat
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Vercel AI SDK (streaming)
                      </div>
                    </div>
                    <div className="border-t border-white/10 px-4 py-4 bg-white/[0.02]">
                      <div className="text-xs font-mono font-semibold text-cyan-200/90">数据</div>
                      <div className="mt-1 text-sm text-slate-200">
                        Notion API · Vercel 部署
                      </div>
                    </div>
                  </div>
                </div>

                <div id="arch-closing" className="scroll-mt-28 rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                  <p>
                    这个项目是我用 Cursor + Claude 一周做出来的。不是为了证明我会写代码，在解决个人需求的同时，也想证明一个 AI PM
                    可以从洞察到交付独立完成一个产品——包括需求分析、竞品调研、技术选型、prompt 设计、数据架构、和用户体验设计。
                  </p>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <a href={FEYNMAN_LEARNING_DEMO_HREF} className="glow-btn glow-btn--primary glow-btn--resume inline-flex">
                    体验 Demo →
                  </a>
                  <a href="/projects/featured" className="glow-btn glow-btn--secondary inline-flex">
                    ← 返回项目库
                  </a>
                </div>
              </div>
            </SectionShell>
          </div>
        </main>

        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <div className="liquid-glass-card rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="text-xs font-mono uppercase tracking-[0.2em] text-slate-500">
                Contents
              </div>
              <nav className="mt-3 space-y-1">
                {TOC.map((t) => (
                  <div key={t.id} className="space-y-1">
                    <a
                      href={`#${t.id}`}
                      className="block rounded-xl border border-transparent px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-white/10 hover:bg-white/[0.04] hover:text-cyan-200"
                    >
                      {t.label}
                    </a>
                    {t.children?.length ? (
                      <div className="ml-2 space-y-1 border-l border-white/10 pl-2">
                        {t.children.map((c) => (
                          <a
                            key={c.id}
                            href={`#${c.id}`}
                            className="block rounded-lg px-3 py-1.5 text-[12px] text-slate-400 transition hover:bg-white/[0.04] hover:text-cyan-200"
                          >
                            {c.label}
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

