import Link from "next/link";

export type AppPageHeaderProps = {
  title: string;
  description?: string;
  breadcrumbLabel?: string;
};

export function AppPageHeader({
  title,
  description,
  breadcrumbLabel,
}: AppPageHeaderProps) {
  const currentLabel = breadcrumbLabel ?? title;
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          {description ? (
            <p className="text-sm text-slate-400">{description}</p>
          ) : null}
        </div>
        <nav className="flex items-center space-x-3 text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-100">
            Home
          </Link>
          <span className="text-slate-700">/</span>
          <span className="text-slate-100">{currentLabel}</span>
        </nav>
      </div>
    </header>
  );
}
