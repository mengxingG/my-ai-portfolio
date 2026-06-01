"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { FileText, Github, Linkedin } from "lucide-react";
import { CONTACT_LINKS } from "@/lib/contact-links";

const ICON_ITEMS = [
  { id: "github" as const, label: "GitHub", Icon: Github, external: true },
  { id: "linkedin" as const, label: "LinkedIn", Icon: Linkedin, external: true },
  { id: "resume" as const, label: "查看简历", Icon: FileText, external: false },
] as const;

function ContactIconLink({
  href,
  label,
  children,
  external = true,
}: {
  href: string;
  label: string;
  children: ReactNode;
  external?: boolean;
}) {
  const configured = href.trim().length > 0;

  if (!configured) {
    return (
      <span
        className="contact-social-btn contact-social-btn--pending"
        title={`${label}（待配置链接）`}
        aria-label={`${label}，链接待配置`}
      >
        {children}
      </span>
    );
  }

  const className = "contact-social-btn";
  const isInternal = !external || href.startsWith("/");

  if (isInternal) {
    return (
      <Link href={href} className={className} aria-label={label}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      aria-label={label}
    >
      {children}
    </a>
  );
}

export function ContactSection() {
  const { email, github, linkedin, resume } = CONTACT_LINKS;
  const hrefById = { github, linkedin, resume };

  return (
    <section id="contact" className="reflect-stage scroll-mt-20 py-10">
      <span className="reflect-section-kicker">Contact</span>
      <h2
        className="mt-3 text-2xl font-bold tracking-tight text-bento-text sm:text-3xl"
        style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
      >
        联系我
      </h2>
      <p className="mt-2 text-sm font-light text-bento-muted">Contact · Get in Touch</p>

      <div className="bento-card mt-5 rounded-2xl p-5 sm:p-7">
        <p className="max-w-2xl text-sm leading-relaxed text-bento-muted sm:text-base sm:leading-7">
          正在寻找能一起用 AI 产品创造价值的团队，或有合作想法？欢迎随时联系。
        </p>
        <a
          href={email.includes("@") ? `mailto:${email}` : "#"}
          className="mt-4 inline-block text-sm text-bento-text transition hover:text-violet-300 sm:text-base"
          onClick={email.includes("@") ? undefined : (e) => e.preventDefault()}
        >
          {email}
        </a>
        <div className="mt-6 flex flex-wrap items-center gap-4 sm:gap-5">
          {ICON_ITEMS.map(({ id, label, Icon, external }) => (
            <ContactIconLink
              key={id}
              href={hrefById[id]}
              label={label}
              external={external}
            >
              <Icon className="h-5 w-5 text-white" />
            </ContactIconLink>
          ))}
        </div>
      </div>
    </section>
  );
}
