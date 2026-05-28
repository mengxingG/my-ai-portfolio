"use client";

import type {
  PipelineNode,
  PipelinePath,
  PipelineTone,
  ProjectPipeline,
} from "@/lib/featured-project-pipeline";

const TONE: Record<
  PipelineTone,
  { border: string; bg: string; title: string; ring?: string }
> = {
  violet: {
    border: "border-violet-500/30",
    bg: "bg-violet-950/25",
    title: "text-violet-300/95",
  },
  cyan: {
    border: "border-cyan-500/25",
    bg: "bg-cyan-950/20",
    title: "text-cyan-400/90",
  },
  neutral: {
    border: "border-white/15",
    bg: "bg-white/[0.06]",
    title: "text-cyan-400/90",
  },
  emerald: {
    border: "border-emerald-500/25",
    bg: "bg-emerald-950/20",
    title: "text-emerald-400/90",
  },
  amber: {
    border: "border-amber-500/30",
    bg: "bg-amber-950/20",
    title: "text-amber-300/95",
    ring: "ring-1 ring-amber-500/20",
  },
  blue: {
    border: "border-blue-500/25",
    bg: "bg-blue-950/20",
    title: "text-blue-300/95",
  },
  fuchsia: {
    border: "border-fuchsia-500/25",
    bg: "bg-fuchsia-950/20",
    title: "text-fuchsia-300/95",
  },
  rose: {
    border: "border-rose-500/25",
    bg: "bg-rose-950/20",
    title: "text-rose-300/95",
  },
};

function FlowArrow() {
  return (
    <div className="flex justify-center text-bento-muted/50" aria-hidden>
      <span className="text-lg leading-none">↓</span>
    </div>
  );
}

function PipelineBox({
  node,
  centered,
  wide,
}: {
  node: PipelineNode;
  centered?: boolean;
  wide?: boolean;
}) {
  const tone = node.tone ?? "neutral";
  const s = TONE[tone];

  return (
    <div
      className={[
        "rounded-2xl border p-3",
        s.border,
        s.bg,
        s.ring ?? "",
        centered ? "mx-auto max-w-md text-center" : "",
        wide ? "w-full" : "",
      ].join(" ")}
    >
      <p
        className={[
          "text-[10px] font-semibold uppercase tracking-wider",
          tone === "neutral" ? s.title : s.title,
        ].join(" ")}
      >
        {node.title}
      </p>
      {node.subtitle ? (
        <p className="mt-2 text-[11px] leading-snug text-bento-text/90">{node.subtitle}</p>
      ) : null}
    </div>
  );
}

function PathCard({ path }: { path: PipelinePath }) {
  const s = TONE[path.tone];
  return (
    <div className={["rounded-xl border p-3", s.border, s.bg, s.ring ?? ""].join(" ")}>
      <p className={["text-[10px] font-semibold", s.title].join(" ")}>{path.title}</p>
      <p className="mt-2 text-[10px] leading-snug text-bento-text/85">{path.body}</p>
    </div>
  );
}

export function ProjectPipelineDiagram({ pipeline }: { pipeline: ProjectPipeline }) {
  const pathCols =
    pipeline.paths.length >= 4
      ? "sm:grid-cols-2 xl:grid-cols-4"
      : pipeline.paths.length === 3
        ? "sm:grid-cols-3"
        : "sm:grid-cols-2";

  return (
    <div className="mt-6 space-y-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-bento-muted/70">
        {pipeline.label}
      </p>
      <PipelineBox node={pipeline.entry} centered />
      <FlowArrow />
      <PipelineBox node={pipeline.router} wide />
      <FlowArrow />
      <div className={["grid gap-2", pathCols].join(" ")}>
        {pipeline.paths.map((p) => (
          <PathCard key={p.title} path={p} />
        ))}
      </div>
      {pipeline.footer ? (
        <>
          <FlowArrow />
          <PipelineBox node={pipeline.footer} centered wide />
        </>
      ) : null}
    </div>
  );
}
