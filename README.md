# my-ai-portfolio

AI PM 的数字工作流 · 个人独立开发项目集合。基于 **Next.js (App Router)** + **TypeScript** + **Tailwind CSS** 构建，数据持久化统一走 **Notion API**，长耗时 AI 任务采用 **Vercel AI SDK 流式** 响应。

## Getting Started

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

生产构建：

```bash
npm run build
npm start
```

## 项目一览

| 时段 | 项目 | 路径 | 说明 |
|------|------|------|------|
| 05:00 | 全自动求职与背调引擎 | 外部站点 | 9 平台爬虫 + Notion CMS + 飞书 ChatOps 串行调度（Job Engine） |
| 09:00 | AI News Radar | `/ai-news` | 异构双引擎资讯雷达，Notion 结构化入库 |
| 14:00 | 费曼学习工具 | `/learning` | 双模态学习 + AI 面试官，掌握度写回 Notion |
| 15:00 | InterviewOS | 外部站点 | 全链路 AI 面试教练，JD 解码与五维评分 |
| 18:30 | **横纵分析法 (HV-Analysis)** | `/tools/hv-analysis` | 深度研究引擎，分章流式报告 + QA 审计 + Notion 归档 |

---

## 横纵分析法 (HV-Analysis)

> 方法论由数字生命卡兹克提出：纵轴沿时间追溯产品/公司/概念的完整生命史，横轴在当下截面与竞品系统性对比，在交汇处产出独到判断。

![横纵分析法配置界面](public/images/hv-analysis/hv-page.png)

### 功能概览

- **深度研究配置**：研究对象、类型、动机、对标竞品、时间范围、大模型选择
- **联网检索**：Tavily 多源预采集，注入分章 Prompt
- **分章流式流水线**：定义 → 纵向（6k–15k 字）→ 横向（3k–10k 字）→ 横纵交汇，总篇幅可达 1–3 万字
- **14 条军规 QA 审计**：叙事体、竞品深度、套话禁区、万字体量等自动质检
- **Actor-Critic Auto-Refine**：未通过项一键触发 Claude 流式重写并 re-QA
- **导出**：Markdown 下载 / WeasyPrint PDF
- **Notion 研报库**：手动「存入 Notion」，左侧历史舱按时间倒序恢复正文与质检结果

### 研究闭环

```
定题（对象 · 类型 · 竞品）
  → 检索（Tavily 多源）
  → 纵轴（时间叙事）
  → 横轴（竞品对比）
  → 沉淀（QA · Notion）
```

### 环境变量

在 `.env.local` 中配置：

```bash
# 必需
DEEPSEEK_API_KEY=          # 主报告生成（DeepSeek 推理）
TAVILY_API_KEY=            # 联网搜索
NOTION_API_KEY=            # 或 NOTION_TOKEN
NOTION_DATABASE_ID_HV_ANALYSIS=  # hvSearch 研报数据库 ID

# 可选 — 质检 / Auto-Refine 经 gptsapi.net 中转（需 OPENAI_API_KEY）
OPENAI_API_KEY=
HV_QA_MODEL_ID=gemini-3.5-flash
HV_REFINE_MODEL_ID=claude-sonnet-4-6

# 可选 — Notion 列名映射（默认见下表）
NOTION_HV_PROP_TITLE=研究对象
NOTION_HV_PROP_TARGET=Target
NOTION_HV_PROP_TYPE=type
NOTION_HV_PROP_MOTIVATION=Motivation
NOTION_HV_PROP_COMPETITORS=Competitors
NOTION_HV_PROP_MODEL=Model
NOTION_HV_PROP_SCORE=Score          # Number 类型
NOTION_HV_PROP_QA_DATA=QA_Data
NOTION_HV_PROP_CREATED_AT=CreatedAt
```

| Notion 列 | 类型 | 来源 |
|-----------|------|------|
| 研究对象 | Title | `{targetName} · 横纵分析` |
| Target | Rich text | 研究对象名称 |
| type | Rich text | 研究对象类型 |
| Motivation | Rich text | 研究动机 / 核心关注点 |
| Competitors | Rich text | 指定对标竞品 |
| Model | Rich text | 大模型 ID |
| Score | Number | QA 总分 |
| QA_Data | Rich text | QA 结果 JSON |
| CreatedAt | Date | 存档日期 |

### PDF 导出依赖

PDF 路由调用 `app/api/hv-analysis/md_to_pdf.py`（WeasyPrint），需本机安装 Python 3 与依赖：

```bash
pip install weasyprint markdown
```

### API 路由

| 路由 | 方法 | 说明 |
|------|------|------|
| `/api/hv-analysis` | POST | 主流程：Tavily 检索 + 分章流式生成 + QA |
| `/api/hv-analysis/stream` | POST | 流式别名 |
| `/api/hv-refine` | POST | QA 驱动的 Actor-Critic 定向重写 |
| `/api/hv-qa` | POST | 独立 QA 评分 |
| `/api/hv-analysis/notion-save` | POST | 手动存入 Notion |
| `/api/hv-history` | GET | 历史研报列表 |
| `/api/hv-history/[id]` | GET | 单条研报详情（Markdown + QA） |
| `/api/hv-analysis/pdf` | POST | Markdown → PDF |

### 关键目录

```
app/tools/hv-analysis/page.tsx       # 前端主页面
components/hv-analysis/            # ConfigForm、QaInspector、HistoryReportSidebar 等
lib/hv-analysis/                   # notion-save、run-hv-qa、refine-prompt、style-guidelines
app/api/hv-analysis/               # 主路由 + md_to_pdf.py
src/prompts/hv-analysis.md         # 分章 Prompt 模板
lib/skills/hv-analysis/SKILL.md    # Cursor Agent Skill（方法论与写作规范）
```

---

## 文章详情：快 + 发布后立刻更新

文章详情对 Notion 的请求使用 **Next.js Data Cache**（`fetch` + `tags` + `revalidate: false`），日常访问会命中缓存，速度极快。

在 `.env.local` 增加随机密钥：

```bash
REVALIDATE_SECRET=你的长随机字符串
```

**发布 / 更新 Notion 文章后**，任选一种方式刷新缓存：

1. **只刷新某一篇**（`articleId` 为 Notion 页面 ID，带连字符的 UUID）：

```bash
curl -X POST "https://你的域名/api/revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: 你的长随机字符串" \
  -d '{"articleId":"xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"}'
```

2. **刷新所有已缓存的文章详情**（不记得具体 ID 时）：

```bash
curl -X POST "https://你的域名/api/revalidate" \
  -H "Content-Type: application/json" \
  -H "x-revalidate-secret: 你的长随机字符串" \
  -d '{"allArticles":true}'
```

可在 Notion 自动化、Zapier、或自建 Webhook 里对上述 URL 发 `POST`，实现「点发布 → 立刻调用 revalidate → 线上秒更新」。

## Deploy on Vercel

推荐部署至 [Vercel](https://vercel.com/new)。注意 Hobby 计划 serverless 超时约 10s，HV-Analysis 等长任务已通过 **TransformStream 流式** 规避；PDF 导出依赖 Node runtime 与本机 Python（本地开发）或对应 Serverless 配置。
