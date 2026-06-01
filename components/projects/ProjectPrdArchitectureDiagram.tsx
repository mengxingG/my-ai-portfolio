"use client";

import { MermaidSimple } from "@/app/components/MermaidSimple";

const diagramFrameClass =
  "flex min-h-[220px] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 px-3 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_40px_rgba(0,0,0,0.35)] sm:min-h-[280px] sm:px-4 sm:py-6";

const diagramFrameRowClass =
  "flex min-h-[280px] w-full items-center justify-center overflow-x-auto rounded-2xl border border-white/[0.08] bg-black/20 px-4 py-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_40px_rgba(0,0,0,0.35)] sm:min-h-[340px] sm:px-6 sm:py-8";

const diagramMermaidClass =
  "w-full min-h-[180px] border-0 bg-transparent p-0 sm:min-h-[220px]";

const diagramMermaidRowClass =
  "w-full min-w-[640px] min-h-[240px] border-0 bg-transparent p-0 sm:min-h-[300px] [&_svg]:min-h-[220px] sm:[&_svg]:min-h-[280px]";

export function ProjectPrdArchitectureDiagram({
  code,
  caption,
}: {
  code: string;
  caption?: string;
}) {
  return (
    <figure className="w-full" aria-label="系统架构图">
      <div className={diagramFrameClass}>
        <MermaidSimple code={code} fitContainer className={diagramMermaidClass} />
      </div>
      {caption ? (
        <figcaption className="mt-2 text-center text-xs text-slate-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}

/** 多行架构图：每行独立一张 Mermaid，适合双路径分开展示 */
export function ProjectPrdArchitectureDiagramRows({
  rows,
  caption,
}: {
  rows: ReadonlyArray<{ title: string; code: string }>;
  caption?: string;
}) {
  return (
    <figure className="w-full space-y-8" aria-label="系统架构图">
      {rows.map((row) => (
        <div key={row.title} className="space-y-3">
          <p className="text-sm font-medium text-slate-300">{row.title}</p>
          <div className={diagramFrameRowClass}>
            <MermaidSimple code={row.code} fitContainer className={diagramMermaidRowClass} />
          </div>
        </div>
      ))}
      {caption ? (
        <figcaption className="text-center text-xs text-slate-500">{caption}</figcaption>
      ) : null}
    </figure>
  );
}
