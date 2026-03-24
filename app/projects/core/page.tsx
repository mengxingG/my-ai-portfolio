export const metadata = {
  title: "核心项目 · 金融合规智能助手",
  description: "金融合规智能助手项目详情：目标用户与痛点、核心业务模块、底层架构设计",
};

export default function CoreProjectPage() {
  return (
    <>
      <h1
        className="text-2xl font-semibold text-slate-50"
        style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
      >
        核心项目 · 金融合规智能助手
      </h1>
      <p className="mt-2 text-sm text-slate-500">
        目标用户与痛点 · 核心业务模块 · 底层架构设计
      </p>

      <div className="mt-8 space-y-8">
        <section className="holo-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300/90">
            项目概览
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            面向金融机构合规 / 内控 / 审计团队的智能助手，通过 RAG 与多 Agent
            编排，把复杂的法规体系与内部规则，转译成可检索、可追溯、可审计的问答与工作流系统。
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="holo-card rounded-2xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">
              目标用户与痛点
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>· 合规 / 内控：法规口径不一致，解释高度依赖专家</li>
              <li>· 业务 / 产品：新规频出，需求评审难以快速对齐边界</li>
              <li>· 审计：缺少完整证据链与可复核记录，复盘成本高</li>
            </ul>
          </div>
          <div className="holo-card rounded-2xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">
              核心业务模块
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>· 法规知识库：条款拆解、标签与版本管理</li>
              <li>· 合规问答：回答同时给出条款、解释口径与案例引用</li>
              <li>· 审计工作台：对话留痕、结论复核、审计报告导出</li>
            </ul>
          </div>
          <div className="holo-card rounded-2xl p-5">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-cyan-300/90">
              底层架构设计
            </h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-300">
              <li>· RAG：法规切片 + 向量检索 + 结构化引用格式</li>
              <li>· Agent：工具调用编排、权限控制与操作审计</li>
              <li>· 证据链：来源 / 版本 / 置信度 / 决策日志全记录</li>
            </ul>
          </div>
        </section>
      </div>
    </>
  );
}

