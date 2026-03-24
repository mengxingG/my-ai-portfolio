"use client";

import { useEffect, useState } from "react";

type FontSize = "small" | "medium" | "large";

const LABEL: Record<FontSize, string> = {
  small: "小",
  medium: "中",
  large: "大",
};

function readStoredFontSize(): FontSize {
  if (typeof window === "undefined") return "medium";
  const stored = window.localStorage.getItem("gm-font-size");
  if (stored && (["small", "medium", "large"] as const).includes(stored as FontSize)) {
    return stored as FontSize;
  }
  return "medium";
}

export function FontSizeSwitcher() {
  const [size, setSize] = useState<FontSize>(() => readStoredFontSize());

  useEffect(() => {
    document.documentElement.setAttribute("data-font-size", size);
  }, [size]);

  const applySize = (next: FontSize) => {
    setSize(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("gm-font-size", next);
    }
    document.documentElement.setAttribute("data-font-size", next);
  };

  return (
    <div className="liquid-glass-card flex items-center gap-1 rounded-full px-2 py-1 text-[11px] text-slate-300">
      <span className="hidden sm:inline text-[10px] text-slate-500">字体</span>
      {(["small", "medium", "large"] as FontSize[]).map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => applySize(key)}
          className={`min-w-[1.75rem] rounded-full px-1.5 py-0.5 transition text-[11px] font-medium ${
            size === key
              ? "bg-cyan-500/30 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.5)]"
              : "text-slate-400 hover:bg-white/5"
          }`}
        >
          {LABEL[key]}
        </button>
      ))}
    </div>
  );
}

