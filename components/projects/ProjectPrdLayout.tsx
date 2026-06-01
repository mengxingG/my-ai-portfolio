import type { ReactNode } from "react";

const REQUIRED_SUFFIX = "（AI 产品 PRD 必填）";

const sectionTitle =
  "text-xs font-semibold uppercase tracking-[0.2em] text-purple-200/90";

const requiredTitleClass = "text-red-400";

function renderRequiredTitle(text: string) {
  if (!text.includes(REQUIRED_SUFFIX)) {
    return text;
  }
  const main = text.replace(REQUIRED_SUFFIX, "").trim();
  return (
    <>
      <span className={requiredTitleClass} aria-hidden>
        *{" "}
      </span>
      {main}
      <span className={requiredTitleClass}>{REQUIRED_SUFFIX}</span>
    </>
  );
}

function PrdRequiredTitle({ children }: { children: ReactNode }) {
  if (typeof children === "string") {
    return <>{renderRequiredTitle(children)}</>;
  }
  return <>{children}</>;
}

export type PrdNavItem = {
  id: string;
  label: string;
  children?: readonly { id: string; label: string }[];
};

export function ProjectPrdShell({
  nav,
  children,
}: {
  nav: readonly PrdNavItem[];
  children: ReactNode;
}) {
  return (
    <div className="grid w-full gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:items-start">
      <aside className="hidden lg:block">
        <nav
          className="sticky top-24 holo-card rounded-2xl border border-white/10 bg-black/30 p-4"
          aria-label="文档目录"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            目录
          </p>
          <ul className="mt-3 space-y-2">
            {nav.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className="block rounded-lg px-2 py-1.5 text-sm text-slate-300 transition hover:bg-white/5 hover:text-cyan-200"
                >
                  {item.label}
                </a>
                {item.children && item.children.length > 0 ? (
                  <ul className="ml-3 mt-0.5 space-y-0.5 border-l border-white/10 pl-2">
                    {item.children.map((child) => (
                      <li key={child.id}>
                        <a
                          href={`#${child.id}`}
                          className="block py-1 text-[11px] text-slate-500 transition hover:text-red-300"
                        >
                          <span className={requiredTitleClass} aria-hidden>
                            *{" "}
                          </span>
                          {child.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 space-y-6">{children}</div>
    </div>
  );
}

export function PrdSection({
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
      <h2 className={sectionTitle}>{title}</h2>
      <div className="mt-4 space-y-4 text-sm leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export function PrdSubheading({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <h3
      id={id}
      className={`text-[13px] font-semibold text-slate-100 ${id ? "scroll-mt-24" : ""}`}
    >
      <PrdRequiredTitle>{children}</PrdRequiredTitle>
    </h3>
  );
}

export function PrdParagraph({ children }: { children: ReactNode }) {
  return <p className="text-slate-300">{children}</p>;
}

export function PrdList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-1.5 pl-5 text-slate-400">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

export function PrdTable({
  headers,
  rows,
}: {
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full min-w-[480px] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.03]">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-slate-200">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-b-0">
              {row.map((cell, j) => (
                <td key={j} className="align-top px-3 py-2.5 text-slate-400">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PrdCallout({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: ReactNode;
}) {
  const isRequired = title.includes(REQUIRED_SUFFIX);
  return (
    <div
      id={id}
      className={`rounded-xl border px-4 py-3 ${isRequired ? "scroll-mt-24 border-red-500/30 bg-red-500/[0.06]" : "border-amber-500/25 bg-amber-500/[0.06]"}`}
    >
      <p
        className={`text-xs font-semibold uppercase tracking-wide ${isRequired ? "text-red-300/95" : "text-amber-200/90"}`}
      >
        <PrdRequiredTitle>{title}</PrdRequiredTitle>
      </p>
      <div className="mt-2 text-sm text-slate-300">{children}</div>
    </div>
  );
}
