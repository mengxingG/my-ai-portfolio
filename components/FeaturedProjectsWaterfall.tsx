"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import type { FeaturedProject } from "@/lib/featured-projects";
import { FEATURED_PROJECTS } from "@/lib/featured-projects";
import { FeaturedProjectDetailContent } from "@/components/FeaturedProjectDetailContent";
import { FeaturedProjectOverviewPanel } from "@/components/FeaturedProjectOverviewPanel";

const btnBase =
  "inline-flex min-h-[2.35rem] flex-1 items-center justify-center rounded-xl px-3 py-2 text-center text-[11px] font-medium leading-tight transition-all duration-300 ease-out sm:text-xs";

const btnDetail = `${btnBase} border border-blue-500/40 bg-blue-500/12 text-blue-100 hover:border-blue-400/55 hover:bg-blue-500/22 hover:text-white`;

const btnStart = `${btnBase} border border-blue-400/50 bg-blue-600/28 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)] hover:border-blue-300/60 hover:bg-blue-500/38 hover:shadow-[0_0_28px_rgba(59,130,246,0.28)]`;

const itemVariants = {
  hidden: { opacity: 0, y: 40 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
  },
};

function NavButton({
  href,
  external,
  label,
  className,
  disabled,
}: {
  href: string;
  external?: boolean;
  label: string;
  className: string;
  disabled?: boolean;
}) {
  if (disabled) {
    return (
      <span
        className={`${btnBase} cursor-not-allowed border border-white/[0.06] bg-white/[0.02] text-bento-muted/40`}
        aria-disabled="true"
      >
        {label}
      </span>
    );
  }

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {label}
      </a>
    );
  }

  return (
    <Link href={href} className={className}>
      {label}
    </Link>
  );
}

function ProjectActionButtons({ project }: { project: FeaturedProject }) {
  const caseStudyDisabled = project.caseStudyHref === "#";

  return (
    <div className="mt-8 flex gap-2.5 border-t border-white/[0.08] pt-6">
      <NavButton
        href={project.caseStudyHref}
        external={project.caseStudyExternal}
        label="项目详情"
        className={btnDetail}
        disabled={caseStudyDisabled}
      />
      <NavButton
        href={project.startHref}
        external={project.startExternal}
        label="开始使用"
        className={btnStart}
      />
    </div>
  );
}

function ProjectTitleHeader({ project }: { project: FeaturedProject }) {
  const Icon = project.icon;

  return (
    <header className="mb-5 sm:mb-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="reflect-section-kicker">{project.category}</span>
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-purple-400/30 bg-purple-500/10 text-purple-200/90"
          aria-hidden
        >
          <Icon className="h-4 w-4" strokeWidth={1.75} />
        </span>
      </div>
      <h3
        className="mt-3 text-xl font-bold tracking-tight text-bento-text sm:text-2xl"
        style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
      >
        {project.title}
      </h3>
    </header>
  );
}

function ProjectVisualColumn({ project }: { project: FeaturedProject }) {
  return (
    <div className="flex min-w-0 flex-col lg:sticky lg:top-24 lg:self-start">
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_16px_40px_rgba(0,0,0,0.35)] transition-shadow duration-500 group-hover/card:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_24px_56px_rgba(0,0,0,0.45)]">
        <Image
          src={project.image.src}
          alt={project.image.alt}
          width={project.image.width ?? 1200}
          height={project.image.height ?? 720}
          className="h-auto w-full object-cover object-top transition-transform duration-700 ease-out group-hover/card:scale-[1.02]"
          sizes="(max-width: 1024px) 100vw, 50vw"
        />
      </div>
      <FeaturedProjectOverviewPanel project={project} />
    </div>
  );
}

function FeaturedProjectRow({
  project,
  imageOnRight,
  reducedMotion,
}: {
  project: FeaturedProject;
  imageOnRight: boolean;
  reducedMotion: boolean;
}) {
  return (
    <motion.article
      id={`featured-project-${project.id}`}
      variants={itemVariants}
      whileHover={
        reducedMotion
          ? undefined
          : {
              y: -8,
              scale: 1.006,
              transition: { type: "spring", stiffness: 420, damping: 28 },
            }
      }
      className="featured-apple-card group/card mb-10 scroll-mt-28 last:mb-0 sm:mb-12"
    >
      <div className="featured-apple-card__sheen pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />

      <div className="relative p-5 sm:p-7 lg:p-8">
        <ProjectTitleHeader project={project} />

        <div
          className={[
            "grid items-start gap-6 lg:grid-cols-2 lg:gap-px",
            imageOnRight ? "lg:[direction:rtl] lg:*:[direction:ltr]" : "",
          ].join(" ")}
        >
          <ProjectVisualColumn project={project} />

          <div className="relative z-10 min-w-0">
            <FeaturedProjectDetailContent project={project} />
            <ProjectActionButtons project={project} />
          </div>
        </div>
      </div>
    </motion.article>
  );
}

type Props = {
  className?: string;
  projects?: FeaturedProject[];
};

export function FeaturedProjectsWaterfall({
  className = "",
  projects = FEATURED_PROJECTS,
}: Props) {
  const reducedMotion = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.05 }}
      variants={{ show: { transition: { staggerChildren: 0.12 } } }}
    >
      {projects.map((project, index) => (
        <FeaturedProjectRow
          key={project.id}
          project={project}
          imageOnRight={index % 2 === 1}
          reducedMotion={reducedMotion ?? false}
        />
      ))}
    </motion.div>
  );
}

export type { FeaturedProject };
