import { AINewsRadarCaseStudyArticle } from "./AINewsRadarCaseStudyArticle";

export const metadata = {
  title: "AI News Radar · Case Study",
  description:
    "用异构双引擎（FastAPI + Coze）构建抗脆弱情报系统：STAR 复盘、Make.com 调度、Notion Headless CMS 与 Next.js 实时渲染。",
};

export default function AINewsRadarCaseStudyPage() {
  return <AINewsRadarCaseStudyArticle />;
}
