export default function ArticleLoading() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-700/60" />
          <div className="h-8 w-28 animate-pulse rounded-lg bg-slate-700/50" />
        </header>
        <main className="py-10">
          <div className="h-10 w-4/5 max-w-2xl animate-pulse rounded-lg bg-slate-700/70" />
          <div className="mt-4 h-4 w-32 animate-pulse rounded bg-slate-700/40" />
          <div className="prose prose-invert prose-cyan mt-10 max-w-none space-y-4">
            <div className="h-4 w-full animate-pulse rounded bg-slate-700/35" />
            <div className="h-4 w-[92%] animate-pulse rounded bg-slate-700/35" />
            <div className="h-4 w-[88%] animate-pulse rounded bg-slate-700/35" />
            <div className="mt-8 h-32 w-full animate-pulse rounded-xl bg-slate-800/40" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-700/35" />
            <div className="h-4 w-[95%] animate-pulse rounded bg-slate-700/35" />
          </div>
        </main>
      </div>
    </div>
  );
}
