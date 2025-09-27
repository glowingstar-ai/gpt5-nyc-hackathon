import "./globals.css";

import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";
import { inter, manrope, plexSans } from "@/lib/fonts";

export const metadata: Metadata = {
  title: {
    default: "EmpathIQ Experience Studio",
    template: "%s | EmpathIQ Studio",
  },
  description:
    "Command center for emotionally intelligent customer experiences—monitor sessions, review insights, and launch guided playbooks.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`antialiased ${inter.variable} ${manrope.variable} ${plexSans.variable}`}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
