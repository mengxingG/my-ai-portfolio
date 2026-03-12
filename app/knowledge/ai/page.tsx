export const metadata = {
  title: "AI 知识 | 龚梦星",
  description: "视频转文本辅助学习、RAG 技术应用等实践总结与最佳实践",
};

export default function AIKnowledgePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
        AI 知识
      </h1>
      <p className="mt-2 text-sm text-slate-500">实践总结与最佳实践</p>

      <div className="mt-10 space-y-10">
        <article className="knowledge-holo rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            使用工具链进行视频转文本辅助学习
          </h2>
          <p className="mt-2 text-sm text-slate-500">从视频抓取、转写、分段到笔记与检索的端到端实践</p>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
            <p>
              用一套可复用的工具链把视频内容变成可检索、可标注的文本，是高效「视频学习」的基础。流程大致分为：获取音视频（下载/录屏）、转写（语音转文字）、分段与打时间戳、导入笔记或知识库并做检索与标签管理。
            </p>
            <p>
              <strong className="text-slate-300">推荐实践：</strong> 使用 Whisper 或云端 ASR 做转写，用 ffmpeg 按章节或固定时长切片；将文本与时间戳存入 Notion/Obsidian 或自建 RAG，便于按关键词跳转回原视频位置。对长课程可先做摘要再按主题拆成「知识点卡片」，方便后续与 RAG 结合做问答。
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="knowledge-tag">Whisper</span>
            <span className="knowledge-tag">ffmpeg</span>
            <span className="knowledge-tag">RAG</span>
          </div>
        </article>

        <article className="knowledge-holo rounded-2xl border border-cyan-500/20 bg-black/20 p-6 backdrop-blur-sm sm:p-8">
          <h2 className="text-lg font-semibold text-slate-50" style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}>
            RAG 技术应用最佳实践
          </h2>
          <p className="mt-2 text-sm text-slate-500">切片策略、检索排序、引用溯源与多源知识融合</p>
          <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-400">
            <p>
              <strong className="text-slate-300">切片策略：</strong> 按语义单元切（段落/条款/小节），避免断句；保留必要的上下文窗口；对法规、文档类做版本与条款 ID 管理，便于溯源。
            </p>
            <p>
              <strong className="text-slate-300">检索与排序：</strong> 向量检索 + 关键词/过滤条件（如文档类型、时间范围）；必要时做两阶段检索（粗排 + 精排）或 Hybrid Search；对高合规场景要控制 Top-K 与置信度阈值。
            </p>
            <p>
              <strong className="text-slate-300">引用与溯源：</strong> 每条回复绑定来源 chunk、文档、版本与页码/条款；在 UI 中展示「依据条款 X.X」并支持跳转；日志中记录检索到的片段与模型引用关系，满足审计需求。
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="knowledge-tag">RAG</span>
            <span className="knowledge-tag">向量检索</span>
            <span className="knowledge-tag">引用溯源</span>
          </div>
        </article>
      </div>
    </>
  );
}
