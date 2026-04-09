"use client";

import { useEffect, useState } from "react";
import mermaid from "mermaid";

function nowId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function MermaidSimple({
  code,
  className,
}: {
  code: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string>("");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setErr(null);
    setSvg("");

    const src = String(code || "").trim();
    if (!src) return;

    /** New id every effect run — avoids React Strict Mode double-invoke fighting over one Mermaid render id. */
    const renderId = `mmd-${nowId()}`;

    void (async () => {
      try {
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "dark",
        });
        const { svg: out } = await mermaid.render(renderId, src);
        if (!active) return;
        if (!out?.includes("<svg")) {
          setErr("Mermaid 返回内容异常，请刷新页面重试");
          return;
        }
        setSvg(out);
      } catch (e) {
        if (!active) return;
        setErr(e instanceof Error ? e.message : "Mermaid 渲染失败");
      }
    })();

    return () => {
      active = false;
    };
  }, [code]);

  if (err) {
    return (
      <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100/90">
        Mermaid 渲染失败：{err}
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
        正在渲染图表...
      </div>
    );
  }

  return (
    <div
      className={[
        "overflow-x-auto rounded-2xl border border-white/10 bg-black/20 p-3",
        "[&_svg]:block [&_svg]:max-w-none [&_svg]:h-auto",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

