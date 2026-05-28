/** 特色项目全链路图 · 与 Job Engine 图示结构对齐 */

export type PipelineTone =
  | "violet"
  | "cyan"
  | "neutral"
  | "emerald"
  | "amber"
  | "blue"
  | "fuchsia"
  | "rose";

export type PipelineNode = {
  title: string;
  subtitle?: string;
  tone?: PipelineTone;
};

export type PipelinePath = {
  title: string;
  body: string;
  tone: PipelineTone;
};

export type ProjectPipeline = {
  label: string;
  entry: PipelineNode;
  router: PipelineNode;
  paths: readonly PipelinePath[];
  footer?: PipelineNode;
};
