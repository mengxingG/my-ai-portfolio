import Link from "next/link";

export default function KnowledgeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="flex items-center justify-between border-b border-white/10 pb-6">
          <Link
            href="/#knowledge"
            className="text-sm font-medium text-slate-400 transition hover:text-cyan-300"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            ← 返回首页
          </Link>
          <Link
            href="/"
            className="font-semibold tracking-tight text-slate-100"
            style={{ fontFamily: '"Geist", "SF Pro Text", system-ui, sans-serif' }}
          >
            龚梦星 · AI 产品经理
          </Link>
        </header>
        <main className="py-10">{children}</main>
      </div>
    </div>
  );
}
