import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Sparkles,
  Radar,
  ArrowUpRight,
  MessageCircle,
  Brain,
  NotebookPen,
} from "lucide-react";

const featureCards = [
  {
    name: "Emotion Console",
    description:
      "Monitor real-time multimodal cues from your conversations with responsive visual analytics.",
    href: "/emotion-console",
    icon: Activity,
    accent: "from-amber-400/80 to-orange-500/80",
    pill: "Live Analysis",
  },
  {
    name: "Session Insights",
    description:
      "Review rich summaries, transcript intelligence, and top opportunities pulled from your captured sessions.",
    href: "/session-insights",
    icon: Brain,
    accent: "from-violet-400/80 to-fuchsia-500/80",
    pill: "AI Summaries",
  },
  {
    name: "Agent Playbooks",
    description:
      "Operationalize best practices with collaborative playbooks, prompts, and workflows tuned to each customer moment.",
    href: "/agent-playbooks",
    icon: MessageCircle,
    accent: "from-emerald-400/80 to-teal-500/80",
    pill: "Guided Actions",
  },
  {
    name: "Notes Workspace",
    description:
      "Capture notes, record follow-ups, and let GPT-5 surface annotations from your synced meeting context.",
    href: "/notes",
    icon: NotebookPen,
    accent: "from-sky-400/80 to-indigo-500/80",
    pill: "Voice Notes",
  },
];

const previewHighlights = [
  {
    title: "Realtime signal fusion",
    description:
      "Blend tone, sentiment, and facial cues into a single confidence pulse with adaptive weighting.",
  },
  {
    title: "Coach moments that matter",
    description:
      "Surface coaching recommendations precisely when empathy or clarity begins to dip.",
  },
  {
    title: "Design your own lenses",
    description:
      "Configure custom taxonomies and KPIs to match your team\'s playbook and voice.",
  },
];

export default function LandingPage(): JSX.Element {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900"
        aria-hidden
      />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-0 h-[28rem] w-[28rem] translate-x-1/3 rounded-full bg-purple-500/20 blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-24 pt-12 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between gap-6">
          <Link href="/" className="group inline-flex items-center gap-2">
            <Image
              src="/glowingstar-logo.png"
              alt="GlowingStar.AI logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-xl object-cover"
              priority
            />
            <div className="flex flex-col">
              <span className="text-sm uppercase tracking-[0.35em] text-slate-300">
                GlowingStar.AI
              </span>
              <span className="text-lg font-semibold text-slate-50">
                Experience Studio
              </span>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              asChild
              className="text-slate-200 hover:text-slate-50"
            >
              <Link href="/emotion-console">Launch console</Link>
            </Button>
            <Button
              className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              asChild
            >
              <Link href="/session-insights">Explore insights</Link>
            </Button>
          </div>
        </header>

        <main className="mt-16 flex flex-1 flex-col gap-24 pb-12">
          <section className="grid gap-12 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-center">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-sm font-medium text-emerald-200">
                <Sparkles className="h-4 w-4" />
                Elevate every human moment
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
                One intelligent workspace for real-time emotional intelligence.
              </h1>
              <p className="max-w-xl text-lg text-slate-300">
                Navigate live conversations, replay coaching moments, and
                orchestrate customer-ready playbooks from a single, beautifully
                crafted studio experience.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  asChild
                  className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                >
                  <Link
                    href="/emotion-console"
                    className="flex items-center gap-2"
                  >
                    Start live session
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="border-slate-700 bg-slate-900/40 text-slate-200 hover:bg-slate-900/70"
                >
                  <Link href="#features" className="flex items-center gap-2">
                    Discover the suite
                    <Radar className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-emerald-400/30 via-slate-200/10 to-transparent blur-3xl" />
              <div className="relative rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-2xl backdrop-blur-xl">
                <div className="flex items-center justify-between text-sm text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                    Live sentiment stream
                  </span>
                  <span className="inline-flex items-center gap-2 text-emerald-300">
                    <Activity className="h-4 w-4" />
                    Stable
                  </span>
                </div>
                <div className="mt-6 space-y-6">
                  {previewHighlights.map((item) => (
                    <div
                      key={item.title}
                      className="rounded-2xl border border-slate-800 bg-slate-950/30 p-5"
                    >
                      <h3 className="text-lg font-semibold text-slate-50">
                        {item.title}
                      </h3>
                      <p className="mt-2 text-sm text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
                  Navigation
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-50">
                  Dive into the experiences built for you
                </h2>
              </div>
              <p className="max-w-md text-sm text-slate-400">
                Each workspace is crafted to highlight the nuance of emotional
                intelligence—choose where to go next and continue the journey.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {featureCards.map((feature) => (
                <Link key={feature.name} href={feature.href} className="group">
                  <div className="h-full rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-lg transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-emerald-500/20">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${feature.accent} px-4 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-950`}
                    >
                      {feature.pill}
                    </div>
                    <div className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950/60 text-emerald-300">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold text-slate-50">
                      {feature.name}
                    </h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-400">
                      {feature.description}
                    </p>
                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-emerald-300">
                      Enter experience
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="grid gap-8 rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:p-12">
            <div className="space-y-5">
              <p className="text-sm uppercase tracking-[0.35em] text-slate-400">
                Why teams choose GlowingStar.AI
              </p>
              <h2 className="text-3xl font-semibold text-slate-50">
                Purpose-built for leaders who design remarkable customer
                journeys.
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">
                We combine advanced signal processing with playful,
                human-centered design so your team can see, feel, and respond to
                every emotional beat.
              </p>
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Adaptive intelligence
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-50">
                    Dynamic weighting
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Our console adjusts to the strongest signals in the room so
                    you always see what matters most.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
                    Crafted experiences
                  </p>
                  <p className="mt-2 text-lg font-semibold text-slate-50">
                    Delightful micro-interactions
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    Subtle animations and gradients guide your focus without
                    overwhelming your senses.
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
              <div className="flex items-center gap-3 text-sm text-emerald-200">
                <Radar className="h-5 w-5" />
                Always-on signal clarity
              </div>
              <p className="text-lg font-semibold text-slate-50">
                &ldquo;GlowingStar.AI translates every subtle shift into
                intuitive visuals. Our agents finally feel supported in the
                moment.&rdquo;
              </p>
              <div className="space-y-1 text-sm text-slate-400">
                <p>Jordan Michaels</p>
                <p>Director of Experience Design, Aurora CX</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-16 flex flex-col items-center gap-4 border-t border-slate-800/60 pt-8 text-center text-xs text-slate-500">
          <p>
            Built with care for the GPT-5 NYC Hackathon. Inspired by the
            potential of emotionally intelligent AI.
          </p>
          <div className="flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.4em] text-slate-600">
            <span>Privacy-first</span>
            <span>Inclusive design</span>
            <span>Realtime ready</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
