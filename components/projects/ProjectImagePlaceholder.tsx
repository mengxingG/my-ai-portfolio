export function ProjectImagePlaceholder({ label }: { label: string }) {
  return (
    <div
      className="flex min-h-[200px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/20 bg-black/25 px-6 py-10 text-center sm:min-h-[240px]"
      role="img"
      aria-label={`${label}（待上传）`}
    >
      <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        图片占位
      </span>
      <span className="mt-2 text-sm text-slate-400">{label}</span>
    </div>
  );
}
