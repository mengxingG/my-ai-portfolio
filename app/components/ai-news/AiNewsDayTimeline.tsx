"use client";

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Props = {
  days: string[];
  countsByDay: Record<string, number>;
  pinnedDay: string | null;
  onToggleDay: (day: string) => void;
};

function shortLabel(ymd: string): string {
  if (ymd.length < 10) return ymd;
  return `${ymd.slice(5, 7)}/${ymd.slice(8, 10)}`;
}

export function AiNewsDayTimeline({ days, countsByDay, pinnedDay, onToggleDay }: Props) {
  const maxCount = Math.max(1, ...days.map((d) => countsByDay[d] ?? 0));

  return (
    <aside
      className={cx(
        "rounded-2xl border border-purple-500/20 bg-black/35 p-3 shadow-[0_0_28px_rgba(168,85,247,0.06)] backdrop-blur-md",
        "ring-1 ring-inset ring-white/[0.05]"
      )}
    >
      <div className="mb-2 text-[10px] font-mono uppercase tracking-[0.18em] text-purple-200/70">
        时间轴
      </div>
      <p className="mb-3 text-[11px] leading-snug text-slate-500">
        按日定位（Asia/Shanghai）· 点击某天锁定；再点一次取消
      </p>
      <ul className="max-h-[min(70vh,28rem)] space-y-1.5 overflow-y-auto pr-0.5">
        {days.map((day) => {
          const n = countsByDay[day] ?? 0;
          const pct = Math.round((n / maxCount) * 100);
          const active = pinnedDay === day;
          return (
            <li key={day}>
              <button
                type="button"
                onClick={() => onToggleDay(day)}
                className={cx(
                  "flex w-full items-stretch gap-2 rounded-lg border px-1.5 py-1.5 text-left transition-all",
                  active
                    ? "border-purple-400/55 bg-purple-500/15 shadow-[0_0_14px_rgba(168,85,247,0.22)]"
                    : "border-transparent bg-white/[0.03] hover:border-purple-500/25 hover:bg-white/[0.06]"
                )}
              >
                <div
                  className="flex h-7 w-2 shrink-0 items-end justify-center rounded-full bg-white/10 p-px"
                  aria-hidden
                >
                  <div
                    className={cx(
                      "w-full rounded-full transition-all duration-300",
                      n > 0
                        ? "bg-gradient-to-t from-purple-500/90 to-cyan-400/70"
                        : "bg-slate-600/45"
                    )}
                    style={{ height: `${Math.max(pct, n > 0 ? 18 : 10)}%` }}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className={cx(
                        "font-mono text-[11px] tabular-nums",
                        active ? "font-semibold text-purple-100" : "text-slate-300"
                      )}
                    >
                      {shortLabel(day)}
                    </span>
                    <span className="text-[10px] tabular-nums text-slate-500">{n > 0 ? `${n} 条` : "—"}</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/50">
                    <div
                      className={cx(
                        "h-full rounded-full transition-all duration-300",
                        n > 0
                          ? "bg-gradient-to-r from-purple-500/80 to-cyan-500/50"
                          : "bg-transparent"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
