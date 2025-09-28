import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type WorkspaceBannerProps = {
  title: string;
  current: string;
  subtitle?: string;
  maxWidthClassName?: string;
  rightSlot?: ReactNode;
};

export default function WorkspaceBanner({
  title,
  current,
  subtitle,
  maxWidthClassName,
  rightSlot,
}: WorkspaceBannerProps): JSX.Element {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur">
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between",
          maxWidthClassName ?? "max-w-4xl"
        )}
      >
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
          {subtitle ? <p className="text-sm text-slate-400">{subtitle}</p> : null}
        </div>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
          <nav className="flex items-center gap-2 text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-100">
              Home
            </Link>
            <span className="text-slate-700">/</span>
            <span className="text-slate-100">{current}</span>
          </nav>
          {rightSlot ? <div className="flex items-center gap-2">{rightSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
