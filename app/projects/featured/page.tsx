export const metadata = {
  title: "特色项目 · NotebookLM 工作流 & Agent 设计",
  description: "特色项目详情：NotebookLM 工作流实践与 Agent 决策逻辑设计",
};

export default function FeaturedProjectsPage() {
  return (
    <>
      <h1
        className="text-2xl font-semibold text-slate-50"
        style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
      >
        特色项目
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        NotebookLM 工作流实践 · Agent 决策逻辑设计
      </p>

      <div className="mt-8 space-y-8">
        <article className="holo-card rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-xl">
          <h2
            className="text-lg font-semibold text-slate-50"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            NotebookLM 工作流实践
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            多源资料导入、结构化知识图与 RAG pipeline 的端到端产品化实践。
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            通过 NotebookLM 式的「源文档 + 笔记」范式，把分散在视频、PDF、网页中的知识整理成可维护的知识图谱，将其作为 RAG
            的上游。重点在于划清「原始材料 / 中间笔记 / 最终产出」三层，并用模板化工作流保证复用性。
          </p>
        </article>

        <article className="holo-card rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-xl">
          <h2
            className="text-lg font-semibold text-slate-50"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            Agent 决策逻辑设计
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            多工具、多角色、多阶段的 Agent 决策图设计，兼顾自动化与可解释、可审计。
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            将复杂业务拆解为多阶段任务：识别意图与边界、选择合适工具链、执行并记录关键决策节点。通过显式决策图与日志，将每一步「为什么这么做」暴露给产品与合规团队，既能自动跑任务，又能在关键节点人工介入。
          </p>
        </article>
      </div>
    </>
  );
}

