"use client";

import type { FeaturedProject } from "@/lib/featured-projects";
import { ProjectPipelineDiagram } from "@/components/ProjectPipelineDiagram";

const PROSE = "text-sm leading-relaxed text-bento-text/90 break-words [overflow-wrap:anywhere]";
const PROSE_TIGHT =
  "text-[13px] leading-relaxed text-bento-text/90 break-words [overflow-wrap:anywhere]";

function FeaturesTable({ project }: { project: FeaturedProject }) {
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03] sm:mt-8">
      <table className="w-full border-collapse">
        <tbody>
          {project.features.map((f, idx) => (
            <tr
              key={f.title}
              className={idx < project.features.length - 1 ? "border-b border-white/[0.08]" : ""}
            >
              <th className="w-[34%] px-4 py-3.5 text-left align-top text-[13px] font-semibold leading-snug text-bento-text sm:px-5 sm:text-sm">
                {f.title}
              </th>
              <td className="px-4 py-3.5 align-top sm:px-5">
                <p className={PROSE_TIGHT}>{f.body}</p>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** 右侧栏：核心流 + 全链路图 + 特性表（概述与标签在配图下方） */
export function FeaturedProjectDetailContent({ project }: { project: FeaturedProject }) {
  return (
    <div className="min-w-0">
      <p className={PROSE}>{project.flow}</p>
      <ProjectPipelineDiagram pipeline={project.pipeline} />
      <FeaturesTable project={project} />
    </div>
  );
}
