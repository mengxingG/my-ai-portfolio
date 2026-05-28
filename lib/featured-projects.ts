import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Briefcase,
  GraduationCap,
  Mic2,
  Newspaper,
} from "lucide-react";
import { FEYNMAN_LEARNING_DEMO_HREF } from "@/lib/feynman-demo-link";
import type { ProjectPipeline } from "@/lib/featured-project-pipeline";

export type FeaturedProjectFeature = {
  title: string;
  body: string;
};

export type FeaturedProjectStar = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

export type FeaturedProject = {
  id: string;
  category: string;
  title: string;
  star: FeaturedProjectStar;
  /** 技术实现描述，约 150 字 */
  technical: string;
  flow: string;
  tech: readonly string[];
  pipeline: ProjectPipeline;
  features: FeaturedProjectFeature[];
  image: { src: string; alt: string; width?: number; height?: number };
  caseStudyHref: string;
  caseStudyExternal?: boolean;
  startHref: string;
  startExternal?: boolean;
  icon: LucideIcon;
};

export const FEATURED_PROJECTS: FeaturedProject[] = [
  {
    id: "job-engine",
    category: "求职",
    title: "Job Engine - 全自动求职与背调引擎",
    star: {
      situation:
        "同时跟踪 BOSS、猎聘及多家 AI 公司官网岗位，情报分散、手动背调耗时长，且定时全量爬取曾导致本机内存溢出。",
      task: "网页端和手机端可查看，手机端以飞书为操作台，openClaw调用web_search / web_fetch进行公司深度背调 OS：一条指令完成采集、简报与深度背调，全部沉淀至 Notion 并可网页浏览。",
      action:
        "梳理菜单与自然语言意图，串行调度九路采集；背调链路要求联网溯源与报告写入岗位页，飞书仅推送核心结论。",
      result:
        "日常运营收敛到单会话，24 小时新岗位可推送简报，带公司名的背调可在数分钟内拿到可追溯摘要，看板支持持续复盘。",
    },
    technical:
      "飞书侧通过企业自建应用长连接接收消息与菜单事件，Python 网关解析意图并串行调度爬虫与背调，避免多任务占满本机内存。采集结果规范为统一 JSON，由 DeepSeek 做岗位五维匹配评分后同步 Notion。背调调用 OpenClaw 联网检索并结合在招 JD 生成可溯源报告，Next.js 与 Electron 读取 Notion 渲染看板与筛选。",
    flow: "🌟 飞书下达指令 ➔ 智能识别场景 ➔ 采集 / 背调 / 简报 ➔ 写入 Notion ➔ 看板呈现",
    tech: ["Python", "OpenClaw", "DeepSeek", "Notion", "飞书", "Next.js"],
    pipeline: {
      label: "产品全链路 · 飞书 × 智能背调",
      entry: {
        title: "飞书 · 一站式操作入口",
        subtitle: "底部快捷菜单 + 自然语言指令，移动端即可完成日常运营",
        tone: "violet",
      },
      router: {
        title: "指令中枢 · 场景识别与分流",
        subtitle: "区分资讯查询、岗位采集、今日简报、公司背调，避免指令互相干扰",
        tone: "neutral",
      },
      paths: [
        {
          title: "路径 A · 岗位采集",
          body: "按平台顺序抓取九路渠道 → 去重合并 → AI 五维匹配评分 → 同步至岗位库",
          tone: "emerald",
        },
        {
          title: "路径 B · 公司背调",
          body: "联网检索公开情报 → 结合在招岗位 JD → 生成深度报告写入岗位页 → 飞书推送两条要点",
          tone: "amber",
        },
        {
          title: "路径 C · 今日简报",
          body: "筛选过去 24 小时新入库岗位 → AI 提炼匹配亮点 → 推送可读早报卡片",
          tone: "cyan",
        },
      ],
      footer: {
        title: "岗位看板 · 统一阅读体验",
        subtitle: "网页端展示 JD、评分与背调长文，支持筛选与持续跟踪",
        tone: "violet",
      },
    },
    features: [
      {
        title: "特性 1：飞书 ChatOps 运营",
        body: "将「何时抓、抓哪家、要不要背调」收敛到飞书会话：菜单覆盖高频动作，自然语言补充精准指令。产品侧用互斥调度避免多任务并发拖垮本机，并在每步回传可理解的进度与结果卡片，降低用户心智负担。",
      },
      {
        title: "特性 2：可溯源的智能背调",
        body: "仅当用户明确点名公司才启动背调。长篇分析落在 Notion 岗位页便于二次编辑，飞书只保留战略级与能力级两条摘要，兼顾深度与移动阅读体验。",
      },
      {
        title: "特性 3：Notion 岗位数据中台",
        body: "以 Notion 作为唯一事实源：采集结果带评分与标签，可按入库时间生成简报。后续可扩展筛选、收藏与导出，使求职过程从「聊天记录」升级为「可检索、可复用」的资产库。",
      },
    ],
    image: {
      src: "/image/positons.png",
      alt: "Job Engine 飞书 ChatOps 与岗位简报",
      width: 1200,
      height: 600,
    },
    caseStudyHref: "/#featured-projects",
    startHref: "https://interview.mengxing-ai.it.com/job-analysis?tab=monitor",
    startExternal: true,
    icon: Briefcase,
  },
  {
    id: "ai-news-radar",
    category: "资讯",
    title: "AI Hot News - 每日 AI 资讯模块",
    star: {
      situation:
        "AI PM 需每日掌握模型与产品动态，信息源分散在网站、社群与日报产品，通过飞书实现「点菜单即看资讯」的方式，与求职工具共用同一机器人。",
      task: "建设 Web 三视图 + 飞书卡片双端体验，精选可沉淀、日报要权威、推送要不打扰其他能力。",
      action:
        "定义六条飞书菜单与对应内容策略，网关层优先识别资讯指令；精选走定时入库，日报直连官方归档，卡片由独立渲染服务生成。",
      result:
        "用户可在飞书秒级获取日报/精选/分类动态，网站端支持深度阅读与标星，资讯与求职指令互不串线。",
    },
    technical:
      "Next.js 三 Tab 分别对接精选库、全量列表与官方日报页；定时任务从 AI HOT API 拉取精选，经去重后写入 Notion 供网站标星与检索。飞书侧 Express 卡片服务接收网关转发的菜单指令，按场景拉取日报/精选/分类并渲染互动卡片。长连接网关优先匹配资讯关键词，与求职、背调类指令隔离，双服务协作保障 7×24 响应。",
    flow: "🌟 内容入库 ➔ 网站三视图阅读 ➔ 飞书菜单触发 ➔ 卡片推送回会话",
    tech: ["Next.js", "AI HOT", "Notion", "Express", "飞书", "Node"],
    pipeline: {
      label: "产品全链路 · 资讯触达",
      entry: {
        title: "飞书 · 资讯快捷菜单",
        subtitle: "看今日日报、看精选、模型/产品/行业分类等六类高频场景",
        tone: "violet",
      },
      router: {
        title: "统一网关 · 资讯优先分流",
        subtitle: "先识别资讯类指令并转交卡片服务，再处理求职与背调，避免关键词误触发",
        tone: "neutral",
      },
      paths: [
        {
          title: "路径 A · 精选沉淀",
          body: "每日拉取权威精选 → 按日期与链接去重 → 写入 Notion 供网站展示与检索",
          tone: "emerald",
        },
        {
          title: "路径 B · 网站深度阅读",
          body: "精选/全量浏览已沉淀内容 → 日报 Tab 读官方杂志式排版 → 支持标星反馈",
          tone: "cyan",
        },
        {
          title: "路径 C · 飞书即时卡片",
          body: "按菜单匹配内容类型 → 生成结构化互动卡片 → 一键跳转到网页详情",
          tone: "amber",
        },
        {
          title: "路径 D · 首页轻量预览",
          body: "个人站嵌入最新资讯列表 → 倒序展示 → 引导进入完整雷达页",
          tone: "blue",
        },
      ],
      footer: {
        title: "7×24 值守 · 双服务协作",
        subtitle: "长连接网关 + 本地卡片引擎，保障菜单指令稳定响应",
        tone: "violet",
      },
    },
    features: [
      {
        title: "特性 1：三视图内容策略",
        body: "「精选」服务快速判断价值，「全部」服务检索与复盘，「AI 日报」对齐官方产品体验而非二次拼装。三者在信息密度、更新频率与交互上分层，避免一个列表承载所有诉求导致认知过载。",
      },
      {
        title: "特性 2：精选入库与标星闭环",
        body: "入库规则聚焦「今昨 + 去重」，控制噪音与存储成本。标星写回 Notion 形成个人高价值清单，便于 HR 场景筛选或二次分享，形成从消费到标注的产品闭环。",
      },
      {
        title: "特性 3：飞书与网站职责分离",
        body: "飞书负责「触达与摘要」，网站负责「深度阅读与检索」。网关层用优先级策略隔离资讯与求职指令，降低误触背调或爬虫的概率，是多产品共用同一机器人的关键设计。",
      },
    ],
    image: {
      src: "/image/news-dashboard.png",
      alt: "AI News Radar 控制台界面",
      width: 1200,
      height: 600,
    },
    caseStudyHref: "/projects/ai-news-radar",
    startHref: "/ai-news",
    icon: Newspaper,
  },
  {
    id: "feynman-hub",
    category: "学习",
    title: "费曼学习工具 - 深度学习引擎",
    star: {
      situation:
        "学习复杂材料时常见「看过即忘」，传统笔记难检验是否真懂，面试前又缺乏低成本演练环境。",
      task: "做一款 NotebookLM 风格双栏产品：左栏降低认知负荷，右栏用费曼对话 + AI 考官验证理解，并把掌握度写回 Notion。",
      action:
        "设计材料导入、概念拆解、追问梯度与复习队列；加入 ADHD 友好的短时段启动与正向激励。",
      result:
        "形成学—讲—考—复习闭环，用户可在压力场景前发现盲点，学习数据留在自己的知识库而非锁死在聊天窗口。",
    },
    technical:
      "基于 Next.js App Router：左侧材料区支持上传 PDF/粘贴文本，解析上传材料生成总结文档解析与 Mermaid 概念图，右侧费曼与 AI 面试官分别调用 Gemini、DeepSeek 流式对话，追问按掌握度分级。学习状态、笔记与复习队列经 Notion API 写回用户工作区，服务端路由保护密钥；复习调度按间隔重复生成待练列表，正计时与轻量任务降低启动门槛。",
    flow: "🌟 材料导入 ➔ 结构化拆解 ➔ 费曼讲解 ➔ AI 面试考核 ➔ 复习队列 ➔ 掌握度画像",
    tech: ["Gemini", "DeepSeek", "Next.js", "Notion", "Mermaid"],
    pipeline: {
      label: "产品全链路 · 学考一体",
      entry: {
        title: "学习入口 · 多形态材料",
        subtitle: "支持 PDF、Markdown与粘贴文本，一键进入整理模式",
        tone: "violet",
      },
      router: {
        title: "理解引擎 · 结构化拆解",
        subtitle: "生成大纲与概念关系图，左栏提供低负担摘要",
        tone: "neutral",
      },
      paths: [
        {
          title: "路径 A · 费曼讲解",
          body: "双栏对话引导用自己的话复述 → 逐级追问直到讲清楚",
          tone: "emerald",
        },
        {
          title: "路径 B · AI 面试官",
          body: "模拟高压提问 → 识别回答漏洞 → 薄弱点进入复习队列",
          tone: "amber",
        },
        {
          title: "路径 C · 轻量启动",
          body: "「只学 5 分钟」降低启动成本 → 正计时减压 → 宠物正向反馈",
          tone: "cyan",
        },
      ],
      footer: {
        title: "Notion · 个人学习画像",
        subtitle: "掌握度、笔记与复习计划沉淀到用户自有知识库",
        tone: "fuchsia",
      },
    },
    features: [
      {
        title: "特性 1：学 + 考双引擎",
        body: "费曼环节解决「是否理解」，AI 面试官解决「压力下能否表达」。两者串联但不混用，避免用聊天代替测评。答错自动入复习队列，把产品从内容消费工具升级为能力训练工具。",
      },
      {
        title: "特性 2：Notion 原生沉淀",
        body: "学习记录、费曼笔记与复习计划写回用户 Notion，尊重已有知识管理工作流。PM 视角这是降低迁移成本、提高留存的关键——数据在用户侧，产品做增强层而非孤岛。",
      },
      {
        title: "特性 3：ADHD 友好设计",
        body: "针对启动困难设计短任务默认、正计时与无惩罚激励，减少「还没开始就放弃」。通过降低单次承诺时长，提高周活跃与材料完成率，属于行为设计而不仅是功能堆叠。",
      },
    ],
    image: {
      src: "/images/feynman-hub/learning-fullview.png",
      alt: "费曼学习工具 双栏学习界面",
      width: 1920,
      height: 1080,
    },
    caseStudyHref: "/projects/feynman-hub",
    startHref: FEYNMAN_LEARNING_DEMO_HREF,
    icon: GraduationCap,
  },
  {
    id: "interview-os",
    category: "面试",
    title: "InterviewOS - AI 面试教练",
    star: {
      situation:
        "候选人常陷入背八股与模板答案，真实面试中的追问与压力难以自助练习，聊天记录也难以沉淀为可复盘资产。",
      task: "打造全链路教练：先读懂 JD 与简历，再模拟面试并高压追问，最后给出五维评分与改进建议。",
      action: "设计故事库匹配、多轮对话与评分雷达；报告与 JD 记录写入 Notion，支持跨场次对比。",
      result:
        "用户获得接近真实面试的节奏训练，能定位表达与结构漏洞，并形成可追踪的成长档案而非一次性对话。",
    },
    technical:
      "DeepSeek 解析 JD 与简历结构化字段，再从 Notion 故事库检索 STAR 素材做对齐建议。模拟面试维持多轮上下文，追问模块绑定五维评分 rubric 并流式输出雷达图。场次转录与复盘报告写回 Notion，部署于 Vercel，API Route 统一鉴权与限流，前端支持跨场次分数对比与再次演练入口。",
    flow: "🌟 读懂 JD ➔ 匹配故事 ➔ 模拟面试 ➔ 高压追问 ➔ 五维评分 ➔ 复盘入库",
    tech: ["DeepSeek", "Gemini", "Next.js", "Notion", "Vercel"],
    pipeline: {
      label: "产品全链路 · 面试教练",
      entry: {
        title: "准备阶段 · JD 与简历",
        subtitle: "解析岗位要求与简历亮点，明确本轮练习目标",
        tone: "violet",
      },
      router: {
        title: "弹药匹配 · 故事库对齐",
        subtitle: "从个人故事库挑选最契合素材，给出针对性表达建议",
        tone: "neutral",
      },
      paths: [
        {
          title: "路径 A · 模拟面试",
          body: "多轮真实节奏对话 → 聚焦业务与项目细节 → 拒绝套路问答",
          tone: "emerald",
        },
        {
          title: "路径 B · 高压追问",
          body: "针对回答漏洞连续追问 → 五维雷达呈现结构与表达短板",
          tone: "amber",
        },
        {
          title: "路径 C · 复盘沉淀",
          body: "转录与 AI 复盘写回 Notion → 支持跨场次对比与再次演练",
          tone: "cyan",
        },
      ],
      footer: {
        title: "成长仪表盘 · 长期追踪",
        subtitle: "JD、场次、分数与改进项可视化，支撑持续迭代",
        tone: "rose",
      },
    },
    features: [
      {
        title: "特性 1：高压追问机制",
        body: "产品价值在于模拟「面试官不满意你的答案」的真实压力，而非陪聊。追问规则绑定五维评分模型，让用户知道差在结构、深度还是业务判断，并给出可执行的下一轮改进点。",
      },
      {
        title: "特性 2：故事库与 JD 对齐",
        body: "先拆 JD 核心能力项，再从故事库检索高匹配案例，减少盲目投递与答非所问。对 PM 而言，这是把「简历优化」产品化为可重复流程，提升单次模拟的针对性与转化率。",
      },
      {
        title: "特性 3：Notion 复盘闭环",
        body: "转录、评分与复盘报告自动归档，构建跨时间的面试资产。用户可对比多次表现，看到维度分数变化，使练习从消耗品变为复利型投资。",
      },
    ],
    image: {
      src: "/image/interview-prep.png",
      alt: "InterviewOS 全链路 AI 面试教练界面",
      width: 1200,
      height: 600,
    },
    caseStudyHref: "/projects/interview-os",
    startHref: "https://interview.mengxing-ai.it.com/",
    startExternal: true,
    icon: Mic2,
  },
  {
    id: "hv-analysis",
    category: "研究",
    title: "横纵分析法 (HV-Analysis) - 深度研究引擎",
    star: {
      situation:
        "行业研究常停留在资料堆砌，缺乏纵轴时间叙事与横轴竞品对照的系统方法，长报告还易受单次模型上下文限制。",
      task: "将「横纵分析法」产品化：用户定题后自动检索、分章生成万字研报，并经质检与可修正闭环。",
      action: "设计配置向导、分章流式输出、14 条质量规则与一键重写；支持导出与 Notion 归档。",
      result: "研究产出从小时级手工拼接降为可配置流水线，报告结构稳定、可审计，历史研报可复用与对比。",
    },
    technical:
      "Next.js API 编排研究流水线：Tavily 预检索素材后分章调用 DeepSeek、Claude 流式生成，纵向章节走时间线模板、横向走竞品矩阵。14 条规则质检未通过章节可定向重写，SSE 推送章节进度。定稿经用户确认后归档 Notion 历史舱，支持导出 Markdown 与按时间检索元数据。",
    flow: "🌟 定题配置 ➔ 联网检索 ➔ 纵向叙事 ➔ 横向对比 ➔ 洞察交汇 ➔ 质检修正 ➔ 研报归档",
    tech: ["DeepSeek", "Tavily", "Claude", "Next.js", "Notion"],
    pipeline: {
      label: "产品全链路 · 深度研究",
      entry: {
        title: "研究定题 · 配置向导",
        subtitle: "明确对象、动机、竞品与时间范围，降低空白页焦虑",
        tone: "violet",
      },
      router: {
        title: "证据采集 · 多源检索",
        subtitle: "预先拉取网页与公开资料，为各章节提供可引用素材",
        tone: "neutral",
      },
      paths: [
        {
          title: "路径 A · 纵向叙事",
          body: "按时间线梳理产品/公司演进 → 输出长文生命史章节",
          tone: "emerald",
        },
        {
          title: "路径 B · 横向对比",
          body: "竞品能力矩阵与差异化分析 → 形成对照章节",
          tone: "amber",
        },
        {
          title: "路径 C · 质检与修订",
          body: "规则化质量审计 → 未达标章节一键重写 → 再审计闭环",
          tone: "cyan",
        },
      ],
      footer: {
        title: "研报库 · 历史舱",
        subtitle: "确认后存入 Notion，可按时间回溯正文与质检结果",
        tone: "fuchsia",
      },
    },
    features: [
      {
        title: "特性 1：分章流式体验",
        body: "把超长报告拆为定义、纵向、横向、交汇等章节顺序生成，前端流式展示降低等待焦虑。产品侧突破单次上下文上限，用户可在章节完成时先行阅读与导出，提高可控感与满意度。",
      },
      {
        title: "特性 2：质检 + 定向修订",
        body: "用明确规则约束叙事深度、竞品覆盖与套话比例，未通过项可触发重写而非让用户手工改万字文。形成「生成—评估—修正」闭环，显著提升研报可用率与专业感。",
      },
      {
        title: "特性 3：Notion 研报资产化",
        body: "归档时保留元数据与质检结果，历史舱支持按时间检索与对比。对 PM 与分析师而言，这是把一次性对话变为可积累的研究资产，利于团队复用与版本迭代。",
      },
    ],
    image: {
      src: "/images/hv-analysis/hv-page.png",
      alt: "横纵分析法 HV-Analysis 深度研究配置界面",
      width: 1920,
      height: 1080,
    },
    caseStudyHref: "/tools/hv-analysis",
    startHref: "/tools/hv-analysis",
    icon: BarChart3,
  },
];
