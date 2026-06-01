import { ProjectDetailActions } from "@/components/projects/ProjectDetailActions";
import { ProjectImagePlaceholder } from "@/components/projects/ProjectImagePlaceholder";
import { JobEngineArchitectureDiagram } from "@/components/projects/JobEngineArchitectureDiagram";
import {
  ProjectDetailFigure,
  ProjectOverviewImageRow,
} from "@/components/projects/ProjectOverviewImageRow";
import { ProjectDetailHeader } from "@/components/projects/ProjectDetailProse";
import {
  PrdCallout,
  PrdList,
  PrdParagraph,
  PrdSection,
  PrdSubheading,
  PrdTable,
  ProjectPrdShell,
} from "@/components/projects/ProjectPrdLayout";
import { getFeaturedProjectById } from "@/lib/featured-projects";
import { JOB_ENGINE_PRD_NAV } from "@/lib/job-engine-prd-nav";

const project = getFeaturedProjectById("job-engine")!;

export const metadata = {
  title: "Job Engine · 产品 PRD",
  description:
    "AI 产品经理求职 OS：九路岗位采集、DeepSeek 五维评分、Notion 数据中台、飞书 ChatOps 与 OpenClaw 可溯源背调。",
};

export default function JobEngineProjectPage() {
  return (
    <ProjectPrdShell nav={JOB_ENGINE_PRD_NAV}>
      <div id="top" className="scroll-mt-24 space-y-6">
      <ProjectDetailHeader
        kicker="AI 产品 PRD"
        title={project.title}
        description="简洁版产品说明文档：面向 AI PM 求职场景的个人岗位情报系统。日常操作以飞书为中枢，数据沉淀在 Notion，看板用于 Web/Electron 阅读。"
      >
        <ProjectDetailActions
          startHref={project.startHref}
          startExternal={project.startExternal}
        />
      </ProjectDetailHeader>

      <section aria-label="产品总览">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90">
          产品总览
        </p>
        <ProjectOverviewImageRow
          images={[
            {
              src: "/images/interview-os/feishu-interview.png",
              alt: "飞书 ChatOps：菜单指令与岗位简报",
              caption: "飞书操作台",
            },
            {
              src: "/images/interview-os/dashborad.png",
              alt: "岗位看板：列表与数据可视化",
              caption: "岗位看板",
            },
          ]}
        />
      </section>
      </div>

      {/* 一、产品概述 */}
      <PrdSection id="overview" title="一、产品概述">
        <PrdSubheading>业务背景</PrdSubheading>
        <PrdParagraph>
          求职旺季需同时跟踪 BOSS 直聘、猎聘及多家 AI 公司官网岗位；情报分散在多个站点，手动背调耗时长。历史上若用 Cron
          定时并发跑多路浏览器爬虫，曾导致本机内存溢出。目标是构建「采集 → AI 评估 → 结构化沉淀 → 移动端可操作」的闭环，服务
          AI 产品经理（约 4 年技术背景 + AI 产品经验）的个人求职。
        </PrdParagraph>

        <PrdSubheading>产品目标</PrdSubheading>
        <PrdList
          items={[
            "一条指令（飞书）完成单平台/全量采集、今日简报、指定公司深度背调。",
            "岗位 JD 与 AI 五维评分、匹配分析统一写入 Notion，支持 URL 去重与增量更新。",
            "Web / Electron 看板从 Notion 读取，支持筛选、地图分布与背调长文阅读。",
            "取消默认 Cron 全量并发，改为飞书按需串行调度，降低 OOM 与风控风险。",
          ]}
        />

        <PrdCallout id="ai-boundary" title="AI 能力边界（AI 产品 PRD 必填）">
          <PrdList
            items={[
              "能做：基于固定候选人画像（见 ai_matcher.py）对 JD 做五维 0–100 评分与优劣势分析；对 Notion 已有岗位做 24h 简报提炼；在用户明确给出公司名时，经 OpenClaw job-insight 联网检索并合成背调报告。",
              "不能做：不替代人工投递与面试决策；菜单「深度背调」本身不启动 Agent，须自然语言带公司名；背调结论不能脱离可溯源来源（须 web 取证，避免纯 LLM 臆测）。",
              "不负责：AI 资讯六条菜单由 my-ai-portfolio Node 卡片引擎处理，在网关层最高优先级拦截，不进入求职 route_intent。",
              "评分非训练模型：岗位匹配为 DeepSeek 单次推理 + Prompt，非离线训练；候选人画像写在 Prompt 中，换画像需改配置而非「自动学习」。",
            ]}
          />
        </PrdCallout>
      </PrdSection>

      {/* 二、功能定义 */}
      <PrdSection id="features" title="二、功能定义">
        <PrdSubheading>功能矩阵</PrdSubheading>
        <PrdTable
          headers={["模块", "用户价值", "算法 / 逻辑要点"]}
          rows={[
            [
              "多平台采集",
              "九路渠道岗位入库",
              "DrissionPage（BOSS/猎聘）或 Playwright（官网）；列表 keyword 过滤 + 公司黑名单；纯净 URL 全局去重；原子写入 openclaw_jobs.json",
            ],
            [
              "JD 深抓",
              "完整职责与要求",
              "API 拦截优先 → DOM → inner_text 三通道；拟人休眠/滚动；失败记入 failed_jobs_inbox.md",
            ],
            [
              "AI 五维评分",
              "优先级排序",
              "DeepSeek JSON 输出：匹配度 30%、薪资 25%、地点 15%、发展 15%、团队 15%；档位 90+/80+/60+/<60",
            ],
            [
              "Notion 同步",
              "唯一事实源",
              "URL 查重后 PATCH/SKIP；Match Score / Reasons 等字段映射；指数退避最多 3 次",
            ],
            [
              "飞书 ChatOps",
              "手机端运营",
              "WebSocket 长连接；message_id 去重；全局爬虫互斥锁；后台线程 subprocess 不阻塞收消息",
            ],
            [
              "今日简报",
              "24h 新岗位速览",
              "Notion created_time 24h + Discovered Date 兜底；不限 Match Score；最多 20 条；DeepSeek 提炼 15 字内匹配点",
            ],
            [
              "OpenClaw 背调",
              "可溯源公司情报",
              "查 Notion 该公司 JD → job-insight web 检索 → DeepSeek 合成 → replace_report_blocks；飞书仅 2 条摘要 + 链接",
            ],
            [
              "岗位看板",
              "可视化复盘",
              "ai-pm-job-dashboard：地图/列表/评分分布；读 Notion（非直连爬虫）",
            ],
          ]}
        />

        <PrdSubheading>用户交互流程</PrdSubheading>
        <PrdParagraph>
          主路径：飞书发令 → feishu_gateway 路由 →（采集｜简报｜背调）→ Notion 写入 → 看板/飞书卡片阅读。
        </PrdParagraph>
        <PrdList
          items={[
            "采集：「抓取 BOSS 直聘」等单平台指令，或「全面抓取」串行 9 脚本 → 可选 openclaw_bridge → notion_sync → 每平台结果卡片。",
            "简报：「今日简报」→ query_notion_recent_24h → generate_briefing_report → 飞书早报卡片（无数据时仍推保活卡片）。",
            "背调：「帮我背调一下 {公司}」→ 后台线程 OpenClaw + DeepSeek → Notion 岗位页报告区替换 → 飞书极简摘要。",
            "阅读：浏览器打开岗位看板（startHref）查看 JD、分数与背调全文。",
          ]}
        />
        <ProjectDetailFigure
          src="/images/interview-os/feishu.png"
          alt="飞书指令与网关路由：采集、简报与背调交互"
          caption="飞书指令 → 网关路由 → Notion / 看板"
        />

        <PrdSubheading>边界与容错</PrdSubheading>
        <PrdList
          items={[
            "路由优先级：停止/取消 → 菜单引导 → 九平台爬虫 → 自然语言背调 → 简报 → 兜底；AI 资讯菜单在 route_intent 之前转发 Node。",
            "并发：同一时刻仅一个抓取批次（全局互斥）；全面抓取失败单平台跳过继续。",
            "环境：脚本强制 conda run -n job_env；桥接前检查 JSON 体积（小于 1KB 禁止写入，见 .clinerules）。",
            "登录：BOSS/猎聘首次需扫码，Cookie 存本地 Chrome Profile；官网 Moka 类一般无需登录。",
            "长文：背调全文只在 Notion，飞书不承载万字报告。",
          ]}
        />
      </PrdSection>

      {/* 三、效果展示 */}
      <PrdSection id="metrics" title="三、效果展示">
        <PrdSubheading>量化指标与验收（功能 + 效果）</PrdSubheading>
        <PrdTable
          headers={["指标", "验收方式", "说明"]}
          rows={[
            ["渠道覆盖", "9 平台脚本可独立触发", "BOSS、猎聘、字节、小红书、DeepSeek、月之暗面、智谱、MiniMax、阿里；腾讯 crawler 可选未纳入默认九路"],
            ["去重", "同 URL 跨日只评分一次", "processed_jobs.txt / history_jobs.json + Notion URL 查重，节省 DeepSeek Token"],
            ["评分结构", "每条岗位输出合法 JSON", "score + match_reasons + mismatch_reasons + summary + jd_summary_structured"],
            ["简报时效", "24h 入库岗位可查", "飞书简报不限分数；CLI daily_briefing.py 默认仍可筛 Match Score ≥80（与网关策略不同）"],
            ["简报上限", "单次最多展示 20 条", "按入库时间降序"],
            ["背调触发", "无公司名仅返回引导", "菜单「深度背调」「背调指南」不启动 OpenClaw"],
            [
              "消息幂等",
              "重复 message_id 不重复执行",
              "processed_message_ids 为 maxlen=1000 的 deque，append 写入；满额时 FIFO 逐条淘汰最老 ID（不再全量清空）；in deque 去重，n≤1000 线性扫描可接受",
            ],
            ["可用性", "网关长连接不阻塞", "耗时抓取/背调在后台线程 + subprocess"],
          ]}
        />

        <PrdSubheading id="data-requirements">数据要求（AI 产品 PRD 必填）</PrdSubheading>
        <PrdList
          items={[
            "输入数据：各平台列表/详情页抓取的 JD 原文（full_jd、requirements）、岗位元数据（公司、薪资、地点、URL）；背调额外输入 Notion 中该公司在招 JD + OpenClaw 联网检索结果。",
            "标注 / 结构化：AI 输出固定 JSON Schema（见 ai_matcher.py）；Notion 字段含 Match Score、Match Reasons、Mismatch Reasons、URL 等（见 notion_sync.py）。",
            "中间态：data/openclaw_jobs.json 为爬虫汇总主文件；openclaw_bridge 读取后批量评分再同步。",
            "过滤规则：blacklist.txt 公司黑名单；列表阶段产品经理 keyword 过滤；BOSS 学历低于本科前置丢弃。",
            "非训练数据：无离线标注集；候选人画像为 Prompt 内嵌 CANDIDATE_PROFILE，调整画像即改 Prompt。",
          ]}
        />

        <PrdSubheading id="bad-cases">Bad Case 定义与处理（AI 产品 PRD 必填）</PrdSubheading>
        <PrdTable
          headers={["Bad Case", "预期表现", "处理策略"]}
          rows={[
            ["DeepSeek 评分 API 失败", "该岗位 score=0，summary 标明评估失败", "ai_matcher 返回 _fallback_result，不阻断整批同步"],
            ["简报 AI 提炼失败", "早报仍发出", "使用默认匹配点兜底文案"],
            ["OpenClaw 检索失败", "背调仍尽可能完成", "备用新闻源 + targets.json 官网 URL；有降级则飞书巡检告警卡片"],
            ["爬虫 DOM/CSS 失效", "仍尽量拿到 JD 文本", "inner_text 全文降级；截图存 screenshots/"],
            ["单平台爬虫崩溃", "其余平台继续", "全面抓取失败跳过；记录 failed_jobs_inbox.md"],
            ["飞书消息重传", "不重复抓/背调", "message_id 去重"],
            ["资讯文案误触背调", "不启动背调", "AI HOT 六菜单优先 POST Node，不进入 route_intent"],
            ["并发抓取 OOM", "机器不被拖垮", "取消默认 Cron；飞书侧串行 + 全局互斥锁"],
            ["Notion API 抖动", "最终一致", "指数退避重试最多 3 次"],
            ["猎聘风控/登录", "暂停并提示人工", "检测登录重定向、短信验证关键词，等待扫码"],
          ]}
        />
      </PrdSection>

      {/* 四、技术选择 */}
      <PrdSection id="tech" title="四、技术选择">
        <PrdSubheading>模型选择</PrdSubheading>
        <PrdTable
          headers={["场景", "模型", "参数 / 说明"]}
          rows={[
            ["岗位五维评分", "DeepSeek（OpenAI 兼容 API）", "temperature 等见 ai_matcher / openclaw_bridge 调用；强制 JSON 结构输出"],
            ["简报匹配点提炼", "DeepSeek", "每岗约 15 字以内；失败走模板兜底"],
            ["背调报告合成", "DeepSeek", "结合 OpenClaw 检索结果 + Notion JD"],
            ["外部情报采集", "OpenClaw Agent", "job-insight 技能：web_search / web_fetch；job-monitor 可选写入 openclaw_jobs.json"],
          ]}
        />

        <PrdSubheading>数据处理</PrdSubheading>
        <PrdList
          items={[
            "采集层：DrissionPage（BOSS/猎聘，直连 Notion）；Playwright（官网）；requests（腾讯，脚本存在但 scheduler 默认关闭）。",
            "标准化：三方平台用 job_model.JobItem；官网 crawler 输出 dict，按 URL 增量合并写入 data/openclaw_jobs.json（非严格原子写）。",
            "评估层：官网经 openclaw_bridge.py 逐条 evaluate_job；BOSS/猎聘在 spider 内直接 evaluate_job。",
            "持久层：notion_sync.sync_job 以 URL 为主键（存在则更新）；背调报告经 Markdown→Blocks + replace_report_blocks 锚点替换。",
            "展示层：Next.js / Electron 看板读 Notion；飞书 lark-oapi WebSocket + interactive 卡片。",
          ]}
        />

        <PrdSubheading>系统架构</PrdSubheading>
        <PrdParagraph>
          Python 仓库（job_engine）承担爬虫、网关、桥接；my-ai-portfolio 承担资讯卡片 Node（:3001）与岗位看板前端。双引擎联调：npm run
          feishu-local-api + ./start_feishu.sh。
        </PrdParagraph>
        <JobEngineArchitectureDiagram />
      </PrdSection>

      {/* 五、学到的经验 */}
      <PrdSection id="lessons" title="五、学到的经验">
        <PrdList
          items={[
            "ChatOps 优于盲目 Cron：求职爬虫资源重，「飞书按需 + 串行」比定时全量并发更可控。",
            "AI 能力要划边界：背调必须用户显式公司名 + 联网溯源；菜单项只做引导，避免误唤醒 Agent。",
            "多产品共用一个飞书机器人时，资讯指令必须高于求职 route_intent，否则关键词串线。",
            "飞书适合摘要，Notion 适合长文：背调报告写 Block 锚点，移动端只看两条情报。",
            "抓取范式：URL 主键幂等、原子写 JSON、CSS 失效 inner_text 降级，比「一次跑完再保存」抗崩溃。",
            "CLI 与网关策略可分化：daily_briefing 可筛高分；飞书「今日简报」按入库时间不限分——产品上要写清差异，避免自己误解需求。",
          ]}
        />
      </PrdSection>

      {/* 六、将来迭代计划 */}
      <PrdSection id="roadmap" title="六、将来迭代计划">
        <PrdTable
          headers={["方向", "内容", "备注"]}
          rows={[
            ["调度", "服务器无人值守时用 PM2 / 单实例 crontab", "README 标注慎用多浏览器并发 crontab"],
            ["渠道", "腾讯 API 爬虫纳入飞书「全面抓取」九路计划", "crawler_tencent.py 已存在，默认未启用"],
            ["看板", "岗位看板 RAG 问答增强", "ai-pm-job-dashboard 已有知识库/RAG 设计文档，可产品化到 UI"],
            [
              "运营",
              "简报/背调飞书卡片版式对比试验",
              "在现有卡片上试不同排版（如条目密度、是否带导读区），非已上线的「A/B 功能」",
            ],
            ["质量", "评分 Prompt 与候选人画像配置化", "减少改代码发版，仍保持非训练推理架构"],
          ]}
        />
        <PrdParagraph>
          以上为基于当前仓库能力的规划项；上线节奏与优先级按个人求职运营反馈调整。
        </PrdParagraph>
      </PrdSection>

      <div className="holo-card rounded-2xl p-6 sm:p-8">
        <ProjectDetailActions
          startHref={project.startHref}
          startExternal={project.startExternal}
        />
      </div>
    </ProjectPrdShell>
  );
}
