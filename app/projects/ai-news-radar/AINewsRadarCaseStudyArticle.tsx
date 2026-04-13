import Link from "next/link";

const sectionEyebrow =
  "text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300/90";

const techTags = [
  "FastAPI",
  "Python",
  "Coze",
  "Make.com",
  "DeepSeek",
  "GPT-4o",
  "Notion API",
  "Render",
  "Next.js",
] as const;

const tocItems = [
  { id: "situation", label: "Situation｜背景" },
  { id: "task", label: "Task｜目标" },
  { id: "action", label: "Action｜方案" },
  { id: "result", label: "Result｜成果" },
  { id: "links", label: "相关链接" },
  { id: "epilogue", label: "写在最后" },
] as const;

export function AINewsRadarCaseStudyArticle() {
  return (
    <div className="relative lg:grid lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start lg:gap-6">
      <article className="space-y-10">
        <header className="holo-card rounded-2xl p-6 sm:p-8">
          <p className={sectionEyebrow}>Case Study</p>
          <h1
            className="mt-3 text-2xl font-semibold leading-tight text-slate-50 sm:text-3xl md:text-4xl"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            AI News Radar：用异构双引擎构建抗脆弱的情报系统
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-400">
            异构双引擎（FastAPI + Coze）· Make.com 中枢调度 · Notion Headless CMS · Next.js 实时渲染
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/ai-news" className="glow-btn glow-btn--primary glow-btn--resume inline-flex">
              体验 Demo →
            </Link>
            <a
              href="https://github.com/mengxingG/ai-news-update"
              target="_blank"
              rel="noopener noreferrer"
              className="glow-btn glow-btn--secondary inline-flex"
            >
              查看 GitHub →
            </a>
            <Link href="/#projects" className="glow-btn glow-btn--secondary inline-flex">
              返回首页项目区
            </Link>
            <img src="/image/news-dashboard.png" alt="AI News Radar" width={1000} height={500} />
          </div>
          <div className="mt-6 flex flex-wrap gap-2">
            {techTags.map((t) => (
              <span
                key={t}
                className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-0.5 font-mono text-[11px] text-slate-300"
              >
                {t}
              </span>
            ))}
          </div>
        </header>

        <section id="situation" className="scroll-mt-24 holo-card rounded-2xl p-6 sm:p-8">
          <h2 className={`${sectionEyebrow} text-purple-200/90`}>🌍 Situation｜背景与困境</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            作为一名深耕 Agentic Workflow 的 AI 产品经理，对前沿技术的敏锐嗅觉是我的核心竞争力。但 2026 年的 AI
            资讯环境让「保持敏锐」变得极其昂贵：
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-relaxed text-slate-400">
            <li>
              <span className="font-medium text-slate-300">信息碎片化加剧：</span>
              真正的 Alpha 信号分散在 X 上 10 位 KOL 的零散动态、Hacker News 的长篇技术辩论、Polymarket
              的预测市场、YouTube 长视频字幕、以及中英文科技媒体之间。
            </li>
            <li>
              <span className="font-medium text-slate-300">工具链两极分化：</span>
              传统 RSS 只能搬运，缺乏语义理解；AI 聚合产品（Bensbites、Smol AI 等）口径偏英文、更新频次固定、无法个性化。
            </li>
            <li>
              <span className="font-medium text-slate-300">单点风险：</span>
              任何一个「一体化」方案都是脆弱的——API 限流、平台宕机、网络封锁，都会让情报链断流。
            </li>
          </ul>
          <p className="mt-4 text-sm font-medium text-slate-200">核心痛点</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            每天花 30-40 分钟人工巡逻 5-6 个信息源，仍然会错过关键信号。且一旦某天没时间浏览，知识债务会滚雪球式增长。
          </p>
        </section>

        <section id="task" className="scroll-mt-24 holo-card rounded-2xl p-6 sm:p-8">
          <h2 className={`${sectionEyebrow} text-purple-200/90`}>🎯 Task｜目标与约束</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            构建一个<strong className="text-slate-100">完全自动化、抗单点故障、中英文双语、每日高频更新</strong>
            的个人 AI 情报系统。
          </p>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">硬性目标</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-400">
            <li>日均采集 30+ 条高信噪比资讯</li>
            <li>100% 自动化，零人工干预</li>
            <li>中文摘要（DeepSeek 级质量）</li>
            <li>每日至少 2 次主动更新，而非被动等待</li>
            <li>前端即时可见（&lt; 2 分钟数据时延）</li>
          </ul>
          <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">软性约束</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-slate-400">
            <li>运维成本 &lt; $1/月</li>
            <li>代码可迭代（区别于纯 SaaS 黑盒）</li>
            <li>能在个人网站上展示代码与无代码两种范式的取舍</li>
          </ul>
          <p className="mt-6 text-sm leading-relaxed text-slate-300">
            <span className="font-medium text-slate-200">最关键的约束：</span>
            我自己既是开发者又是唯一用户，不能用「团队协作」的方案来绕过真正的技术决策难点。
          </p>
        </section>

        <section id="action" className="scroll-mt-24 holo-card rounded-2xl p-6 sm:p-8">
          <h2 className={`${sectionEyebrow} text-purple-200/90`}>🛠️ Action｜行动方案</h2>

          <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-400">
            <div>
              <h3 className="text-base font-semibold text-cyan-200">第 1 步：识别「不可调和的矛盾」，决定用异构双引擎</h3>
              <p className="mt-3 text-slate-400">
                在架构设计初期，我先尝试了单一方案——纯 Coze 无代码覆盖全部数据源。结果撞上现实墙：
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>
                  <span className="font-medium text-slate-300">YouTube 字幕解析：</span>
                  Coze 在长文本提取时频繁 Timeout
                </li>
                <li>
                  <span className="font-medium text-slate-300">评论树遍历：</span>
                  Hacker News 的 500+ 评论线程让 Coze 节点内存溢出
                </li>
                <li>
                  <span className="font-medium text-slate-300">防爬虫与 API 成本：</span>
                  X 官方 API 定价飙升至 $5,000/月 量级，无代码平台只能靠 Google Search 间接获取
                </li>
              </ul>
              <p className="mt-3 text-slate-400">
                同时，纯代码方案也不可行——纯 Python 方案开发周期长，无法快速响应「某天想加个新博主」这类需求。
              </p>
              <p className="mt-3 font-medium text-slate-200">
                结论：用两套工具各司其职，而不是强行让一种范式覆盖全部需求。
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cyan-200">第 2 步：Engine A — 社区共识引擎（Python + FastAPI）</h3>
              <p className="mt-3 text-slate-300">
                <span className="font-medium text-slate-200">负责：</span>
                深度与厚度 — 长文本、长字幕、评论树、跨源打分
              </p>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>基于开源项目 mvanhorn/last30days-skill 改造为 FastAPI 微服务</li>
                <li>三源精简：HN / Polymarket / YouTube（字幕级）</li>
                <li>Render Web Service 部署，Make.com 每天 09:30 AM HTTP POST 触发</li>
                <li>LLM 层从 Gemini 切换到 DeepSeek（因部分地区访问 Gemini gRPC 不稳定）</li>
                <li>每源独立 60 秒超时，单源故障不拖死主管线</li>
              </ul>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500">关键代码决策</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>修复 SubQuery（frozen dataclass）的 FrozenInstanceError，改为 rebuild 而非原地修改</li>
                <li>加入 LLM_PROVIDER 环境变量，一键切换 Gemini / DeepSeek / OpenAI（抗供应商锁定）</li>
                <li>输出严格 JSON Array（字段与下游一致）供 Make.com Iterator 直接消费</li>
              </ul>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 p-5">
                  <h4 className="text-sm font-semibold text-cyan-200">Engine A：社区共识（Consensus Layer）</h4>
                  <p className="mt-2 text-xs font-medium uppercase tracking-wider text-slate-500">数据源</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-400">
                    <li>Hacker News：前沿讨论 + 顶级评论提取</li>
                    <li>Polymarket：预测市场对 AI 事件的下注信号</li>
                    <li>YouTube：Matt Wolfe / AI Explained / The Rundown 等头部频道字幕级解析</li>
                  </ul>
                  <p className="mt-3 text-xs text-slate-500">触发：每日 9:30 AM · Make.com 定时 HTTP POST</p>
                </div>
                <div className="liquid-glass-card rounded-xl border border-white/10 bg-black/25 p-5">
                  <h4 className="text-sm font-semibold text-cyan-200">与 Engine B 的分工</h4>
                  <p className="mt-2 text-sm text-slate-400">
                    A 侧扛「厚」任务：长文本、重 IO、确定性超时与重试；B 侧扛「灵」任务：领袖动态、中文媒体、RSS
                    快讯与快速改 Query。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cyan-200">第 3 步：Engine B — 领袖动态引擎（Coze 工作流）</h3>
              <p className="mt-3 text-slate-300">
                <span className="font-medium text-slate-200">负责：</span>
                速度与破壁 — 领袖动态、中文媒体、RSS 快讯
              </p>
              <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">五条并行采集通道</p>
              <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-black/25">
                <table className="min-w-full text-left text-sm text-slate-300">
                  <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="px-3 py-2">通道</th>
                      <th className="px-3 py-2">Query</th>
                      <th className="px-3 py-2">覆盖</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-200">X 领袖通道</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        (sama OR elonmusk OR karpathy OR ylecun OR AndrewYNg OR DrJimFan OR philschmid OR rohanpaul OR
                        bindureddy OR AravSrinivas) AI site:x.com
                      </td>
                      <td className="px-3 py-2 text-slate-400">10 位 AI KOL</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-200">模型发布通道</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        (&quot;GPT-5&quot; OR &quot;Claude&quot; OR &quot;Gemini&quot; OR &quot;Grok&quot; OR
                        &quot;DeepSeek&quot;) release site:x.com
                      </td>
                      <td className="px-3 py-2 text-slate-400">大模型发布事件</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-200">中文媒体通道</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        (&quot;DeepSeek&quot; OR &quot;阶跃星辰&quot; OR &quot;大模型发布&quot; OR
                        &quot;通用人工智能&quot;) AND (site:36kr.com OR site:geekpark.net OR site:huxiu.com OR
                        site:jiqizhixin.com)
                      </td>
                      <td className="px-3 py-2 text-slate-400">四大中文科技媒体</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-200">YouTube 视频通道</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        (&quot;AI news&quot; OR &quot;Sora&quot; OR &quot;GPT&quot; OR &quot;Claude&quot;) (&quot;The
                        Rundown AI&quot; OR &quot;AI Explained&quot; OR &quot;Matt Wolfe&quot;)
                      </td>
                      <td className="px-3 py-2 text-slate-400">头部英文频道</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 font-medium text-slate-200">RSS 38氪通道</td>
                      <td className="px-3 py-2 text-xs text-slate-400">
                        RSS 监听 + 关键词过滤（放行 AI 关键词、排除汽车/股市噪音）
                      </td>
                      <td className="px-3 py-2 text-slate-400">中文快讯兜底</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="mt-4 text-slate-400">
                <span className="font-medium text-slate-300">错峰调度：</span>
                每天 10:42 AM 定时触发（与 Engine A 的 09:30 错开，降低集中限流风险，上午与中午各有一批新信号）。
              </p>
              <p className="mt-2 text-slate-400">
                <span className="font-medium text-slate-300">清洗层：</span>
                GPT-4o 统一格式化为与 Engine A 一致的字段结构，实现下游无感知合并。
              </p>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cyan-200">第 4 步：中枢调度 + 统一存储 + 前端渲染</h3>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-slate-300">
                {`09:30 AM ──► Engine A (FastAPI) ──┐
                                  ├──► Make.com 统一入库 ──► Notion DB ──► Next.js
10:42 AM ──► Engine B (Coze) ─────┘

TimeRange 字段：24h / 周 / 月`}
              </pre>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>
                  <span className="font-medium text-slate-300">Make.com：</span>
                  中枢神经。接收双引擎 JSON Array → Iterator 拆分 → 逐条写入 Notion（URL 去重）
                </li>
                <li>
                  <span className="font-medium text-slate-300">Notion：</span>
                  Headless CMS。Title / Source / Author / URL / OriginalText / Date / TimeRange 等字段统一建模
                </li>
                <li>
                  <span className="font-medium text-slate-300">Next.js：</span>
                  个人网站前端直连 Notion API，按 TimeRange 做三级时间切片展示
                </li>
              </ul>

              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">端到端架构示意</p>
              <pre className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-xs leading-relaxed text-slate-300">
                {`09:30 AM                              10:42 AM
   |                                     |
   v                                     v
+-----------------+                  +------------------+
|  Make.com 定时   |                  |  Coze 工作流      |
|  HTTP POST 触发  |                  |  (5 节点并发)     |
+--------+--------+                  +--------+---------+
         |                                    |
         v                                    v
+-----------------+                  +------------------+
|  FastAPI 微服务  |                  | GoogleWebSearch  |
|  (Render 部署)   |                  | YouTube / RSS    |
|  |- HN 抓取      |                  |  |- X KOL 通道   |
|  |- Polymarket   |                  |  |- 模型发布通道  |
|  '- YouTube 字幕 |                  |  |- 中文媒体通道  |
+--------+--------+                  |  |- YouTube 通道 |
         |                           |  '- RSS 38氪通道 |
         +-----------+---------------+--------+---------+
                     |                        |
                     +-----------+------------+
                                 |
                                 v
                      +----------------------+
                      |  DeepSeek / GPT-4o   |
                      |  双语清洗 + 摘要      |
                      |  + 去重 + 打分        |
                      +----------+-----------+
                                 |
                                 v
                      +----------------------+
                      |  Notion Database     |
                      |  (Headless CMS)      |
                      |  + TimeRange 分级    |
                      +----------+-----------+
                                 |
                                 v
                      +----------------------+
                      |  Next.js 前端        |
                      |  (Vercel)            |
                      |  三级时间切片渲染     |
                      +----------------------+`}
              </pre>

              <h4 className="mt-6 text-sm font-semibold text-cyan-200">数据流转四阶段</h4>
              <ol className="mt-3 space-y-3 text-slate-300">
                <li>
                  <span className="font-medium text-slate-200">1. 分布式采集：</span>
                  异构双引擎在 9:30 与 10:42 错峰唤醒，最大化降低 API 限流概率。
                </li>
                <li>
                  <span className="font-medium text-slate-200">2. 清洗与规范化：</span>
                  格式化为统一的 JSON Array（Title, Source, Author, URL, OriginalText, Date, TimeRange）。
                </li>
                <li>
                  <span className="font-medium text-slate-200">3. 中央调度：</span>
                  Make.com 拦截双引擎数据，执行去重逻辑，统一写入 Notion。
                </li>
                <li>
                  <span className="font-medium text-slate-200">4. 前端渲染：</span>
                  Next.js 直连 Notion API，实现全自动的「抓取-打分-发布」闭环。
                </li>
              </ol>
            </div>

            <div>
              <h3 className="text-base font-semibold text-cyan-200">第 5 步：优雅降级 + 抗脆弱设计</h3>
              <ul className="mt-3 list-disc space-y-1.5 pl-5">
                <li>单引擎挂掉 → 另一引擎仍在供数</li>
                <li>YouTube yt-dlp 失败 → 自动回退到 HTTP 直抓</li>
                <li>DeepSeek API 限流 → 单条摘要失败不阻塞其他条目（可占位「摘要生成中」）</li>
                <li>Notion 写入失败 → 错误日志记录，下次重试</li>
              </ul>
              <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-slate-500">产品侧能力（与工程降级配套）</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>
                  <span className="font-medium text-slate-300">多维度时间切片：</span>
                  日更 / 周榜 / 月度精选，TimeRange 标签 + 前端 Tab 切换
                </li>
                <li>
                  <span className="font-medium text-slate-300">零信息损失的中文化：</span>
                  英文原推 → 中文标题 + 约 200 字摘要 + 保留原文 URL；重要术语保留英文（GPT-5、Gemini 等）
                </li>
                <li>
                  <span className="font-medium text-slate-300">Headless 可复制：</span>
                  Notion 作为唯一源，Web / 小程序 / Newsletter 均可复用同一套 API
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section id="result" className="scroll-mt-24 holo-card rounded-2xl p-6 sm:p-8">
          <h2 className={`${sectionEyebrow} text-purple-200/90`}>📈 Result｜成果与复盘</h2>

          <h3 className="mt-6 text-sm font-semibold text-cyan-200">量化成果</h3>
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-black/25">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-white/5 text-xs uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-3 py-2">指标</th>
                  <th className="px-3 py-2">数字</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">日均入库条数</td>
                  <td className="px-3 py-2 text-slate-400">30-50 条</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">自动化率</td>
                  <td className="px-3 py-2 text-slate-400">100%</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">数据时延</td>
                  <td className="px-3 py-2 text-slate-400">抓取到入库 &lt; 2 分钟</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">运维成本</td>
                  <td className="px-3 py-2 text-slate-400">&lt; $0.5 / 月（Render 免费层 + DeepSeek 按量）</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">时间节省</td>
                  <td className="px-3 py-2 text-slate-400">从 40 分钟/天 → 0 分钟/天</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">单日更新次数</td>
                  <td className="px-3 py-2 text-slate-400">2 次（9:30 AM + 10:42 AM）</td>
                </tr>
                <tr>
                  <td className="px-3 py-2 font-medium text-slate-200">数据源覆盖</td>
                  <td className="px-3 py-2 text-slate-400">
                    8 个（HN + PM + YouTube×2 + X×2 + 中文媒体 + 38氪）
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="mt-8 text-sm font-semibold text-cyan-200">质量验证</h3>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-400">
            <li>
              <span className="font-medium text-slate-300">可读性：</span>
              DeepSeek 生成的中文摘要保留重要英文术语（GPT-5、Gemini），不生硬翻译
            </li>
            <li>
              <span className="font-medium text-slate-300">准确性：</span>
              手动抽查 50 条，信号正确率 94%（3 条过期、0 条错误归类）
            </li>
            <li>
              <span className="font-medium text-slate-300">覆盖度：</span>
              和 Bensbites、Smol AI 等英文日报对比，本系统多出约 30% 的中文信号与 X 原生讨论
            </li>
          </ul>

          <h3 className="mt-8 text-sm font-semibold text-cyan-200">复盘：三个反直觉的决策</h3>
          <div className="mt-4 space-y-4 text-sm text-slate-400">
            <p>
              <span className="font-medium text-slate-200">1. 为什么不用一个工具全搞定？</span>
              <br />
              无代码平台在「稳定性优先」任务上有天花板，代码平台在「灵活性优先」任务上太重。我没有选「更好的那个」，而是承认
              <strong className="text-slate-300">两者各自的边界</strong>
              ，用两套工具分别覆盖各自擅长的领域。
            </p>
            <p>
              <span className="font-medium text-slate-200">2. 为什么不追求实时？</span>
              <br />
              每天 2 次定时足够——AI 圈真正重要的信号不会在 30 分钟内变质，而实时会带来指数级的 API 成本和去重复杂度。在「时效性」和「成本/稳定性」之间，我选了后者。
            </p>
            <p>
              <span className="font-medium text-slate-200">3. 为什么用 Notion 而不是自建数据库？</span>
              <br />
              Notion 作为 Headless CMS 零运维，自带 Web 界面便于手动审阅/置顶/归档。若未来接移动端 App 或 Newsletter，Notion API
              直连即可，前端换马甲不改后端。
            </p>
          </div>

          <h3 className="mt-8 text-sm font-semibold text-cyan-200">对未来的启发</h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            这个项目的本质产出不是「一个资讯工具」，而是<strong className="text-slate-300">在真实业务中验证了异构架构的可行性</strong>
            。作为 AI PM，我现在面对客户需求时，会更冷静地问：
          </p>
          <blockquote className="mt-4 border-l-2 border-purple-400/50 pl-4 text-sm italic leading-relaxed text-slate-300">
            「这个需求是『灵活优先』还是『稳定优先』？这两种特性能在一个工具里并存吗？如果不能，我们接受异构的复杂度，还是接受单一工具的缺陷？」
          </blockquote>
          <p className="mt-4 text-sm text-slate-500">
            这是我从 AI News Radar 学到的最有价值的一课。
          </p>
        </section>

        <section id="links" className="scroll-mt-24 holo-card rounded-2xl p-6 sm:p-8">
          <h2 className={`${sectionEyebrow} text-purple-200/90`}>🔗 相关链接</h2>
          <ul className="mt-4 space-y-3 text-sm text-cyan-300">
            <li>
              <a
                href="https://github.com/mengxingG/ai-news-update"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-cyan-200 hover:underline"
              >
                GitHub：github.com/mengxingG/ai-news-update
              </a>
              <span className="ml-2 text-slate-500">— Engine A 完整代码与部署文档</span>
            </li>
            <li>
              <Link href="/ai-news" className="hover:text-cyan-200 hover:underline">
                Notion 情报库实时查看
              </Link>
            </li>
            <li>
              <Link href="/" className="hover:text-cyan-200 hover:underline">
                返回首页项目区
              </Link>
            </li>
          </ul>
        </section>

        <section
          id="epilogue"
          className="scroll-mt-24 holo-card rounded-2xl border border-purple-500/20 bg-gradient-to-br from-purple-500/[0.07] via-transparent to-cyan-500/[0.05] p-6 sm:p-8"
        >
          <h2 className={sectionEyebrow}>💬 写在最后</h2>
          <p className="mt-4 text-sm leading-relaxed text-slate-300">
            这个项目不是为了解决「我要看 AI 新闻」这个需求——这个需求 RSS 都能解决。它是我作为 AI PM 对「Agentic Workflow
            落地」的一份实战答卷：
            <strong className="text-slate-100">当无代码的优雅撞上真实世界的泥泞时，一个好的产品经理应该怎么决策？</strong>
          </p>
          <p className="mt-4 text-sm leading-relaxed text-slate-400">
            异构双引擎不是「折中」，而是「取舍」。这是我想传递的核心产品观。
          </p>
        </section>
      </article>

      <aside className="hidden lg:block">
        <nav className="sticky top-24 holo-card rounded-2xl border border-white/10 bg-black/30 p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">目录导航</p>
          <ul className="mt-3 space-y-2">
            {tocItems.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-200"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </div>
  );
}
