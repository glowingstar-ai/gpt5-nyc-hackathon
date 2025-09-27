import Link from "next/link";
import { ArrowLeft, BarChart3, Clock, FileText, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";

const insightHighlights = [
  {
    title: "Story-driven summaries",
    description:
      "AI-crafted narratives capture the emotional arc, key decisions, and moments of delight across each session.",
    icon: FileText,
  },
  {
    title: "Trend pulse",
    description:
      "Spot week-over-week wins and attention areas with adaptive baselines tuned to your team's performance.",
    icon: BarChart3,
  },
  {
    title: "Coaching timeline",
    description:
      "Replay every pivotal exchange with annotated cues for empathy, clarity, and momentum.",
    icon: Clock,
  },
];

export default function SessionInsights(): JSX.Element {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 pb-16 pt-12 sm:px-12 lg:px-16">
        <header className="flex items-center justify-between gap-4">
          <Button variant="ghost" asChild className="text-slate-300 hover:text-slate-50">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to studio
            </Link>
          </Button>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-emerald-200">
            Insights Hub
          </div>
        </header>

        <main className="mt-12 flex flex-1 flex-col gap-12">
          <section className="space-y-6">
            <h1 className="text-4xl font-semibold leading-tight text-slate-50">
              Illuminate the stories hidden in every interaction.
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Dive into cinematic recaps, conversational highlights, and actionable opportunities designed to help your team adapt faster than ever.
            </p>
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl backdrop-blur-xl">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-slate-50">Featured session: Aurora Launch</h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Emotion score climbed 18% after anchoring benefits in customer language.
                  </p>
                </div>
                <Button asChild className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                  <Link href="/emotion-console">Watch the replay</Link>
                </Button>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-3">
                {insightHighlights.map((item) => (
                  <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                    <item.icon className="h-5 w-5 text-emerald-300" />
                    <h3 className="mt-3 text-lg font-semibold text-slate-50">{item.title}</h3>
                    <p className="mt-2 text-sm text-slate-400">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="grid gap-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-8 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-emerald-200">
                Momentum Metrics
              </div>
              <h2 className="text-3xl font-semibold text-slate-50">
                Track sentiment velocity, trust resonance, and promise delivery.
              </h2>
              <p className="text-sm leading-relaxed text-slate-400">
                Session Insights distills millions of signals into a set of guiding metrics so you can coach intentionally and celebrate progress with clarity.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <Lightbulb className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>
                    Focus on the three most critical interventions surfaced by EmpathIQ for the coming week.
                  </span>
                </li>
                <li className="flex items-start gap-3">
                  <BarChart3 className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Compare performance across teams with one glance at adaptive baselines.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Jump directly into the timeline at the exact moment an emotion pivoted.</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Forecast</p>
                <p className="text-2xl font-semibold text-slate-50">Engagement outlook</p>
                <p className="text-sm text-slate-400">
                  Confidence that customer loyalty will rise next quarter based on current emotional resonance.
                </p>
              </div>
              <div className="flex items-end gap-4 text-emerald-200">
                <span className="text-5xl font-semibold">87%</span>
                <span className="text-sm uppercase tracking-[0.3em]">Positive</span>
              </div>
              <Button variant="outline" asChild className="border-slate-800 bg-slate-950/60 text-slate-200 hover:bg-slate-950">
                <Link href="/agent-playbooks">Share with team</Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
