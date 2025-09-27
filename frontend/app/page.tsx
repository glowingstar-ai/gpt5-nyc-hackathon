"use client";

import { useState, type SVGProps } from "react";
import { motion } from "framer-motion";
import { SunIcon } from "@radix-ui/react-icons";
import { Theme, Flex, Heading, Text } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const heroVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 }
};

export default function HomePage() {
  const [clicks, setClicks] = useState(0);

  return (
    <Theme appearance="inherit">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-16 px-6 py-24">
        <motion.section
          variants={heroVariants}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="space-y-6"
        >
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            <SunIcon className="h-4 w-4" />
            Fast foundations
          </span>
          <Heading as="h1" size="8" className="font-heading text-balance text-4xl md:text-5xl">
            Ship modern product experiences with confidence.
          </Heading>
          <Text as="p" size="4" className="max-w-2xl text-lg text-slate-600 dark:text-slate-300">
            This monorepo pairs a type-safe Next.js frontend with a FastAPI backend so
            that teams can iterate quickly without sacrificing best practices. Tailwind
            CSS, shadcn/ui patterns, and Radix Themes are ready for you to build on.
          </Text>
          <Flex gap="3" wrap="wrap">
            <Button onClick={() => setClicks((count) => count + 1)}>Primary action</Button>
            <Button variant="outline" onClick={() => setClicks(0)}>
              Reset clicks ({clicks})
            </Button>
          </Flex>
        </motion.section>
        <section className="grid gap-6 md:grid-cols-2">
          {features.map((feature) => (
            <motion.article
              key={feature.title}
              className={cn(
                "rounded-2xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/50"
              )}
              variants={heroVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.4, delay: feature.delay }}
            >
              <feature.icon className="mb-4 h-8 w-8 text-brand" />
              <Heading as="h3" size="5" className="mb-2 font-heading">
                {feature.title}
              </Heading>
              <Text as="p" size="3" className="text-slate-600 dark:text-slate-300">
                {feature.description}
              </Text>
            </motion.article>
          ))}
        </section>
      </main>
    </Theme>
  );
}

type Feature = {
  title: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  delay: number;
};

const features: Feature[] = [
  {
    title: "Component-driven UI",
    description:
      "Tailwind CSS, Radix Themes, and shadcn-style primitives provide a cohesive design system that scales with your product.",
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 6v6l3.5 2.1M4 6h16M4 10h4m12 8H4"
        />
      </svg>
    ),
    delay: 0.1
  },
  {
    title: "API first backend",
    description:
      "FastAPI comes configured with modular routers, typed models, and first-class async support for building reliable services.",
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 7h16M4 12h8m-8 5h12"
        />
      </svg>
    ),
    delay: 0.2
  },
  {
    title: "Production-ready DX",
    description:
      "Opinionated tooling including ESLint, Prettier, and TypeScript keeps your codebase consistent across contributors.",
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
        <path strokeLinecap="round" strokeLinejoin="round" d="m6 9 6 6 6-6" />
      </svg>
    ),
    delay: 0.3
  },
  {
    title: "Animations built-in",
    description:
      "Framer Motion is wired up so you can focus on delightful interactions instead of boilerplate integration work.",
    icon: (props) => (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" {...props}>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M4 12c1.5-4 4.5-6 8-6s6.5 2 8 6c-1.5 4-4.5 6-8 6s-6.5-2-8-6z"
        />
      </svg>
    ),
    delay: 0.4
  }
];
