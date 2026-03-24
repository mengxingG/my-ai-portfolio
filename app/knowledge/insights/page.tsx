export const metadata = {
  title: "资讯收集 | 龚梦星",
  description: "行业动态、工具链与 RAG/Agent 相关资讯的筛选与整理",
};

export default function InsightsPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
        资讯收集
      </h1>
      <p className="mt-2 text-sm text-slate-500">行业动态与工具链 · 筛选与整理</p>

      <div className="mt-10 space-y-8">
        <section className="knowledge-holo rounded-2xl p-6 sm:p-8">
          <h2 className="text-base font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            收集范围
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-slate-400">
            <li>· RAG、向量数据库、Agent 框架的更新与最佳实践</li>
            <li>· 合规、审计、金融科技方向的监管与案例</li>
            <li>· 视频/音频转写、知识库工具链的新产品与开源项目</li>
            <li>· AI 产品方法论与可解释性、可审计设计</li>
          </ul>
        </section>

        <section className="knowledge-holo rounded-2xl p-6 sm:p-8">
          <h2 className="text-base font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            整理方式
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            按主题与时间归档，标注来源、关键结论与可落地点；重要内容会提炼成「可执行要点」或并入 AI 知识模块的实践总结。此处后续会以列表或卡片形式持续更新精选资讯。
          </p>
        </section>

        <section className="liquid-glass-card rounded-xl p-5">
          <p className="text-sm text-slate-500">
            更多条目整理中，敬请期待。若有推荐来源或话题，欢迎通过首页「小龙虾 AI 助手」反馈。
          </p>
        </section>
      </div>
    </>
  );
}
