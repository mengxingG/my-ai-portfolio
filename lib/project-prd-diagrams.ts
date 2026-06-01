const AI_NEWS_CLASS = `
  classDef api fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe
  classDef store fill:#14532d,stroke:#4ade80,color:#dcfce7
  classDef web fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe
  classDef feishu fill:#1e1b4b,stroke:#a78bfa,color:#e9d5ff
`.trim();

/** 路径一：网站阅读（单独一行大图） */
export const AI_NEWS_ARCHITECTURE_WEB = `
flowchart LR
  HOT_W["AI HOT 公开 API"]
  FN["fetch-news<br/>定时入库"]
  NT[("Notion<br/>精选库")]
  PAGE["/ai-news 网页<br/>精选 · 全部 · 标星"]
  DAILY_W["日报 Tab<br/>直连官方 · 不经 Notion"]
  HOT_W --> FN --> NT --> PAGE
  HOT_W --> DAILY_W

${AI_NEWS_CLASS}
  class HOT_W,FN api
  class NT store
  class PAGE,DAILY_W web
`.trim();

/** 路径二：飞书卡片（单独一行大图） */
export const AI_NEWS_ARCHITECTURE_FEISHU = `
flowchart LR
  MENU["飞书底部菜单<br/>如「看精选条目」"]
  GW1["Python 门卫<br/>feishu_gateway"]
  NODE["Node :3001<br/>拉 AI HOT · 做卡片"]
  GW2["Python 门卫<br/>收 JSON 并发送"]
  CHAT["飞书聊天窗<br/>资讯卡片"]
  MENU --> GW1
  GW1 -->|① 资讯菜单优先<br/>不进求职/背调| NODE
  NODE -->|② 返回卡片 JSON| GW2
  GW2 -->|③ 飞书 API 推送| CHAT

${AI_NEWS_CLASS}
  class MENU,GW1,NODE,GW2,CHAT feishu
`.trim();

export const AI_NEWS_ARCHITECTURE_ROWS = [
  { title: "路径一：在网站 /ai-news 阅读", code: AI_NEWS_ARCHITECTURE_WEB },
  { title: "路径二：在飞书聊天里收资讯卡片", code: AI_NEWS_ARCHITECTURE_FEISHU },
] as const;

export const FEYNMAN_ARCHITECTURE = `
flowchart LR
  IN["材料导入<br/>PDF / 文本"]
  G["Gemini Flash<br/>解析 · 费曼"]
  D["DeepSeek<br/>模拟面试"]
  NT[("Notion 知识库")]
  DASH["Dashboard<br/>掌握度 · 复习"]

  IN --> G --> NT --> DASH
  IN --> G
  G --> D --> NT
  D -.->|薄弱点| DASH

  classDef in fill:#1e1b4b,stroke:#a78bfa,color:#e9d5ff
  classDef gem fill:#3b0764,stroke:#c084fc,color:#f3e8ff
  classDef ds fill:#4a1d6a,stroke:#e879f9,color:#fae8ff
  classDef store fill:#14532d,stroke:#4ade80,color:#dcfce7
  classDef out fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe

  class IN in
  class G gem
  class D ds
  class NT store
  class DASH out
`.trim();

export const INTERVIEW_OS_ARCHITECTURE = `
flowchart LR
  JD["JD / 简历输入"]
  QW["Qwen 3.7 Max<br/>简历完善"]
  CL["Claude Sonnet 4.6<br/>模拟面试"]
  DS["DeepSeek V4-Pro<br/>练习 · 刷题"]
  ST[("Notion 故事库")]
  RPT["复盘报告"]
  DASH["作战中枢"]

  JD --> QW --> ST
  ST --> CL --> RPT
  JD --> DS --> RPT
  RPT --> DASH

  classDef in fill:#1e1b4b,stroke:#a78bfa,color:#e9d5ff
  classDef qwen fill:#7c2d12,stroke:#fb923c,color:#ffedd5
  classDef claude fill:#3b0764,stroke:#c084fc,color:#f3e8ff
  classDef ds fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe
  classDef store fill:#14532d,stroke:#4ade80,color:#dcfce7
  classDef out fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe

  class JD in
  class QW qwen
  class CL claude
  class DS ds
  class ST store
  class RPT,DASH out
`.trim();

export const HV_ARCHITECTURE = `
flowchart LR
  CFG["定题配置"]
  TV["Tavily 检索"]
  DS["DeepSeek<br/>分章生成"]
  QA["14 条军规 QA"]
  RF["Claude 定向重写"]
  NT[("Notion 研报库")]
  OUT["导出 MD / PDF"]

  CFG --> TV --> DS --> QA --> NT --> OUT
  QA -.->|未通过| RF -.-> DS

  classDef cfg fill:#1e1b4b,stroke:#a78bfa,color:#e9d5ff
  classDef search fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe
  classDef gen fill:#3b0764,stroke:#c084fc,color:#f3e8ff
  classDef qa fill:#713f12,stroke:#fbbf24,color:#fef3c7
  classDef store fill:#14532d,stroke:#4ade80,color:#dcfce7

  class CFG cfg
  class TV search
  class DS,RF gen
  class QA qa
  class NT,OUT store
`.trim();
