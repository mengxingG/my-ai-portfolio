import { ProjectDetailActions } from "@/components/projects/ProjectDetailActions";
import { ProjectDetailHeader } from "@/components/projects/ProjectDetailProse";
import { ProjectDetailFigure } from "@/components/projects/ProjectOverviewImageRow";
import { ProjectOverviewImageRow } from "@/components/projects/ProjectOverviewImageRow";
import { ProjectPrdArchitectureDiagramRows } from "@/components/projects/ProjectPrdArchitectureDiagram";
import {
  PrdCallout,
  PrdList,
  PrdParagraph,
  PrdSection,
  PrdSubheading,
  PrdTable,
  ProjectPrdShell,
} from "@/components/projects/ProjectPrdLayout";
import { AI_NEWS_PRD_NAV } from "@/lib/featured-project-prd-nav";
import { getFeaturedProjectById } from "@/lib/featured-projects";
import { AI_NEWS_ARCHITECTURE_ROWS } from "@/lib/project-prd-diagrams";

const project = getFeaturedProjectById("ai-news-radar")!;

export const metadata = {
  title: "AI Hot News · 产品 PRD",
  description:
    "AI HOT 三视图 + Notion 精选入库 + 飞书六菜单卡片；与 Job Engine 共用 feishu_gateway 门卫。",
};

