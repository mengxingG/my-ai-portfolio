"use client";

import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseResumeMarkdown } from "@/lib/parse-resume-markdown";
import { linkifyResumeMarkdown } from "@/lib/resume-linkify";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold tracking-tight text-bento-text sm:text-3xl">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 text-lg font-semibold text-white first:mt-0 print:text-black">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-semibold text-violet-200/95 print:text-zinc-900">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-[13px] leading-[1.85] text-bento-text/88 sm:text-sm sm:leading-7">{children}</p>
  ),
  ul: ({ children }) => <ul className="mt-3 space-y-2">{children}</ul>,
  li: ({ children }) => (
    <li className="resume-bullet text-[13px] leading-relaxed text-bento-text/85 sm:text-sm">{children}</li>
  ),
  hr: () => <hr className="my-5 border-white/[0.08] print:border-zinc-300" />,
  strong: ({ children }) => (
    <strong className="font-semibold text-purple-300/90 print:text-zinc-900">{children}</strong>
  ),
  em: ({ children }) => <em className="italic text-bento-muted print:text-zinc-600">{children}</em>,
  a: ({ href, children }) => {
    const external = href?.startsWith("http");
    return (
      <a
        href={href}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        className="resume-link font-medium text-cyan-400 underline decoration-cyan-500/35 underline-offset-[3px] transition hover:text-cyan-300 hover:decoration-cyan-400/60 print:text-blue-700"
      >
        {children}
      </a>
    );
  },
};

function MarkdownBlock({ content }: { content: string }) {
  if (!content.trim()) return null;

  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {linkifyResumeMarkdown(content)}
    </ReactMarkdown>
  );
}

function ResumeSubCard({
  heading,
  body,
  accent,
}: {
  heading: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={[
        "rounded-2xl border p-5 sm:p-6",
        accent
          ? "border-purple-400/25 bg-purple-500/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
          : "bento-card border-white/[0.08] bg-white/[0.02]",
      ].join(" ")}
    >
      {heading ? (
        <h3
          className="text-base font-bold tracking-tight text-bento-text sm:text-lg"
          style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
        >
          {heading}
        </h3>
      ) : null}
      <div className={heading ? "mt-4" : ""}>
        <MarkdownBlock content={body} />
      </div>
    </div>
  );
}

function ResumeSectionCard({
  title,
  kicker,
  body,
  subsections,
}: {
  title: string;
  kicker: string;
  body: string;
  subsections: { heading: string; body: string }[];
}) {
  const hasSubCards = subsections.length > 1 || (subsections.length === 1 && subsections[0]?.heading);

  return (
    <article className="featured-apple-card group/card mb-8 scroll-mt-28 last:mb-0 sm:mb-10">
      <div className="featured-apple-card__sheen pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />
      <div className="relative p-5 sm:p-7 lg:p-8">
        <span className="reflect-section-kicker">{kicker}</span>
        <h2
          className="mt-3 text-xl font-bold tracking-tight text-bento-text sm:text-2xl"
          style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
        >
          {title}
        </h2>

        <div className="mt-5">
          {hasSubCards ? (
            <div className="flex flex-col gap-4 sm:gap-5">
              {subsections.map((sub, i) => (
                <ResumeSubCard
                  key={`${sub.heading}-${i}`}
                  heading={sub.heading}
                  body={sub.body || sub.heading}
                  accent={title === "独立 AI 产品"}
                />
              ))}
            </div>
          ) : (
            <MarkdownBlock content={body} />
          )}
        </div>
      </div>
    </article>
  );
}

export function ResumeMarkdown({ markdown }: { markdown: string }) {
  const { nameLine, contactLine, sections } = parseResumeMarkdown(markdown);

  return (
    <div className="resume-prose space-y-8 sm:space-y-10">
      <header className="featured-apple-card group/card">
        <div className="featured-apple-card__sheen pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-500 group-hover/card:opacity-100" />
        <div className="relative p-5 sm:p-7 lg:p-8">
          <span className="reflect-section-kicker">Resume</span>
          <h1
            className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl"
            style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
          >
            {nameLine.replace(/^#\s*/, "")}
          </h1>
          <div className="mt-4 border-t border-white/[0.08] pt-4">
            <MarkdownBlock content={contactLine} />
          </div>
        </div>
      </header>

      {sections.map((section) => (
        <ResumeSectionCard
          key={section.id}
          title={section.title}
          kicker={section.kicker}
          body={section.body}
          subsections={section.subsections}
        />
      ))}
    </div>
  );
}
