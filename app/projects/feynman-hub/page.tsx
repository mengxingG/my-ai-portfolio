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
import { FEYNMAN_PRD_NAV } from "@/lib/featured-project-prd-nav";
import { getFeaturedProjectById } from "@/lib/featured-projects";
import { FEYNMAN_ARCHITECTURE } from "@/lib/project-prd-diagrams";

const project = getFeaturedProjectById("feynman-hub")!;

export const metadata = {
  title: "费曼学习工具 · 产品 PRD",
  description:
    "NotebookLM 风格双栏学习：Gemini 解析与费曼对话，DeepSeek 模拟面试，掌握度与复习写回 Notion。",
};

export default function FeynmanHubProjectPage() {
  return (
    <ProjectPrdShell nav={FEYNMAN_PRD_NAV}>
      <div id="top" className="scroll-mt-24 space-y-6">
        <ProjectDetailHeader
          kicker="AI 产品 PRD"
          title={project.title}
          description="AI 驱动的主动学习系统：材料导入与结构化拆解、费曼 5 轮复述、AI 面试官压力测试、艾宾浩斯复习与 ADHD 友好启动设计。学习数据写回用户 Notion，而非锁在聊天窗口。"
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
                src: "/images/feynman-hub/learning-fullview.png",
                alt: "费曼学习双栏界面",
                caption: "学习 + 费曼对话",
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
              "能做：Gemini 解析材料生成大纲/大白话/Mermaid；费曼 5 轮引导复述；DeepSeek 模拟面试与评分；掌握度与复习队列写回 Notion。",
              "不能做：不替代正式学位课程考核；面试模拟基于已导入材料，非全行业通用题库。",
              "ADHD 设计：只奖励不惩罚，中断不扣分；「只学 5 分钟」降低启动门槛。",
              "双模型分工：解析/费曼用 Gemini Flash；面试/评分用 DeepSeek，非单一模型包办。",
            ]}
          />
        </PrdCallout>
      </PrdSection>

      <PrdSection id="features" title="二、功能定义">
        <PrdSubheading>功能矩阵</PrdSubheading>
        <PrdTable
          headers={["模块", "用户价值", "要点"]}
          rows={[
            ["学 + 考双引擎", "理解 vs 表达", project.features[0]!.body],
            ["Notion 沉淀", "数据归属用户", project.features[1]!.body],
            ["ADHD 友好", "降低启动成本", project.features[2]!.body],
          ]}
        />
        <PrdSubheading>用户交互流程</PrdSubheading>
        <PrdParagraph>{project.flow.replace(/🌟\s*/g, "")}</PrdParagraph>
        <PrdList items={[project.star.action, project.star.result]} />
        <div className="space-y-8">
          <ProjectDetailFigure
            size="large"
            src="/images/feynman-hub/ai-outlines.png"
            alt="AI 大纲与概念拆解"
            caption="材料解析 → 概念图"
          />
          <ProjectDetailFigure
            size="large"
            src="/images/feynman-hub/interview-report.png"
            alt="AI 模拟面试评分报告"
            caption="模拟面试 · 评分与盲点反馈"
          />
        </div>
        <PrdSubheading>边界与容错</PrdSubheading>
        <PrdList
          items={[
            "费曼与面试模式串联但不混用 UI，避免用聊天代替测评。",
            "答错进入复习队列，由间隔重复算法生成待练列表。",
            "API 密钥仅存服务端 Route，前端不暴露 Key。",
          ]}
        />
      </PrdSection>

      <PrdSection id="metrics" title="三、效果展示">
        <PrdSubheading>量化指标与验收</PrdSubheading>
        <PrdTable
          headers={["指标", "说明"]}
          rows={[
            ["掌握度", "0–100 分，按对话质量评估"],
            ["复习间隔", "1 / 3 / 7 / 14 / 30 天艾宾浩斯曲线"],
            ["热力图", "90 天学习活跃度 GitHub 风格"],
            ["费曼框架", "固定 5 轮追问梯度"],
          ]}
        />
        <div className="mt-8 space-y-8">
          <ProjectOverviewImageRow
            size="large"
            images={[
              {
                src: "/images/feynman-hub/dashboard.png",
                alt: "学习 Dashboard 掌握度与热力图",
                caption: "掌握度画像 · 90 天热力图",
              }
            ]}
          />
        </div>
        <PrdSubheading id="data-requirements">数据要求（AI 产品 PRD 必填）</PrdSubheading>
        <PrdList
          items={[
            "输入：PDF / 视频文稿 / 粘贴文本；用户 Notion 工作区凭据。",
            "输出：会话记录、掌握度、费曼笔记、复习计划写回 Notion API。",
            "结构化：面试评分报告（得分、盲点、建议）；Mermaid 思维导图节点可点击进费曼。",
            "非训练：Prompt 驱动双模型，无自有标注训练集。",
          ]}
        />
        <PrdSubheading id="bad-cases">Bad Case 定义与处理（AI 产品 PRD 必填）</PrdSubheading>
        <PrdTable
          headers={["Bad Case", "处理策略"]}
          rows={[
            ["Gemini 解析失败", "提示重试或缩短材料"],
            ["面试回答模糊", "追问具体化，非直接给答案"],
            ["Notion 写入失败", "会话仍可在前端继续，稍后重试同步"],
            ["用户中断学习", "正计时无惩罚，欢迎回来提示"],
          ]}
        />
      </PrdSection>

      <PrdSection id="tech" title="四、技术选择">
        <PrdSubheading>模型选择</PrdSubheading>
        <PrdTable
          headers={["场景", "模型"]}
          rows={[
            ["解析 / 费曼", "Gemini 2.5 Flash"],
            ["面试 / 评分", "DeepSeek Chat"],
            ["前端", "Next.js 15 + Vercel AI SDK 流式"],
          ]}
        />
        <PrdSubheading>数据处理</PrdSubheading>
        <PrdParagraph>{project.technical}</PrdParagraph>
        <PrdSubheading>系统架构</PrdSubheading>
        <ProjectPrdArchitectureDiagram
          code={FEYNMAN_ARCHITECTURE}
          caption="学 → 考 → 复习闭环，Notion 为数据中台"
        />
      </PrdSection>

      <PrdSection id="lessons" title="五、学到的经验">
        <PrdList
          items={[
            "Prompt 即产品：5 轮费曼框架需反复迭代才稳定。",
            "双模型分工平衡成本与效果（Flash 高频 + DeepSeek 推理）。",
            "数据在 Notion 侧是降低迁移成本、提高留存的关键。",
          ]}
        />
      </PrdSection>

      <PrdSection id="roadmap" title="六、将来迭代计划">
        <PrdTable
          headers={["方向", "内容"]}
          rows={[
            ["材料", "更多视频源解析优化"],
            ["社交", "学习小组/分享卡片"],
            ["宠物", "PokeFocusPet 更多激励形态"],
          ]}
        />
      </PrdSection>

      <div className="holo-card rounded-2xl p-6 sm:p-8">
        <ProjectDetailActions startHref={project.startHref} />
      </div>
    </ProjectPrdShell>
  );
}
