import { ProjectDetailActions } from "@/components/projects/ProjectDetailActions";
import { ProjectDetailHeader } from "@/components/projects/ProjectDetailProse";
import { ProjectOverviewImageRow } from "@/components/projects/ProjectOverviewImageRow";
import { ProjectPrdArchitectureDiagram } from "@/components/projects/ProjectPrdArchitectureDiagram";
import {
  PrdCallout,
  PrdList,
  PrdParagraph,
  PrdSection,
  PrdSubheading,
  PrdTable,
  ProjectPrdShell,
} from "@/components/projects/ProjectPrdLayout";
import { INTERVIEW_OS_PRD_NAV } from "@/lib/featured-project-prd-nav";
import { getFeaturedProjectById } from "@/lib/featured-projects";
import { INTERVIEW_OS_ARCHITECTURE } from "@/lib/project-prd-diagrams";

const project = getFeaturedProjectById("interview-os")!;

export const metadata = {
  title: "InterviewOS · 产品 PRD",
  description:
    "全链路 AI 面试教练：JD 解码、故事库对齐、模拟面试与高压追问、五维评分与 Notion 复盘。",
};

export default function InterviewOSProjectPage() {
  return (
    <ProjectPrdShell nav={INTERVIEW_OS_PRD_NAV}>
      <div id="top" className="scroll-mt-24 space-y-6">
        <ProjectDetailHeader
          kicker="AI 产品 PRD"
          title={project.title}
          description="全链路 AI 职业备战 OS：作战中枢 + 四阶段流水线（资产沉淀 → 精准投递 → 面试攻坚 → 复盘转化），15+ 子模块与 Notion 活文档双向同步。按场景选用 Qwen 3.7 Max（简历）、Claude Sonnet 4.6（模拟面试）、DeepSeek V4-Pro（练习刷题）。"
        >
          <ProjectDetailActions
            startHref={project.startHref}
            startExternal={project.startExternal}
          />
        </ProjectDetailHeader>

        <section aria-label="产品总览">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90">
            产品总览
          </p>
          <ProjectOverviewImageRow
            size="full"
            images={[
              {
                src: "/image/interview-prep.png",
                alt: "InterviewOS 全局 Dashboard",
                caption: "全局 Dashboard",
              },
            ]}
          />
        </section>
      </div>

      <PrdSection id="overview" title="一、产品概述">
        <PrdSubheading>业务背景</PrdSubheading>
        <PrdParagraph>{project.star.situation}</PrdParagraph>
        <PrdSubheading>产品目标</PrdSubheading>
        <PrdParagraph>{project.star.task}</PrdParagraph>
        <PrdCallout id="ai-boundary" title="AI 能力边界（AI 产品 PRD 必填）">
          <PrdList
            items={[
              "能做：15+ 模块覆盖定位→故事→JD→简历→Prep→Mock→Warmup→Debrief；五维评分与 Notion 活文档同步；作战中枢进度聚合与行动建议。",
              "不能做：不保证录用；不替代 HR/业务负责人主观判断；Copilot 仍须用户校验 [推演] 与事实红线。",
              "三模型分工（目标架构）：Qwen 3.7 Max 简历/JD 中文润色；Claude Sonnet 4.6 模拟面试与结构化反馈；DeepSeek V4-Pro 日常练习/刷题（不用 Flash）。",
              "输出：JSON Schema 约束评分、解码、复盘字段；长报告分章流式降低等待焦虑。",
            ]}
          />
        </PrdCallout>
      </PrdSection>

      <PrdSection id="features" title="二、功能定义">
        <PrdSubheading>产品架构：作战中枢 + 四阶段流水线</PrdSubheading>
        <PrdParagraph>
          左侧导航按求职生命周期组织：总览 Dashboard 聚合全站进度；阶段一至四覆盖从「简历与故事资产」到「投递定制」再到「面考前中后」再到「复盘谈薪」。各模块共享 Notion
          page_id，避免重复建页；作战中枢根据进度 API 自动生成「待完成」红点与行动建议（如故事&lt;5、模拟面试=0、有面试未复盘）。
        </PrdParagraph>

        <PrdSubheading>全局控制 · 作战中枢（/）</PrdSubheading>
        <PrdTable
          headers={["Tab / 路由", "功能", "说明"]}
          rows={[
            [
              "作战中枢（默认）",
              "Dashboard 指挥台",
              "聚合故事数/强故事数、题库练习、JD 解码、Prep 次数、模拟面试、知识复习、五维最近一次雷达；按优先级推送「今日行动」并可一键跳转对应模块",
            ],
            [
              "历史记录 ?tab=history",
              "全模块产出时间线",
              "按模块回看最近 7 天沉淀，避免高质量输出散落在 localStorage 或未归档会话",
            ],
            [
              "面试日程 ?tab=schedule",
              "日程与倒计时",
              "统一管理公司/岗位/面试时间；联动 UpcomingInterviewFocus，建议 T-24h 跑 Prep、T-5min 跑热身",
            ],
          ]}
        />

        <PrdSubheading>阶段一：资产沉淀</PrdSubheading>
        <PrdTable
          headers={["菜单", "路由", "核心功能", "用户价值"]}
          rows={[
            [
              "简历底本管理",
              "/base-resumes",
              "Notion 多版本简历底本 CRUD；标记 isActive 供定位/简历优化/Prep 引用",
              "一次维护、全站复用，避免每个 JD 从零粘贴",
            ],
            [
              "求职定位",
              "/positioning",
              "输入现职/目标岗/转型故事 → 输出公司匹配、优势、面试官顾虑、策略与中英文 Elevator Pitch",
              "面试前先定「人设与叙事主线」，后续模块可对齐同一 positioning",
            ],
            [
              "故事库",
              "/stories",
              "STAR 故事管理；创造者模式（Copilot 事实锚定扩写、量化补全、90 秒口述版）；防御者模式（Staff Engineer / DS Lead / 跨部门主管等多 persona 连环追问 → 结构化 Q&A 闪卡）；一键 sync 至 Notion（Quote / Callout / Toggle 块）",
              "把碎片化经历变成可复用「弹药库」，且守住事实红线",
            ],
          ]}
        />

        <PrdSubheading>阶段二：精准投递</PrdSubheading>
        <PrdTable
          headers={["菜单", "路由", "核心功能", "用户价值"]}
          rows={[
            [
              "岗位分析",
              "/job-analysis",
              "三 Tab：①岗前调研（公司/业务/竞品摘要）② JD 解码（职责/隐含期望/匹配分/差距）③岗位监控（Kanban：新发现→已投递，可对接 Job Engine 岗位库）",
              "投递前搞清「招什么人、差在哪」，投递后可视化管理漏斗",
            ],
            [
              "简历优化",
              "/resume",
              "绑定目标 JD + 激活底本 → ATS 友好度、关键词匹配、Differentiation 叙事建议；可生成 JD 定制版简历",
              "通用简历快速变「定制化敲门砖」",
            ],
            [
              "求职沟通",
              "/communication",
              "档案优化 Tab（LinkedIn 等）+ 话术生成 Tab（Networking 破冰/跟进/内推请求等场景脚本）",
              "站外触达与站内备战同一数据上下文",
            ],
          ]}
        />

        <PrdSubheading>阶段三：面试攻坚</PrdSubheading>
        <PrdTable
          headers={["菜单", "路由", "核心功能", "用户价值"]}
          rows={[
            [
              "面试题库",
              "/question-bank",
              "高频题维护、按公司/标签筛选、练习回写五维 1–5 分；与 Mock Evaluate 同一 rubric",
              "日常刷题、积累面经，分数可跨模块对比",
            ],
            [
              "知识训练",
              "/train",
              "SM-2 间隔复习卡片；今日到期队列 + 自评 0–5 调整下次复习；概念库可 AI 生成",
              "费曼式扫盲 RAG/架构等硬知识，对抗「看过即忘」",
            ],
            [
              "面试备战 Prep",
              "/prep",
              "基于真实 JD + 调研摘要 + 故事库 → 万字级战略报告（面试形式/文化判断/面试官画像/顾虑与 counter/预测题/故事映射/反向提问/当天 checklist）；含自我介绍逐字稿",
              "面考前 1–2 天的「知己知彼」战报，非临时搜资料",
            ],
            [
              "模拟面试 Mock",
              "/mock",
              "模式 A 全真四轮：产品思维 → 技术架构 → 执行指标 → 行为领导；模式 B Quick 单轮；模式 C 训练闯关 8 阶段（ladder/pushback/pivot…stress）；Focus 计时；场次归档 Notion + 五维雷达",
              "还原压迫感与时间限制，形成肌肉记忆",
            ],
            [
              "考前热身 Warm-up",
              "/warm-up",
              "读取 Prep 备战记录 → 生成 60 秒高光回放、3×3（必落地要点/高频预测题）、失误恢复手册、Focus Cue",
              "面试前 5–10 分钟结构化抓手，防临场空白",
            ],
          ]}
        />

        <PrdSubheading>阶段四：复盘转化</PrdSubheading>
        <PrdTable
          headers={["菜单", "路由", "核心功能", "用户价值"]}
          rows={[
            [
              "面试复盘 Debrief",
              "/debrief",
              "录入或导入真实面试实录 → AI 结构化复盘（Bad Case 归因、主瓶颈维度、改进清单）；汇总五维平均与逐题得分",
              "让每次真面试成为下一次的垫脚石",
            ],
            [
              "薪资谈判",
              "/negotiation",
              "输入 offer/竞对/地点 → 市场区间、谈判策略、邮件/电话/会议脚本、非薪酬谈判点",
              "收口阶段利益最大化",
            ],
            [
              "成长进度",
              "/progress",
              "五维评分趋势折线、知识掌握度、投递/模拟场次统计；与 Dashboard progress API 同源",
              "长期追踪能力曲线，而非一次性对话",
            ],
          ]}
        />

        <PrdSubheading>用户主路径（E2E）</PrdSubheading>
        <PrdParagraph>{project.flow.replace(/🌟\s*/g, "")}</PrdParagraph>
        <PrdList
          items={[
            "推荐节奏：定位 + 故事库（≥5 条）→ 岗位分析解码 → 简历优化 → Prep → Mock/题库日常 → 日程临近 Warm-up → 真面试 Debrief → Progress 看趋势",
            project.star.action,
            project.star.result,
          ]}
        />

        <ProjectOverviewImageRow
          size="full"
          layout="stack"
          images={[
            {
              src: "/images/interview-os/story.png",
              alt: "InterviewOS 故事库 Copilot 与深度拷问",
              caption: "阶段一 · 故事库（Copilot + 防御者模式）",
            },
            {
              src: "/images/interview-os/target.png",
              alt: "InterviewOS JD 解码与岗位分析",
              caption: "阶段二 · 岗位分析 & 简历/JD 对齐",
            },
            {
              src: "/images/interview-os/interview.png",
              alt: "InterviewOS 模拟面试 Prep",
              caption: "阶段三 · 面试备战 & 模拟面试",
            },
          ]}
        />

        <PrdSubheading>边界与容错</PrdSubheading>
        <PrdTable
          headers={["边界类型", "规则 / 触发", "产品处理"]}
          rows={[
            [
              "事实锚定（Copilot）",
              "故事优化禁止编造公司/项目/数字；推演须标 [推演]",
              "Prompt 三级权限（🔴硬事实 / 🟡推演 / 🟢表达）；输出前静默自检；用户确认后才去标",
            ],
            [
              "AI 能力边界",
              "不保证录用；不替代 HR 主观判断",
              "产品定位「教练与资产 OS」，评分与建议供自检而非裁决",
            ],
            [
              "数据一致性",
              "同一 JD/故事重复同步",
              "Notion 隐式 page_id 双向绑定；resume-bases 激活态单选；Prep/Warmup 读已存备战记录",
            ],
            [
              "模块隔离",
              "Mock 全真 vs 单题训练 vs 题库练习",
              "三种模式分轨：full-loop 四轮 / practice 八阶段闯关 / question-bank 独立计分，避免混用 UI",
            ],
            [
              "进度与提醒",
              "Sidebar 调用 /api/notion/progress",
              "故事少于 5 条、JD 未解码、模拟=0、有面试未复盘等链级 hint；Dashboard 行动项可 dismiss",
            ],
            [
              "会话中断",
              "Mock/Chat 中途关闭",
              "localStorage 草稿（Prep/Negotiation 等）；Mock 报告归档 API；practice round 增量保存",
            ],
            [
              "解析失败",
              "JD 解码 JSON 破裂 / 长文截断",
              "extractStructuredJsonBlock + section 兜底解析；decode 页展示 parse debug",
            ],
            [
              "模型与密钥",
              "API 失败 / 超时",
              "Route 侧统一鉴权；各页可选 ModelType（fast/deepseek-pro/deep/pro）；Toast 显式错误，不静默失败",
            ],
            [
              "外部依赖",
              "Notion 未授权 / Job 监控无数据",
              "模块级错误文案 + 降级空态；岗位监控 Kanban 可演示 Mock，生产读 Notion/Job Engine",
            ],
            [
              "日程联动",
              "未排期却点 Warm-up",
              "Warm-up 需先选 Prep 归档记录；Schedule Tab 引导 T-24h / T-5min 动作",
            ],
          ]}
        />
      </PrdSection>

      <PrdSection id="metrics" title="三、效果展示">
        <PrdSubheading>量化指标与验收</PrdSubheading>
        <PrdTable
          headers={["指标域", "具体指标", "验收 / 数据来源"]}
          rows={[
            [
              "作战中枢",
              "故事总数 / 强故事数、题库已练、JD 已解码、Prep 次数、模拟场次、今日复习知识卡片",
              "/api/notion/progress → dashboard 字段；Sidebar 与 CommandCenter 同源",
            ],
            [
              "五维评分",
              "Substance 表达力、Structure 结构性、Relevance 相关性、Credibility 可信度、Differentiation 差异化（1–5）",
              "Mock / 题库练习 / Debrief / Evaluate 共用 evaluate prompt；雷达图 ScoreRadar 组件",
            ],
            [
              "模拟闯关",
              "8 阶段训练 gate（如 Structure≥3 连续 3 轮、五维均≥3 进 stress）",
              "lib/practice.ts PRACTICE_STAGES；Mock practice 模式进度 localStorage",
            ],
            [
              "自我介绍",
              "30 秒 / 1 分钟 / 3 分钟口述稿（Prep + 定位 Pitch）",
              "Prep selfIntroScript；Positioning elevator_pitch_zh/en",
            ],
            [
              "知识记忆",
              "SM-2 interval / easeFactor / nextReviewDate；今日到期卡片数",
              "train + TodayReviewPlan；掌握度写入 Notion knowledge DB",
            ],
            [
              "投递漏斗",
              "岗位状态 Kanban：新发现→已查看→已解码→已投递→已放弃",
              "job-analysis monitor Tab；matchScore / fitScore 来自 JD 解码",
            ],
            [
              "复盘闭环",
              "Debrief 场次五维平均、primary_bottleneck_dimension、逐题 Q&A",
              "debrief analyze API → Notion；Progress 页趋势折线",
            ],
            [
              "工程",
              "Vercel 部署、API Route 鉴权、流式 SSE 章节/对话",
              "Next.js 15 App Router + Vercel AI SDK",
            ],
          ]}
        />

        <PrdSubheading id="data-requirements">数据要求（AI 产品 PRD 必填）</PrdSubheading>
        <PrdParagraph>
          InterviewOS 以 Notion 为 Headless CMS，localStorage 仅作草稿与 Tab 态；正式资产必须可追溯到 page_id。
        </PrdParagraph>
        <PrdTable
          headers={["类型", "内容"]}
          rows={[
            [
              "输入",
              "简历底本全文；STAR 故事原文；JD 文本/截图；定位表单；面试日程；真实面试实录；offer/薪资字段；LinkedIn 档案；题库题目与标签",
            ],
            [
              "输出 · 结构化",
              "JD 解码 JSON（职责/隐含期望/匹配分/差距）；Prep 战略报告多段数组；五维 scores + dimension_notes；Negotiation scripts；Hype 热身包三件套",
            ],
            [
              "输出 · Notion Block",
              "故事优化 Quote 标准版、Callout 90 秒口述、Toggle 拷问 Q&A；复盘 Markdown；JD 记录与 prep 关联字段",
            ],
            [
              "约束",
              "Copilot / 简历优化须事实锚定；JSON Schema 约束评分与 debrief；禁止前端暴露 API Key",
            ],
            [
              "非训练",
              "Prompt Engineering + 规则质检（如故事优化静默自检）；无 fine-tune 流水线",
            ],
          ]}
        />

        <PrdSubheading id="bad-cases">Bad Case 定义与处理（AI 产品 PRD 必填）</PrdSubheading>
        <PrdTable
          headers={["Bad Case", "触发条件", "处理策略"]}
          rows={[
            [
              "经历幻觉",
              "Copilot 编造项目/指标/职责",
              "Fact-Grounding 三级权限 + [推演] 标签 + 用户确认；stories prompt 静默自检五项",
            ],
            [
              "JSON 格式破裂",
              "模型返回非 Schema 评分/解码",
              "Vercel AI SDK + 固定 JSON 模板；evaluate/debrief/practice route 解析失败则提示重试",
            ],
            [
              "JD 与故事错配",
              "Mock 答非所问或 Relevance 低分",
              "Prep storyMapping 预绑定；Debrief 低 Relevance 强制解码「题目真正考察点」",
            ],
            [
              "长 JD 截断",
              "decode/analyze 超上下文",
              "smart-extract / smart-parse 预处理；Gemini 长文 + DeepSeek 结构化分工",
            ],
            [
              "场次中断",
              "Mock/Prep 编辑中刷新",
              "PREP_DRAFT / NEGOTIATION_DRAFT / practice history localStorage；Mock 报告 archive API",
            ],
            [
              "Notion 写入失败",
              "网络或权限错误",
              "前端 Toast + 保留本地副本；故事 sync 可重试；Dashboard 进度 API 失败则隐藏 hint 不崩溃",
            ],
            [
              "Warm-up 无上下文",
              "未跑 Prep 直接热身",
              "hype-records 空态引导先 Prep；需选择备战记录才生成 3×3",
            ],
            [
              "训练模式混淆",
              "用户不知 Mock 三种模式差异",
              "PageGuide + 模式 B 单题闯关明确 gate；Evaluate 子页专看历史场次雷达",
            ],
            [
              "进度误导",
              "仅刷题不沉淀故事",
              "Dashboard 行动项优先故事少于 5 条、JD 未解码；Sidebar 阶段待完成计数",
            ],
          ]}
        />
      </PrdSection>

      <PrdSection id="tech" title="四、技术选择">
        <PrdSubheading>模型选择</PrdSubheading>
        <PrdTable
          headers={["场景", "模型", "定价（入 / 出）", "选型理由"]}
          rows={[
            [
              "简历完善",
              "Qwen 3.7 Max",
              "$2.50 / $7.50",
              "中国最强旗舰档，中文表达最精准，阿里出品权威感足，适合简历/JD 对齐与 STAR 润色",
            ],
            [
              "模拟面试",
              "Claude Sonnet 4.6",
              "$3.00 / $15.00",
              "角色扮演最稳定、反馈最结构化，全球公认指令遵循最强，适合高压追问与五维评分",
            ],
            [
              "日常练习 / 刷题",
              "DeepSeek V4-Pro",
              "$0.435 / $0.87",
              "不用 Flash——重要练习用 Pro 更可靠，仍极便宜，适合高频短练与热身场次",
            ],
            ["数据", "Notion API", "—", "故事库、JD 记录、复盘报告"],
            ["部署", "Vercel", "—", "API Route 鉴权与限流"],
          ]}
        />
        <PrdSubheading>数据处理</PrdSubheading>
        <PrdParagraph>{project.technical}</PrdParagraph>
        <PrdSubheading>系统架构</PrdSubheading>
        <ProjectPrdArchitectureDiagram
          code={INTERVIEW_OS_ARCHITECTURE}
          caption="JD → 故事库 → 模拟面试 → 复盘 → 作战中枢"
        />
      </PrdSection>

      <PrdSection id="lessons" title="五、学到的经验">
        <PrdSubheading>产品层</PrdSubheading>
        <PrdList
          items={[
            "「作战中枢 + 四阶段」不是信息架构装饰：15+ 路由若缺少 Dashboard 聚合，用户会在 Prep/Mock/故事库之间迷失；行动建议 + Sidebar 红点是把 OS 从工具集变成教练的关键。",
            "JD 感知贯穿阶段二与三（解码 → 简历差异化 → Prep 故事映射 → Mock 绑定 JD），这是区别于通用 ChatGPT 陪聊的产品护城河。",
            "事实锚定 Copilot 是信任底线：PM 故事一旦幻觉，整站复盘数据失真；三级权限 + [推演] 标签比事后 disclaimer 更可执行。",
            "同一五维 rubric 贯通 Mock、题库、Debrief、Progress，用户才能看见「练了什么、弱在哪、有没有进步」。",
          ]}
        />
        <PrdSubheading>工程与 AI 层</PrdSubheading>
        <PrdList
          items={[
            "Notion 作 Living Database：Quote/Callout/Toggle 块类型对应不同消费场景（背诵/口述/深挖），比纯 Markdown 导出更贴近真实工作流。",
            "多模型按场景分流（简历中文表达 / 模拟面试角色扮演 / 练习成本）比单模型包办更可控；Route 级 ModelType 选择 + localStorage 记忆用户偏好。",
            "MergedPageTabs（Dashboard/岗位分析/求职沟通）减少路由碎片，但需 persistTab + 子页 PageGuide 降低「Tab 里还有 Tab」的认知成本。",
            "SM-2 知识训练与面试五维评分分离展示，避免用户误以为「复习分=面试分」——文案与 UI 都要写清数据来源。",
          ]}
        />
        <PrdSubheading>个人实战反馈</PrdSubheading>
        <PrdList
          items={[
            "高压追问 + 8 阶段闯关比背题库更接近真实 PM 面：Relevance/Credibility 低分往往比「不会答」更致命。",
            "Warm-up 3×3 是边际成本最低的体验杠杆：面考前 5 分钟比再跑一轮 Mock 更常决定开场状态。",
            "Debrief 写回 Notion 后，Progress 趋势才有意义——练习必须沉淀为资产，否则仍是消耗品。",
          ]}
        />
      </PrdSection>

      <PrdSection id="roadmap" title="六、将来迭代计划">
        <PrdTable
          headers={["方向", "内容", "优先级 / 备注"]}
          rows={[
            [
              "模型工程落地",
              "Portfolio PRD 已定义 Qwen 3.7 Max / Claude Sonnet 4.6 / DeepSeek V4-Pro 分工；代码层 llm.ts 仍为多 Gemini+DeepSeek 别名，需 Route 级映射与 fallback",
              "P0 · 与产品叙事对齐",
            ],
            [
              "语音闭环",
              "已有 /api/asr、/api/tts 雏形；Mock 全语音对练 + 口述自我介绍计时回放",
              "P1 · 移动端场景",
            ],
            [
              "岗位监控实盘",
              "job-analysis monitor Tab 已设计 Kanban；与 Job Engine Notion 岗位库实时同步，替换演示 Mock",
              "P1 · 与 Job Engine 联动",
            ],
            [
              "日程自动化",
              "Schedule → T-24h 自动提醒跑 Prep、T-30min 推送 Warm-up 链接、Debrief 待办",
              "P1 · 降低遗忘成本",
            ],
            [
              "JD 导入扩展",
              "BOSS/猎聘/官网 JD 一键解析；图片 JD OCR（vision model 已预留）",
              "P2",
            ],
            [
              "团队 / 教练版",
              "多候选人 Progress 对比、教练批注故事库、Mock 旁观模式",
              "P2 · 商业化探索",
            ],
            [
              "质检自动化",
              "Debrief / Prep 输出 14 条规则化审计（借鉴 HV-Analysis），未达标章节定向重写",
              "P3",
            ],
          ]}
        />
        <PrdParagraph>
          迭代节奏以「真实求职季」反馈为准：优先巩固四阶段数据闭环与模型路由，再扩展语音与外部岗位源；避免在未跑通 Notion 同步前堆叠新模块。
        </PrdParagraph>
      </PrdSection>

      <div className="holo-card rounded-2xl p-6 sm:p-8">
        <ProjectDetailActions
          startHref={project.startHref}
          startExternal={project.startExternal}
        />
      </div>
    </ProjectPrdShell>
  );
}
