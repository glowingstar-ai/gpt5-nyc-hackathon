import Link from "next/link";
import { ArrowLeft, CheckCircle2, Compass, Layers, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

const playbookPillars = [
  {
    title: "Moments that matter",
    description:
      "Map customer emotions to curated response frameworks that keep momentum and trust high at every step.",
    icon: Compass,
  },
  {
    title: "Collaborative craft",
    description:
      "Co-create prompts, tone guidelines, and sample scripts with your team inside a shared, living workspace.",
    icon: Users,
  },
  {
    title: "Reusable building blocks",
    description:
      "Snap together proven plays with reusable cards, templates, and automations tailored to your brand voice.",
    icon: Layers,
  },
];

export default function AgentPlaybooks(): JSX.Element {
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
            Playbooks
          </div>
        </header>

        <main className="mt-12 flex flex-1 flex-col gap-12">
          <section className="space-y-6">
            <h1 className="text-4xl font-semibold leading-tight text-slate-50">
              Turn emotional intelligence into guided action.
            </h1>
            <p className="max-w-2xl text-lg text-slate-300">
              Design modular playbooks that empower every agent to respond with empathy, clarity, and confidence—on brand and in the moment.
            </p>
            <div className="grid gap-6 sm:grid-cols-3">
              {playbookPillars.map((pillar) => (
                <div key={pillar.title} className="rounded-3xl border border-slate-800 bg-slate-900/50 p-6">
                  <pillar.icon className="h-6 w-6 text-emerald-300" />
                  <h3 className="mt-4 text-lg font-semibold text-slate-50">{pillar.title}</h3>
                  <p className="mt-2 text-sm text-slate-400">{pillar.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-8 rounded-3xl border border-slate-800 bg-slate-900/60 p-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-1 text-xs font-medium uppercase tracking-[0.3em] text-emerald-200">
                Guided delivery
              </div>
              <h2 className="text-3xl font-semibold text-slate-50">
                Automate next best actions while keeping humans in the loop.
              </h2>
              <ul className="space-y-4 text-sm text-slate-300">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Trigger contextual prompts inside the Emotion Console the moment thresholds are crossed.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Distribute playbooks directly to Session Insights for rapid coaching follow-up.</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-4 w-4 text-emerald-300" />
                  <span>Export curated journeys for onboarding, partnerships, or campaign launches.</span>
                </li>
              </ul>
            </div>
            <div className="flex flex-col justify-between gap-6 rounded-3xl border border-slate-800 bg-slate-950/50 p-6">
              <div className="space-y-2">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Spotlight</p>
                <p className="text-2xl font-semibold text-slate-50">Empathy deep-dive</p>
                <p className="text-sm text-slate-400">
                  A three-step ritual that pairs active listening prompts with adaptive follow-up questions.
                </p>
              </div>
              <Button asChild className="bg-emerald-400 text-slate-950 hover:bg-emerald-300">
                <Link href="/emotion-console">Preview in console</Link>
              </Button>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
