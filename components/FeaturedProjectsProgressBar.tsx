"use client";

import { useCallback, useEffect, useState } from "react";
import type { FeaturedProject } from "@/lib/featured-projects";
import { FEATURED_PROJECTS } from "@/lib/featured-projects";

function projectAnchorId(id: string) {
  return `featured-project-${id}`;
}

type Props = {
  projects?: readonly FeaturedProject[];
  className?: string;
};

export function FeaturedProjectsProgressBar({
  projects = FEATURED_PROJECTS,
  className = "",
}: Props) {
  const [activeId, setActiveId] = useState(projects[0]?.id ?? "");

  const scrollToProject = useCallback((id: string) => {
    const el = document.getElementById(projectAnchorId(id));
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    setActiveId(id);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `#${projectAnchorId(id)}`);
    }
  }, []);

  useEffect(() => {
    const ids = projects.map((p) => projectAnchorId(p.id));
    const elements = ids
      .map((anchorId) => document.getElementById(anchorId))
      .filter((el): el is HTMLElement => Boolean(el));

    if (!elements.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        const top = visible[0]?.target.id;
        if (top) {
          const projectId = top.replace("featured-project-", "");
          setActiveId(projectId);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.15, 0.35, 0.55] },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [projects]);

  return (
    <nav
      className={["mt-6 sm:mt-8", className].filter(Boolean).join(" ")}
      aria-label="特色项目工作流进度"
    >
      <div className="relative overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <ol className="relative flex min-w-[min(100%,52rem)] gap-0 sm:min-w-0">
          {/* 连接线 */}
          <div
            className="pointer-events-none absolute left-[10%] right-[10%] top-[1.125rem] hidden h-px bg-gradient-to-r from-purple-500/20 via-cyan-400/35 to-purple-500/20 sm:block"
            aria-hidden
          />

          {projects.map((project, index) => {
            const active = activeId === project.id;
            const step = index + 1;
            return (
              <li key={project.id} className="relative flex min-w-[11.5rem] flex-1 flex-col items-stretch px-1 sm:min-w-0 sm:px-2">
                <button
                  type="button"
                  onClick={() => scrollToProject(project.id)}
                  className={[
                    "group flex w-full flex-col items-center text-left transition sm:items-stretch",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a12]",
                  ].join(" ")}
                  aria-current={active ? "step" : undefined}
                >
                  <span className="flex w-full flex-col items-center sm:flex-row sm:items-center sm:gap-2">
                    <span
                      className={[
                        "relative z-[1] flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-bold tabular-nums transition-all duration-300",
                        active
                          ? "border-cyan-400/70 bg-cyan-500/25 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
                          : "border-white/15 bg-white/[0.04] text-slate-400 group-hover:border-purple-400/40 group-hover:bg-purple-500/10 group-hover:text-purple-100",
                      ].join(" ")}
                    >
                      {step}
                    </span>
                    <span
                      className={[
                        "mt-2 line-clamp-2 text-center text-[11px] font-semibold leading-snug sm:mt-0 sm:text-left sm:text-xs",
                        active ? "text-cyan-100" : "text-slate-300 group-hover:text-slate-100",
                      ].join(" ")}
                    >
                      {project.title.split(" - ")[0]}
                    </span>
                  </span>

                  <span
                    className={[
                      "mt-2 hidden text-[11px] leading-relaxed sm:block",
                      active ? "text-slate-400" : "text-slate-500 group-hover:text-slate-400",
                    ].join(" ")}
                  >
                    {project.progressSummary}
                  </span>
                </button>

                {/* 移动端：描述始终展示在节点下方 */}
                <p className="mt-2 px-1 text-center text-[10px] leading-relaxed text-slate-500 sm:hidden">
                  {project.progressSummary}
                </p>
              </li>
            );
          })}
        </ol>
      </div>
    </nav>
  );
}

export { projectAnchorId };
