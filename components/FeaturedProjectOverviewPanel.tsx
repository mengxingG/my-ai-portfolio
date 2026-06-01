"use client";

import type { FeaturedProject } from "@/lib/featured-projects";
import {
  featuredTechPillClass,
  resolveProjectTechItems,
} from "@/lib/featured-project-tech-stack";

const OVERVIEW_TEXT =
  "text-[13px] leading-[2.05] text-bento-text/88 break-words [overflow-wrap:anywhere] sm:text-sm";
const BRACKET_TAG_CLASS = "font-semibold text-purple-300/90";

function BracketParagraph({ label, children }: { label: string; children: string }) {
  return (
    <p className={OVERVIEW_TEXT}>
      <span className={BRACKET_TAG_CLASS}>[{label}]</span> {children}
    </p>
  );
}

export function FeaturedProjectOverviewPanel({ project }: { project: FeaturedProject }) {
  const techItems = resolveProjectTechItems(project.tech);

  return (
    <div className="mt-4 border-t border-white/[0.06] pt-5">
      <div className="flex flex-wrap gap-1.5">
        {techItems.map(({ name, category }) => (
          <span key={name} className={featuredTechPillClass(category)}>
            {name}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-[0.65em]">
        <BracketParagraph label="情境">{project.star.situation}</BracketParagraph>
        <BracketParagraph label="任务">{project.star.task}</BracketParagraph>
        <BracketParagraph label="行动">{project.star.action}</BracketParagraph>
        <BracketParagraph label="结果">{project.star.result}</BracketParagraph>
        <BracketParagraph label="技术实现">{project.technical}</BracketParagraph>
      </div>
    </div>
  );
}
