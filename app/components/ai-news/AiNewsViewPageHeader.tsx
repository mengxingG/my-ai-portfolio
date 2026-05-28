import { BackToHomeLink } from "@/app/components/BackToHomeLink";

type Props = {
  title: string;
  subtitle: string;
  showBackToHome?: boolean;
};

export function AiNewsViewPageHeader({
  title,
  subtitle,
  showBackToHome = true,
}: Props) {
  return (
    <header className="mb-6 border-b border-white/[0.06] pb-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
        {showBackToHome ? <BackToHomeLink /> : null}
      </div>
    </header>
  );
}
