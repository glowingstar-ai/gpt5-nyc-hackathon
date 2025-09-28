"use client";

import Link from "next/link";
import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type PageBannerVariant = "dark" | "light";

type VariantStyles = {
  header: string;
  title: string;
  nav: string;
  link: string;
  divider: string;
  current: string;
};

const VARIANT_STYLES: Record<PageBannerVariant, VariantStyles> = {
  dark: {
    header: "border-b border-slate-800 bg-slate-900/60 text-slate-100",
    title: "text-slate-100",
    nav: "text-slate-400",
    link: "text-slate-400 transition-colors hover:text-slate-100",
    divider: "text-slate-700",
    current: "text-slate-100",
  },
  light: {
    header: "border-b border-slate-200 bg-white/80 text-slate-900",
    title: "text-slate-900",
    nav: "text-slate-500",
    link: "text-slate-600 transition-colors hover:text-slate-900",
    divider: "text-slate-300",
    current: "text-slate-900",
  },
};

type PageBannerProps = {
  title: string;
  currentPage: string;
  homeHref?: string;
  homeLabel?: string;
  variant?: PageBannerVariant;
  className?: string;
  containerClassName?: string;
  actions?: ReactNode;
};

export function PageBanner({
  title,
  currentPage,
  homeHref = "/",
  homeLabel = "Home",
  variant = "dark",
  className,
  containerClassName,
  actions,
}: PageBannerProps): JSX.Element {
  const styles = VARIANT_STYLES[variant];

  return (
    <header className={cn("w-full backdrop-blur", styles.header, className)}>
      <div
        className={cn(
          "mx-auto flex w-full items-center justify-between px-6 py-4",
          containerClassName ?? "max-w-4xl"
        )}
      >
        <h1 className={cn("text-xl font-semibold", styles.title)}>{title}</h1>
        <div className="flex items-center gap-4">
          <nav className={cn("flex items-center gap-3 text-sm", styles.nav)}>
            <Link href={homeHref} className={styles.link}>
              {homeLabel}
            </Link>
            <span className={styles.divider}>/</span>
            <span className={styles.current}>{currentPage}</span>
          </nav>
          {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}

