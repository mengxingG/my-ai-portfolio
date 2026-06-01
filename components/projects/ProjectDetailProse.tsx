import type { ReactNode } from "react";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90";

export function ProjectDetailSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 holo-card rounded-2xl p-6 sm:p-8">
      <h2 className={eyebrow}>{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export function ProjectDetailList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-slate-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function ProjectDetailHeader({
  kicker,
  title,
  description,
  children,
}: {
  kicker: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="holo-card rounded-2xl p-6 sm:p-8">
      <p className="reflect-section-kicker">{kicker}</p>
      <h1
        className="mt-3 text-2xl font-bold leading-tight text-bento-text sm:text-3xl"
        style={{ fontFamily: '"Geist", "Inter", "SF Pro Display", system-ui, sans-serif' }}
      >
        {title}
      </h1>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-bento-muted">{description}</p>
      {children ? <div className="mt-6">{children}</div> : null}
    </header>
  );
}
