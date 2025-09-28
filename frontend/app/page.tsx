import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Sparkles,
  Radar,
  ArrowUpRight,
  NotebookPen,
  Feather,
  Star,
  GraduationCap,
  Palette,
  LucideIcon,
} from "lucide-react";

type NavigationItem = {
  label: string;
  href: string;
};

type Highlight = {
  title: string;
  description: string;
};

type GlowTile = {
  title: string;
  description: string;
  icon: LucideIcon;
};

const navigation: NavigationItem[] = [
  { label: "Platform", href: "#features" },
  { label: "Why Glowing", href: "#why-glowing" },
  { label: "Experiences", href: "#experiences" },
];

const featureCards = [
  {
    name: "Emotion Console",
    description:
      "Monitor real-time multimodal cues from your conversations with responsive visual analytics.",
    href: "/emotion-console",
    icon: Activity,
    accent: "from-amber-300 via-amber-200 to-amber-400",
    pill: "Live Analysis",
  },
  {
    name: "Generative UI Studio",
    description:
      "Pair a PDF brief with a GPT-5 co-designer and iterate on palettes, typography, and layout instantly.",
    href: "/generative-ui",
    icon: Palette,
    accent: "from-teal-300 via-cyan-200 to-blue-400",
    pill: "Live Theming",
  },
  {
    name: "Notes Workspace",
    description:
      "Capture notes, record follow-ups, and let GPT-5 surface annotations from your synced meeting context.",
    href: "/notes",
    icon: NotebookPen,
    accent: "from-sky-300 via-indigo-200 to-indigo-400",
    pill: "Voice Notes",
  },
  {
    name: "Evening Journal Studio",
    description:
      "Release the day with mood-driven prompts, breathwork cues, and affirmations from a guided journaling ritual.",
    href: "/journal",
    icon: Feather,
    accent: "from-rose-400/80 to-amber-400/70",
    pill: "Guided Ritual",
  },
  {
    name: "Tutor Mode Studio",
    description:
      "Design an adaptive teaching blueprint tailored to your learner's goals, modalities, and context.",
    href: "/tutor-mode",
    icon: GraduationCap,
    accent: "from-violet-300/80 to-fuchsia-400/80",
    pill: "Tutor Plans",
  },
  {
    name: "Research Explorer",
    description:
      "Describe the paper you need and watch GPT-5 orchestrate an arXiv deep dive in real time.",
    href: "/research-explorer",
    icon: Sparkles,
    accent: "from-cyan-400/80 to-blue-500/80",
    pill: "Live RAG",
  },
  {
    name: "Realtime Assistant",
    description:
      "Step into a live co-pilot that blends voice, context, and automation into a single responsive teammate.",
    href: "/realtime-assistant",
    icon: Star,
    accent: "from-emerald-300/80 to-teal-400/80",
    pill: "Live Copilot",
  },
];

const previewHighlights: Highlight[] = [
  {
    title: "Realtime signal fusion",
    description:
      "Glowy braids tone, sentiment, and facial cues into a single confidence pulse with adaptive weighting.",
  },
  {
    title: "Coach moments that matter",
    description:
      "Your mascot copilots surface recommendations precisely when empathy or clarity begins to dip.",
  },
  {
    title: "Design your own lenses",
    description:
      "Compose custom constellations of KPIs to match your team's playbook, then let Glowy spotlight trends.",
  },
];

const glowTiles: GlowTile[] = [
  {
    title: "Playful precision",
    description:
      "Our joyful interface mirrors the warmth of the Glowing Star—friendly on the surface, deeply capable underneath.",
    icon: Sparkles,
  },
  {
    title: "Signal clarity",
    description:
      "Cosmic gradients guide your eye to the next best action while keeping complex data feeling approachable.",
    icon: Radar,
  },
  {
    title: "AI-native workflows",
    description:
      "Automations light up the customer journey so your team always knows which constellation to follow next.",
    icon: Activity,
  },
];

const heroStats = [
  {
    label: "Signals captured",
    value: "12M+",
  },
  {
    label: "Coaching boosts",
    value: "4.8×",
  },
  {
    label: "Avg. response",
    value: "<1s",
  },
];