export default function AINewsRadarProjectPage() {
  return (
    <ProjectPrdShell nav={AI_NEWS_PRD_NAV}>
      <div id="top" className="scroll-mt-24 space-y-6">
        <ProjectDetailHeader
          kicker="AI 产品 PRD"
          title={project.title}
          description="Web 端深度阅读与飞书即时触达共用 AI HOT 公开 API。精选经 fetch-news 写入 Notion；日报 Tab 直连官方归档；飞书菜单由 job_engine 门卫最高优先级转发至本仓库 Node 卡片引擎。"
        >
          <ProjectDetailActions startHref={project.startHref} />
        </ProjectDetailHeader>

        <section aria-label="产品总览">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90">
            产品总览
          </p>
          <ProjectOverviewImageRow
            images={[
              {
                src: "/image/news-dashboard.png",
                alt: "AI News Radar 控制台三视图",
                caption: "资讯雷达 /ai-news",
              },
              {
                src: "/image/news-feishu.png",
                alt: "飞书卡片",
                caption: "飞书卡片示例",
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
              "能做：拉取 AI HOT 精选/分类/日报并渲染为 Web 列表或飞书卡片；将精选条目去重写入 Notion；Web 端标星写回 Notion 字段。",
              "不能做：不自行爬取非 AI HOT 源；不生成原创深度研报；飞书侧不负责求职采集/背调（由 job_engine 路由隔离）。",
              "日报体验：AI 日报 Tab 读官方 API 归档正文，不经 Notion 二次拼装，保证与 AI HOT 产品一致。",
              "非训练：摘要与卡片文案为 API 数据 + 模板/路由逻辑，无离线训练流水线。",
            ]}
          />
        </PrdCallout>
      </PrdSection>

      <PrdSection id="features" title="二、功能定义">
        <PrdSubheading>功能矩阵</PrdSubheading>
        <PrdTable
          headers={["模块", "用户价值", "算法 / 逻辑要点"]}
          rows={[
            [
              "精选入库",
              "高信噪比沉淀",
              "npm run fetch-news → mode=selected；北京时区今/昨；URL 去重写 Notion",
            ],
            [
              "三视图 Web",
              "分层阅读",
              "精选 / 全部（Notion）+ AI 日报（API 最近 30 期 + 按日正文）",
            ],
            [
              "首页预览",
              "轻量触达",
              "AINewsWidget：Notion 全量倒序最多 20 条，链至 /ai-news",
            ],
            [
              "飞书卡片",
              "移动秒读",
              "飞书点 6 条底部菜单 → Python 门卫识别后转本机 Node → 拉 AI HOT 生成卡片 → 发回当前聊天",
            ],
            ["标星", "个人清单", "PATCH /api/ai-news/star 同步 Notion"],
          ]}
        />
        <PrdSubheading>用户交互流程</PrdSubheading>
        <PrdList items={[project.star.action, project.star.result]} />
         <ProjectOverviewImageRow
            images={[
              {
                src: "/image/news-feishu.png",
                alt: "飞书卡片",
                caption: "飞书卡片示例1",
              },
              {
                src: "/image/news-feishu2.png",
                alt: "飞书卡片",
                caption: "飞书卡片示例2",
              },
            ]}
          />
        <PrdSubheading>边界与容错</PrdSubheading>
        <PrdList
          items={[
            "菜单文案须与飞书后台一字不差，否则 router 无法命中。",
            "资讯指令必须在 route_intent 之前拦截，避免「看看精选」等误触发背调。",
            "精选入库依赖手动或自建调度（无 Vercel Cron 时本地 fetch-news）。",
            "Node 卡片引擎未启动时，飞书菜单不可用，Web 端仍可读 Notion。",
          ]}
        />
      </PrdSection>

      <PrdSection id="metrics" title="三、效果展示">
        <PrdSubheading>量化指标与验收</PrdSubheading>
        <PrdTable
          headers={["指标", "验收方式", "说明"]}
          rows={[
            ["飞书菜单", "6 条暗号均可出卡", "看今日日报、看精选、看本周、模型/产品/行业"],
            ["精选入库", "今昨 + URL 去重", "lib/cron-fetch-news.ts"],
            ["首页预览", "最多 20 条", "sortNewsNewestFirst，无时间 Tab 筛选"],
            ["日报", "take=30 归档", "/api/ai-news/dailies + /daily/{date}"],
            ["路由隔离", "资讯不误触求职", "资讯菜单先处理并 return，不进入求职爬虫/背调"],
          ]}
        />
        <PrdSubheading id="data-requirements">数据要求（AI 产品 PRD 必填）</PrdSubheading>
        <PrdList
          items={[
            "输入：AI HOT 公开 API（items/daily/dailies）；Notion 资讯库字段（标题、URL、时间、标星等）。",
            "精选策略：mode=selected + 上海时区日期过滤 + URL 主键去重。",
            "输出：Notion 页面记录；飞书 interactive 卡片 JSON（feishu-card-builder）。",
            "非训练：无标注训练集；质量依赖 AI HOT 源站 editorial 策略。",
          ]}
        />
        <PrdSubheading id="bad-cases">Bad Case 定义与处理（AI 产品 PRD 必填）</PrdSubheading>
        <PrdTable
          headers={["Bad Case", "预期表现", "处理策略"]}
          rows={[
            ["AI HOT API 失败", "Web/卡片可读缓存", "Notion 已沉淀条目仍展示；飞书返回错误提示"],
            ["Node :3001 未启动", "飞书菜单不可用", "README 要求双引擎联调；日志 node_api.log"],
            ["菜单文案不匹配", "无卡片", "严格对齐飞书后台与 aihot-router 暗号表"],
            ["误触背调", "不启动爬虫", "网关层资讯优先，不进入 route_intent"],
            ["重复条目", "不重复入库", "fetch-news URL 去重"],
          ]}
        />
      </PrdSection>

      <PrdSection id="tech" title="四、技术选择">
        <PrdSubheading>模型选择</PrdSubheading>
        <PrdTable
          headers={["场景", "技术", "说明"]}
          rows={[
            ["内容源", "AI HOT 公开 REST", "精选/分类/日报"],
            ["精选入库", "Node 脚本", "lib/cron-fetch-news.ts"],
            ["Web", "Next.js App Router", "/ai-news、AINewsWidget、API Routes"],
            ["飞书卡片", "Express + feishu-local-api", "tools/aihot-router、feishu-card-builder"],
            ["持久化", "Notion API", "NOTION_AI_NEWS_DB_ID"],
          ]}
        />
        <PrdSubheading>数据处理</PrdSubheading>
        <PrdList
          items={[
            "采集：AI HOT API → fetch-news → Notion（精选）；日报不经 Notion。",
            "Web 读：fetchAINewsRadarFromNotion SSR；日报走 aihot-daily-api 封装。",
            "飞书：点菜单 → Python 门卫识别资讯指令 → Node :3001 拉 AI HOT 并生成卡片 → 门卫把卡片发回当前聊天（不触发求职爬虫/背调）。",
            "标星：PATCH /api/ai-news/star 更新 Notion 属性。",
          ]}
        />
        <PrdSubheading>系统架构</PrdSubheading>
        <ProjectPrdArchitectureDiagramRows
          rows={AI_NEWS_ARCHITECTURE_ROWS}
          caption="上：网站读 Notion；下：飞书菜单 → 门卫 → Node 做卡片 → 门卫发回聊天"
        />
      </PrdSection>

      <PrdSection id="lessons" title="五、学到的经验">
        <PrdList
          items={[
            "三视图分层比单列表更能控制认知负荷：精选判断价值、全部检索、日报对齐官方。",
            "与 Job Engine 共机器人时，网关优先级是产品级需求，不是实现细节。",
            "飞书负责触达、网站负责深度阅读，职责清晰可降低交互设计复杂度。",
          ]}
        />
      </PrdSection>

      <PrdSection id="roadmap" title="六、将来迭代计划">
        <PrdTable
          headers={["方向", "内容"]}
          rows={[
            ["自动化", "自建 CI/Cron 定时 fetch-news"],
            [
              "体验",
              "飞书卡片版式对比（如紧凑列表 vs 杂志导读）、分类订阅",
            ],
            ["数据", "个人高价值清单导出与分享"],
          ]}
        />
      </PrdSection>

      <div className="holo-card rounded-2xl p-6 sm:p-8">
        <ProjectDetailActions startHref={project.startHref} />
      </div>
    </ProjectPrdShell>
  );
}
