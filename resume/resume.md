# 龚梦星｜AI 产品经理 (AI Product Manager)

**邮箱:** [1149427072@qq.com](mailto:1149427072@qq.com) | **作品集:** [mengxing-ai.it.com](https://mengxing-ai.it.com) | **GitHub:** [github.com/mengxingG](https://github.com/mengxingG)

---

## 个人简介

4 年花旗交易系统经验 + Vibe Coding 重度使用者，既能定义产品策略，也能独立 0→1 把产品做出来。在花旗主导设计 AI 合规智能助手，将风险识别从 T+1 后置发现前移至交易前 1 秒内（PRD→UI→试点→数据验证全程独立推动）；推动大模型基建团队与应用团队建立分层问责协议，将跨团队问题定位从 3–5 天缩短到 1 天闭环。独立开发并上线 5 款 AI 产品（InterviewOS 全链路面试教练、Job Engine 求职背调引擎、费曼学习系统、横纵分析法研报引擎、AI News Radar 资讯雷达），使用 Cursor / Claude Code 独立完成架构→AI 工作流→前端交付。不只是画原型写文档的 PM——给我一个问题，我能交付一个跑在线上的产品。

---

## 核心能力

**产品能力：** AI 产品策略与 0→1 落地 | AI 能力边界与 fail-safe 设计 | Agent / ChatOps 场景化交付 | 模型评测与上线门槛（Golden Dataset · QA Rubric） | 跨团队 AI 基建协同 | 高风险合规场景产品化

**AI 能力：** LLM 应用架构（RAG · Agent · Workflow） | Agent 编排与 Tool Use（OpenClaw · Coze · 意图路由） | 多模型场景路由（Qwen / Claude / DeepSeek / Gemini） | 联网检索与可溯源 AI（OpenClaw · Tavily · 防幻觉） | Prompt Engineering 与结构化输出 | LLM 成本/延迟优化（Semantic Cache · 规则分流） | 多模态文档理解（PDF · 材料入库） | 长任务 AI 体验（流式分章 · 进度可见）

**技术能力：** Vibe Coding（Cursor / Claude Code） | 全栈交付（Next.js / TypeScript / Python / Node.js） | Notion 数据中台 · 飞书 Open API | Git / Vercel 部署

---

## 工作经历

### 花旗金融信息服务 (Citi Financial Information Services)
**经理 | AI 产品负责人** · 2021.07 – 2025.09

*业务背景：* 前期 2 年参与 Pre-Trade 数据平台现代化重构（数据校验、Angular 迁移、API 重构），建立交易流程与 Trader 决策模式的系统理解。

**产品经历 1：Pre-Trade AI 合规智能助手（核心）**

- 主导 0→1 AI 产品转型，定位「合规副驾驶」（辅助决策 + fail-open 策略，不替代风控系统）
- 设计 L0 规则引擎 + L1 RAG 语义引擎混合架构：L0 处理约 80% 确定性违规（<50ms），L1 处理语义灰区（Hybrid Search BM25 0.4 + Dense 0.6，召回率 >98%）
- 引入 Semantic Cache（语义哈希 + Redis 24h），将约 40% 重复查询延迟从 ~1.5s 降至 ~200ms，月度 LLM 推理成本节省约 $120K
- 设计红黄绿三级信号 + Override 必填理由机制，构建「Trader 反馈→专家标注→模型优化」数据飞轮
- P2 单 desk 试点 4 周（约 800–1200 笔 RFQ），误报率从约 20%–30% 降至 10%–15%，执行采纳率 65%–70%
- 推动大模型基建团队与应用团队建立分层问责协议（检索层→模型层→数据层逐层排查），通过 MVP API 方案（12→3 个 endpoint）打破排期僵局，2 周完成联调

**产品经历 2：AI 合规知识库与法规情报系统**

- 设计面向合规团队的「法规变化感知 + 可追溯问答」平台，解决数百份跨司法辖区法规 PDF 的检索与合规咨询效率问题
- RBAC 权限在检索阶段前置过滤（非生成后过滤），从架构层杜绝跨团队数据泄露风险，通过内部安全审查
- 多模态文档解析链路（PyMuPDF→结构化布局分析→Gemini Vision），专项解决金融 PDF 跨页表格、嵌套结构的抽取难题
- 回答强制附带法规原文引用（不允许无来源回答），设定 Golden Dataset 上线门槛（F1>90%）与专家复核机制

**产品经历 3：Vantage Match Engine 推荐流优化**

- 在覆盖 Credit/Mortgage/Short Term 三大资产类别的 Pre-Sales 平台上，将跨模块人工比对改造为单页实时推荐 + 匹配原因可视化
- 决策耗时 5–8min→1–2min，采用率首月 50%→次月 65–70%，此经验直接驱动后续 AI 合规助手的可解释推理链设计

---

## 独立 AI 产品

### 产品经历 4：InterviewOS | 全链路 AI 面试教练（核心）
**在线体验：** [interview.mengxing-ai.it.com](https://interview.mengxing-ai.it.com/)

作战中枢 + 四阶段 15+ 子模块，覆盖求职定位→JD 解码/简历优化→模拟面试与 Prep→复盘谈薪；用该产品准备面试，形成「产品即证据」闭环。

- 设计故事库与 JD 对齐机制：先拆 JD 核心能力项，再从 Notion 故事库检索高匹配案例，减少盲目投递与答非所问
- 模拟面试 + 高压追问：多轮真实节奏对话，追问绑定五维评分模型（结构/深度/业务判断等），定位表达与逻辑漏洞
- 三模型按场景分流：Qwen 3.7 Max 简历/JD 中文润色；Claude Sonnet 4.6 模拟面试与结构化反馈；DeepSeek V4-Pro 日常刷题
- Notion 活文档双向同步：转录、评分与复盘报告自动归档，支持跨场次对比与成长趋势追踪

*技术栈：* Next.js 15 · Vercel AI SDK · Qwen / Claude / DeepSeek · Notion API

### 产品经历 5：Job Engine | 全自动求职与背调引擎
**在线体验：** [interview.mengxing-ai.it.com/job-analysis](https://interview.mengxing-ai.it.com/job-analysis?tab=monitor)

飞书 ChatOps 驱动九路岗位采集、AI 五维评分与 OpenClaw 可溯源背调，Notion 数据中台与 Web 看板统一阅读。

- 构建九路采集管道（BOSS、猎聘及多家 AI 公司官网），串行调度避免多任务并发导致本机 OOM；DeepSeek 五维匹配评分后增量入库 Notion
- 设计飞书 ChatOps + OpenClaw Agent 意图路由：区分资讯查询、岗位采集、今日简报、公司背调；背调强制挂载 web_search/web_fetch，结论标注 URL 来源
- Notion 作为唯一事实源：采集结果带评分与标签，可按入库时间生成 24h 简报；Web/Electron 看板支持筛选与背调长文阅读
- 飞书仅推送核心结论，长篇背调报告写入岗位页，兼顾移动阅读与深度复盘

*技术栈：* Python · Playwright / DrissionPage · DeepSeek · OpenClaw · 飞书 · Notion · Next.js · Electron

### 产品经历 6：费曼学习工具 | 深度学习引擎
**在线体验：** [mengxing-ai.it.com/learning](https://mengxing-ai.it.com/learning)

NotebookLM 风格双栏产品：左栏材料解析与概念图，右栏费曼复述 + AI 面试官压力测试，掌握度与复习队列写回 Notion。

- 学—讲—考—复习闭环：PDF/文本入库→多模态解析与概念拆解→费曼复述→AI 面试官加压考核→盲点进入 SM-2 间隔复习队列
- 追问按掌握度分级，Gemini 负责材料解析，DeepSeek 负责费曼对话与面试考核，学习数据沉淀至用户自有 Notion 知识库
- ADHD 友好设计：「只学 5 分钟」短任务默认、正计时与正向激励，降低启动门槛，提高材料完成率

*技术栈：* Next.js · Gemini · DeepSeek · Notion · Mermaid · Vercel

### 产品经历 7：横纵分析法 | 深度研究引擎
**在线体验：** [mengxing-ai.it.com/tools/hv-analysis](https://mengxing-ai.it.com/tools/hv-analysis)

将「纵轴时间叙事 + 横轴竞品对照」产品化：定题后自动检索、分章流式生成万字研报，14 条军规 QA 与 Notion 历史舱归档。

- 研究流水线：Tavily 预检索素材→分章流式生成（纵向时间线 + 横向竞品矩阵）→洞察交汇章节，SSE 推送章节进度
- 14 条规则质检未通过章节可定向重写，形成「生成—评估—修正」闭环，显著提升研报可用率与专业感
- 定稿经用户确认后归档 Notion 历史舱，支持导出 Markdown 与按时间检索元数据

*技术栈：* Next.js · DeepSeek · Claude · Tavily · Gemini · Notion · SSE

### 产品经历 8：AI News Radar | 每日 AI 资讯模块
**在线体验：** [mengxing-ai.it.com/ai-news](https://mengxing-ai.it.com/ai-news)

Engine A 入库 Notion + AI HOT 日报/飞书菜单；Web 三视图 + 飞书六菜单卡片，与求职网关指令隔离。

- 三视图内容策略分层：「精选」快速判断价值，「全部」检索复盘，「AI 日报」对齐 AI HOT 官方杂志式排版
- fetch-news 调用 ai-news-update Engine A（HN/Polymarket/YouTube），今/昨过滤与 URL 去重后写入 Notion；Web 端标星写回个人清单
- 飞书负责触达与摘要，网站负责深度阅读；网关层优先匹配资讯指令，与求职/背调类指令隔离

*技术栈：* Next.js · FastAPI · AI HOT · Notion · Express · Node.js · Python · 飞书

---

## 教育背景

- **软件工程 硕士** | 中南大学 | 2021
- **物联网工程 学士** | 湖南农业大学 | 2018