export default function LandingPage(): JSX.Element {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-950 text-slate-100">
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-x-0 top-[-40rem] h-[60rem] bg-[radial-gradient(circle_at_center,_rgba(253,224,71,0.22)_0%,_rgba(8,47,73,0)_65%)]" />
      <div className="pointer-events-none absolute bottom-[-30rem] left-1/2 h-[48rem] w-[48rem] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_center,_rgba(59,130,246,0.18),_rgba(15,23,42,0))] blur-3xl" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-24 pt-12 sm:px-12 lg:px-16">
        <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="group inline-flex items-center gap-3">
            <div className="relative">
              <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-amber-300/40 via-yellow-100/30 to-transparent blur-lg transition-opacity duration-500 group-hover:opacity-100" />
              <Image
                src="/glowingstar-logo.png"
                alt="GlowingStar.AI logo"
                width={52}
                height={52}
                className="relative h-14 w-14 rounded-2xl border border-white/20 bg-slate-900/60 p-1 shadow-lg"
                priority
              />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-medium tracking-[0.3em] text-amber-200/90">
                Glowingstar.ai
              </span>
              <span className="text-xl font-semibold text-slate-50">
                Experience Studio
              </span>
            </div>
          </Link>

          <nav className="flex items-center gap-4 text-sm text-slate-300">
            {navigation.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="rounded-full border border-transparent px-3 py-1.5 font-medium transition hover:border-amber-200/50 hover:text-amber-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              asChild
              className="border border-white/10 bg-white/5 text-slate-100 hover:border-amber-200/60 hover:bg-white/10 hover:text-amber-100"
            >
              <Link href="/emotion-console">Launch console</Link>
            </Button>
          </div>
        </header>

        <main className="mt-16 flex flex-1 flex-col gap-24 pb-12">
          <section className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:items-center">
            <div className="space-y-8">
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-200/15 px-4 py-1 text-sm font-medium text-amber-100">
                <Sparkles className="h-4 w-4" />
                Meet Glowy, your luminous copilot
              </span>
              <h1 className="text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl lg:text-6xl">
                A Glowing Star turns every touchpoint into a guided, glowing experience.
              </h1>
              <p className="max-w-xl text-lg text-slate-200">
                Glowy orchestrates warmth and intelligence, weaving adaptive AI insights into modern journeys so every
                exchange feels personal, precise, and full of wonder.
              </p>
              <div className="flex flex-wrap gap-4">
                <Button
                  size="lg"
                  asChild
                  className="bg-amber-300 text-slate-950 shadow-[0_0_32px_rgba(253,224,71,0.45)] hover:bg-amber-200"
                >
                  <Link href="/emotion-console" className="flex items-center gap-2">
                    Start live session
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  asChild
                  className="border-slate-700 bg-slate-900/60 text-slate-200 transition hover:border-amber-200/50 hover:bg-slate-900/80 hover:text-amber-100"
                >
                  <Link href="#features" className="flex items-center gap-2">
                    Discover the suite
                    <Radar className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-wrap gap-6">
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="min-w-[120px] rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-inner shadow-amber-200/10"
                  >
                    <p className="text-2xl font-semibold text-amber-200">{stat.value}</p>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="relative">
              <div className="absolute inset-0 -translate-y-6 rounded-[2.5rem] bg-gradient-to-br from-amber-200/30 via-amber-500/10 to-transparent blur-3xl" />
              <div className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-slate-950/60 p-6 shadow-[0_30px_80px_rgba(8,7,24,0.6)] backdrop-blur-xl">
                <div className="absolute left-10 top-10 h-48 w-48 rounded-full bg-[radial-gradient(circle,_rgba(253,224,71,0.4),_rgba(2,6,23,0))] blur-xl" />
                <div className="relative flex flex-col gap-6">
                  <div className="flex items-center justify-between text-sm text-slate-300">
                    <span className="inline-flex items-center gap-2">
                      <span className="group/star relative inline-flex h-7 w-7 items-center justify-center">
                        <span
                          className="absolute inset-0 -z-10 rounded-full bg-amber-200/20 opacity-70 blur-md transition duration-500 group-hover/star:scale-125 group-hover/star:opacity-100 motion-safe:animate-starHalo motion-reduce:animate-none"
                          aria-hidden
                        />
                        <span
                          className="absolute inset-0 -z-20 rounded-full border border-amber-200/60 opacity-0 group-hover/star:animate-starBurst motion-reduce:group-hover/star:animate-none"
                          aria-hidden
                        />
                        <Star
                          className="h-4 w-4 text-amber-200 drop-shadow-[0_0_8px_rgba(253,224,71,0.65)] transition-transform duration-500 group-hover/star:rotate-12 group-hover/star:scale-110 motion-safe:animate-starTwinkle motion-reduce:animate-none motion-reduce:transition-none"
                          aria-hidden
                        />
                      </span>
                      Glow dashboard
                    </span>
                    <span className="inline-flex items-center gap-2 text-amber-100">
                      <Activity className="h-4 w-4" />
                      Stable
                    </span>
                  </div>
                  <div className="relative grid gap-4 rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="absolute -top-20 left-1/2 h-48 w-48 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,_rgba(253,224,71,0.6),_rgba(2,6,23,0))] opacity-70 blur-3xl" />
                    <Image
                      src="/glowingstar-logo.png"
                      alt="Glowy the Glowing Star mascot"
                      width={160}
                      height={160}
                      className="relative mx-auto h-32 w-32 drop-shadow-[0_0_45px_rgba(253,224,71,0.45)]"
                    />
                    <p className="text-center text-sm text-amber-50">
                      &ldquo;Glowy here—sentiment is shining at 92%. I’ve highlighted two moments to celebrate with your team.&rdquo;
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {previewHighlights.map((item) => (
                      <div
                        key={item.title}
                        className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-sm text-slate-300"
                      >
                        <p className="font-semibold text-amber-100">{item.title}</p>
                        <p className="mt-2 text-xs text-slate-400">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-amber-200/80">Navigation</p>
                <h2 className="mt-2 text-3xl font-semibold text-slate-50">
                  Choose your next constellation
                </h2>
              </div>
              <p className="max-w-md text-sm text-slate-400">
                Each workspace is crafted to highlight the nuance of emotional intelligence—pick the module that matches
                the moment and follow the glow.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3" id="experiences">
              {featureCards.map((feature) => (
                <Link key={feature.name} href={feature.href} className="group">
                  <div className="h-full rounded-3xl border border-white/10 bg-slate-950/60 p-6 shadow-lg shadow-amber-200/5 transition-transform duration-300 group-hover:-translate-y-1 group-hover:shadow-amber-300/30">
                    <div
                      className={`inline-flex items-center gap-2 rounded-full bg-gradient-to-r ${feature.accent} px-4 py-1 text-xs font-medium uppercase tracking-[0.25em] text-slate-950`}
                    >
                      {feature.pill}
                    </div>
                    <div className="mt-6 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900/70 text-amber-200">
                      <feature.icon className="h-6 w-6" />
                    </div>
                    <h3 className="mt-6 text-2xl font-semibold text-slate-50">{feature.name}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-slate-300">{feature.description}</p>
                    <div className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-amber-100">
                      Enter experience
                      <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section
            id="why-glowing"
            className="grid gap-10 rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900/80 to-slate-950 p-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] md:p-12"
          >
            <div className="space-y-6">
              <p className="text-sm uppercase tracking-[0.4em] text-amber-200/80">Why teams choose A Glowing Star</p>
              <h2 className="text-3xl font-semibold text-slate-50">
                Purpose-built for leaders who choreograph luminous customer journeys.
              </h2>
              <p className="text-sm leading-relaxed text-slate-300">
                We combine advanced signal processing with playful, human-centered design so your team can see, feel, and
                respond to every emotional beat.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {glowTiles.map((tile) => (
                  <div key={tile.title} className="rounded-2xl border border-white/10 bg-slate-950/60 p-5">
                    <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-amber-200/20 text-amber-100">
                      <tile.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3 text-base font-semibold text-slate-50">{tile.title}</p>
                    <p className="mt-2 text-xs text-slate-400">{tile.description}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-white/10 bg-slate-950/60 p-6">
              <div className="flex items-center gap-3 text-sm text-amber-100">
                <Radar className="h-5 w-5" />
                Always-on signal clarity
              </div>
              <p className="text-lg font-semibold text-slate-50">
                &ldquo;GlowingStar.AI translates every subtle shift into intuitive visuals. Our agents finally feel supported in
                the moment.&rdquo;
              </p>
              <div className="space-y-1 text-sm text-slate-400">
                <p>Jordan Michaels</p>
                <p>Director of Experience Design, Aurora CX</p>
              </div>
            </div>
          </section>
        </main>

        <footer className="mt-16 flex flex-col items-center gap-4 border-t border-white/10 pt-8 text-center text-xs text-slate-400">
          <p>
            Built with care for the GPT-5 NYC Hackathon. Inspired by the potential of emotionally intelligent AI.
          </p>
          <div className="flex items-center gap-4 text-[0.7rem] uppercase tracking-[0.4em] text-slate-500">
            <span>Privacy-first</span>
            <span>Inclusive design</span>
            <span>Realtime ready</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
