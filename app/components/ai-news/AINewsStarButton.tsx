"use client";

import { Star } from "lucide-react";

type Props = {
  starred: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** 与来源同行时的紧凑尺寸 */
  compact?: boolean;
};

export function AINewsStarButton({ starred, disabled, onToggle, compact }: Props) {
  const size = compact
    ? "min-h-9 min-w-9 rounded-md border-white/[0.12] bg-black/40 hover:border-purple-400/35 hover:bg-black/55"
    : "min-h-11 min-w-11 rounded-xl border-white/10 bg-black/45 hover:border-purple-400/40 hover:bg-black/60";
  const icon = compact ? "h-3.5 w-3.5" : "h-[1.125rem] w-[1.125rem]";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onToggle();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      className={`flex touch-manipulation items-center justify-center border p-0 transition active:scale-95 disabled:pointer-events-none disabled:opacity-50 ${size}`}
      aria-label={starred ? "取消标星" : "标星收藏"}
      aria-pressed={starred}
    >
      <Star
        className={[
          `${icon} shrink-0 transition-all duration-200`,
          starred
            ? "fill-yellow-400 text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.65)]"
            : "text-white/45 hover:text-white/75",
        ].join(" ")}
        strokeWidth={starred ? 0 : 1.75}
      />
    </button>
  );
}
