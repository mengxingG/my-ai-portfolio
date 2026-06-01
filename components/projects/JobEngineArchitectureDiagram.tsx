"use client";

import { ProjectPrdArchitectureDiagram } from "@/components/projects/ProjectPrdArchitectureDiagram";

const JOB_ENGINE_ARCHITECTURE = `
flowchart LR
  FS["飞书 ChatOps<br/>feishu_gateway.py"]
  SP["① 数据采集<br/>九路爬虫串行"]
  JSON[("openclaw_jobs.json")]
  BR["openclaw_bridge"]
  DS["② AI 评估<br/>DeepSeek 五维评分"]
  NT[("③ Notion<br/>notion_sync")]
  FC["④ 飞书回执"]
  DB["④ 岗位看板"]

  FS --> SP --> JSON --> BR --> DS --> NT --> FC
  NT --> DB
  FS <-.->|WebSocket| FC
  OC["OpenClaw<br/>job-insight"] -.->|背调报告| NT
  FS -.->|带公司名| OC

  classDef entry fill:#1e1b4b,stroke:#a78bfa,color:#e9d5ff
  classDef step fill:#0c4a6e,stroke:#38bdf8,color:#e0f2fe
  classDef data fill:#134e4a,stroke:#2dd4bf,color:#ccfbf1
  classDef ai fill:#3b0764,stroke:#c084fc,color:#f3e8ff
  classDef store fill:#14532d,stroke:#4ade80,color:#dcfce7
  classDef out fill:#1e3a5f,stroke:#60a5fa,color:#dbeafe

  class FS entry
  class SP step
  class JSON data
  class BR,DS,OC ai
  class NT store
  class FC,DB out
`.trim();

export function JobEngineArchitectureDiagram() {
  return (
    <ProjectPrdArchitectureDiagram
      code={JOB_ENGINE_ARCHITECTURE}
      caption="数据采集 → AI 评估 → Notion → 飞书 / 看板（主链路）；背调经 OpenClaw 写入 Notion 后摘要回飞书"
    />
  );
}
