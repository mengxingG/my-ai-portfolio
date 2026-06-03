import { ProjectDetailActions } from "@/components/projects/ProjectDetailActions";
import { ProjectDetailHeader } from "@/components/projects/ProjectDetailProse";
import { ProjectDetailFigure } from "@/components/projects/ProjectOverviewImageRow";
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
import { HV_ANALYSIS_PRD_NAV } from "@/lib/featured-project-prd-nav";
import { getFeaturedProjectById } from "@/lib/featured-projects";
import { HV_ARCHITECTURE } from "@/lib/project-prd-diagrams";

const project = getFeaturedProjectById("hv-analysis")!;

export const metadata = {
  title: "横纵分析法 (HV-Analysis) · 产品 PRD",
  description:
    "纵轴时间叙事 + 横轴竞品对照，分章流式万字研报，14 条军规 QA 与 Notion 研报库。",
};

export default function HvAnalysisProjectPage() {
  return (
    <ProjectPrdShell nav={HV_ANALYSIS_PRD_NAV}>
      <div id="top" className="scroll-mt-24 space-y-6">
        <ProjectDetailHeader
          kicker="AI 产品 PRD"
          title={project.title}
          description="将卡兹克「横纵分析法」产品化为可配置研究流水线：Tavily 预检索、分章流式生成、规则化质检与定向修订，研报可归档 Notion 历史舱。详情页说明产品；「开始使用」进入 /tools/hv-analysis 在线工具。"
        >
          <ProjectDetailActions startHref={project.startHref} />
        </ProjectDetailHeader>

        <section aria-label="产品总览">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90">
            产品总览
          </p>
          <ProjectOverviewImageRow
            size="full"
            images={[
              {
                src: "/images/hv-analysis/hv-page.png",
                alt: "HV-Analysis 研究配置界面",
                caption: "定题配置",
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
              "能做：基于公开网页检索（Tavily）+ 大模型分章生成纵向/横向/交汇章节；14 条规则 QA；未通过章节 Actor-Critic 定向重写。",
              "不能做：不替代实地调研与保密内幕；不保证实时股价/未公开融资；PDF 导出为 Node.js Puppeteer 排版。",
              "定稿：用户确认后手动「存入 Notion」，非自动全量同步。",
              "模型：主生成 DeepSeek；QA/Refine 可选 Claude/Gemini 经 gptsapi 中转。",
            ]}
          />
        </PrdCallout>
      </PrdSection>

      <PrdSection id="features" title="二、功能定义">
        <PrdSubheading>功能矩阵</PrdSubheading>
        <PrdTable
          headers={["模块", "用户价值", "要点"]}
          rows={[
            ["分章流式", "突破上下文", project.features[0]!.body],
            ["质检 + 修订", "提升可用率", project.features[1]!.body],
            ["Notion 资产化", "可复用研报", project.features[2]!.body],
          ]}
        />
        <PrdSubheading>用户交互流程</PrdSubheading>
        <PrdParagraph>{project.flow.replace(/🌟\s*/g, "")}</PrdParagraph>
        <PrdList items={[project.star.action, project.star.result]} />
        <ProjectDetailFigure
          src="/images/hv-analysis/page.png"
          alt="HV 研究流水线界面"
          caption="定题 → 流式生成 → QA"
        />
        <PrdSubheading>边界与容错</PrdSubheading>
        <PrdList
          items={[
            "超长报告分章 SSE 输出，突破单次上下文上限。",
            "质检未通过可触发 /api/hv-refine 重写后再 QA。",
            "历史舱 GET /api/hv-history 恢复正文与 QA JSON。",
          ]}
        />
      </PrdSection>

      <PrdSection id="metrics" title="三、效果展示">
        <PrdSubheading>量化指标与验收</PrdSubheading>
        <PrdTable
          headers={["指标", "说明"]}
          rows={[
            ["篇幅", "纵向约 6k–15k 字，横向约 3k–10k 字，总计可达 1–3 万字"],
            ["质检", "14 条军规，含叙事体、竞品深度、套话比例等"],
            ["归档", "Notion 保留 Score、QA_Data、CreatedAt 等元数据"],
            ["导出", "Markdown 下载；PDF 一键导出（Puppeteer）"],
          ]}
        />
        <ProjectDetailFigure
          size="large"
          src="/images/hv-analysis/score.png"
          alt="14 条军规 QA 质检评分面板"
          caption="军规质检 · QA Inspector（综合得分 / 逐项 pass-fail）"
        />
        <PrdSubheading id="data-requirements">数据要求（AI 产品 PRD 必填）</PrdSubheading>
        <PrdList
          items={[
            "输入：研究对象、类型、动机、竞品、时间范围；Tavily 检索素材注入各章 Prompt。",
            "输出：分章 Markdown；QA 结果 JSON；Notion 研报库字段映射（见 README）。",
            "非训练：规则化 QA rubric + Prompt 约束，无离线标注训练。",
          ]}
        />
        <PrdSubheading id="bad-cases">Bad Case 定义与处理（AI 产品 PRD 必填）</PrdSubheading>
        <PrdTable
          headers={["Bad Case", "处理策略"]}
          rows={[
            ["检索素材不足", "质检提示缺口；用户调整定题或竞品范围"],
            ["单章 QA 未通过", "定向 Refine 该章后 re-QA"],
            ["流式中断", "前端保留已生成章节；可重跑"],
            ["Notion 保存失败", "本地 Markdown 仍可下载"],
          ]}
        />
      </PrdSection>

      <PrdSection id="tech" title="四、技术选择">
        <PrdSubheading>模型选择</PrdSubheading>
        <PrdTable
          headers={["场景", "模型"]}
          rows={[
            ["主报告生成", "DeepSeek"],
            ["QA / Refine", "Claude Sonnet / Gemini Flash（经 gptsapi，可选）"],
            ["检索", "Tavily"],
          ]}
        />
        <PrdSubheading>数据处理</PrdSubheading>
        <PrdParagraph>{project.technical}</PrdParagraph>
        <PrdSubheading>系统架构</PrdSubheading>
        <ProjectPrdArchitectureDiagram
          code={HV_ARCHITECTURE}
          caption="定题 → 检索 → 分章生成 → QA → Notion"
        />
      </PrdSection>

      <PrdSection id="lessons" title="五、学到的经验">
        <PrdList
          items={[
            "分章流式比一次性生成万字文更可控，用户可先读已完成章节。",
            "规则化 QA 比纯「感觉不错」更适合研报类产品。",
            "横纵交汇章节是方法论差异化，需在 Prompt 层单独强化。",
          ]}
        />
      </PrdSection>

      <PrdSection id="roadmap" title="六、将来迭代计划">
        <PrdTable
          headers={["方向", "内容"]}
          rows={[
            ["协作", "多人共读研报批注"],
            ["模板", "行业/公司类型预设 Prompt"],
            ["自动化", "定时跟踪对象增量章节"],
          ]}
        />
      </PrdSection>

      <div className="holo-card rounded-2xl p-6 sm:p-8">
        <ProjectDetailActions startHref={project.startHref} />
      </div>
    </ProjectPrdShell>
  );
}
