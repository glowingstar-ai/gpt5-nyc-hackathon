"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CalendarHeart,
  HeartHandshake,
  Sparkles,
  Sunrise,
  Waves,
} from "lucide-react";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type JournalResponse = {
  journal_id: string;
  created_at: string;
  title: string;
  entry: string;
  mood: string | null;
  gratitude: string | null;
  intention: string | null;
  focus_area: string | null;
  ai_reflection: string;
  affirmation: string;
  suggested_prompts: string[];
  breathing_exercise: string;
};

const moodPalette = [
  {
    value: "Radiant",
    label: "Radiant",
    description: "Buoyant, optimistic, expansive",
    gradient: "from-amber-400/90 via-rose-400/70 to-fuchsia-500/90",
  },
  {
    value: "Tender",
    label: "Tender",
    description: "Soft, reflective, a little raw",
    gradient: "from-sky-400/80 via-indigo-400/60 to-violet-500/70",
  },
  {
    value: "Grounded",
    label: "Grounded",
    description: "Centered, steady, rooted",
    gradient: "from-emerald-400/90 via-teal-400/70 to-cyan-400/80",
  },
  {
    value: "Foggy",
    label: "Foggy",
    description: "Drifty, uncertain, seeking clarity",
    gradient: "from-slate-400/70 via-slate-500/60 to-slate-700/70",
  },
];

const focusOptions = [
  "Emotional regulation",
  "Relationships",
  "Career vision",
  "Creative energy",
  "Rest and restoration",
];

const promptSets: Record<string, string[]> = {
  default: [
    "What tiny detail from today feels worth savoring?",
    "Where did I notice my breath becoming shallow?",
    "Which boundary could gift me more ease tomorrow?",
  ],
  Radiant: [
    "How might I channel this momentum into care for someone else?",
    "What gratitude wants to spill onto paper tonight?",
    "Which dream is ready for one courageous step?",
  ],
  Tender: [
    "Where can I offer myself softness without conditions?",
    "What quiet need keeps whispering beneath the noise?",
    "Which memory from today deserves an extra exhale?",
  ],
  Grounded: [
    "What structure kept me supported today?",
    "Where do I feel strongest inside my body right now?",
    "What wisdom is emerging from my steady pace?",
  ],
  Foggy: [
    "What is the simplest truth I can hold this evening?",
    "Where could I invite a small moment of clarity?",
    "Which question can I release until tomorrow?",
  ],
};

const ritualMoments = [
  {
    time: "Golden hour",
    theme: "Arrive",
    detail:
      "Three breaths at the window, noticing color and temperature meeting your skin.",
  },
  {
    time: "Blue hour",
    theme: "Process",
    detail:
      "Handwrite one sentence about what still feels unresolved, then let the page close.",
  },
  {
    time: "Nightfall",
    theme: "Reset",
    detail: "Steep tea or stretch for five minutes while replaying your affirmation.",
  },
];

export default function JournalStudioPage(): JSX.Element {
  const [title, setTitle] = useState("");
  const [entry, setEntry] = useState("");
  const [mood, setMood] = useState<string | null>("Tender");
  const [gratitude, setGratitude] = useState("");
  const [intention, setIntention] = useState("");
  const [focus, setFocus] = useState<string | null>(null);
  const [result, setResult] = useState<JournalResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const curatedPrompts = useMemo(() => {
    const key = mood && promptSets[mood] ? mood : "default";
    return promptSets[key];
  }, [mood]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!title.trim() || !entry.trim()) return;

    setIsSubmitting(true);
    setError(null);
    setResult(null);

    try {
      const payload: Record<string, unknown> = {
        title: title.trim(),
        entry: entry.trim(),
      };

      if (mood) payload["mood"] = mood;
      if (gratitude.trim()) payload["gratitude"] = gratitude.trim();
      if (intention.trim()) payload["intention"] = intention.trim();
      if (focus) payload["focus_area"] = focus;

      const response = await fetch(`${API_BASE}/journals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const message = await response.text();
        throw new Error(message || "Unable to craft reflection");
      }

      const data: JournalResponse = await response.json();
      setResult(data);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something interrupted the journaling guide."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070b1a] text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/10 via-transparent to-indigo-600/10" />
      <div className="pointer-events-none absolute -top-40 right-10 h-80 w-80 rounded-full bg-rose-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-48 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-sky-500/20 blur-3xl" />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-12 px-6 pb-20 pt-12 lg:px-12">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-rose-100">
              <Sparkles className="h-3.5 w-3.5" /> Moonlight Rituals
            </span>
            <h1 className="text-4xl font-semibold text-slate-50 sm:text-5xl">
              Evening Journal Studio
            </h1>
            <p className="max-w-2xl text-base text-slate-300">
              Settle into a guided reflection that mirrors the softness of twilight. Craft your entry, choose a mood, and receive gentle prompts, breathwork, and an affirmation curated just for tonight.
            </p>
          </div>
          <nav className="flex items-center gap-3 text-sm text-slate-400">
            <Link className="hover:text-slate-100" href="/">
              Home
            </Link>
            <span className="text-slate-600">/</span>
            <span className="text-slate-200">Journal</span>
          </nav>
        </header>

        <section className="grid gap-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
          <div className="space-y-8">
            <form
              onSubmit={handleSubmit}
              className="rounded-3xl border border-white/5 bg-white/5 p-8 shadow-2xl shadow-rose-500/10 backdrop-blur"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-50">
                    Compose your entry
                  </h2>
                  <p className="mt-1 text-sm text-slate-300">
                    Share the textures of your day. The more vivid your entry, the more nuanced your reflection.
                  </p>
                </div>
                <Sunrise className="hidden h-9 w-9 text-amber-300/80 sm:block" />
              </div>

              <div className="mt-8 grid gap-6">
                <div className="grid gap-3">
                  <label className="text-sm font-medium text-slate-200" htmlFor="title">
                    Theme for tonight
                  </label>
                  <input
                    id="title"
                    name="title"
                    type="text"
                    required
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Gentle reset after a full day"
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/50"
                  />
                </div>

                <div className="grid gap-3">
                  <label className="text-sm font-medium text-slate-200" htmlFor="entry">
                    Stream of consciousness
                  </label>
                  <textarea
                    id="entry"
                    name="entry"
                    required
                    value={entry}
                    onChange={(event) => setEntry(event.target.value)}
                    rows={8}
                    placeholder="Let your thoughts wander here. Describe sensations, conversations, glimmers of joy, or places that felt tight."
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm leading-6 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/50"
                  />
                </div>

                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-200">
                      Mood palette
                    </span>
                    <span className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Choose what resonates
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    {moodPalette.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setMood(option.value)}
                        className={cn(
                          "group rounded-2xl border border-transparent bg-gradient-to-br p-[1px] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-400/60",
                          mood === option.value
                            ? option.gradient
                            : "from-slate-700/50 via-slate-800/50 to-slate-900/60"
                        )}
                      >
                        <div className="flex h-full w-full flex-col gap-2 rounded-[1.05rem] bg-slate-950/80 p-4 text-left transition group-hover:bg-slate-950/60">
                          <div className="flex items-center justify-between text-sm font-semibold text-slate-100">
                            <span>{option.label}</span>
                            {mood === option.value ? (
                              <Sparkles className="h-4 w-4 text-rose-200" />
                            ) : (
                              <HeartHandshake className="h-4 w-4 text-slate-500" />
                            )}
                          </div>
                          <p className="text-xs text-slate-300">
                            {option.description}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-200" htmlFor="gratitude">
                      Gratitude glimmer
                    </label>
                    <input
                      id="gratitude"
                      name="gratitude"
                      value={gratitude}
                      onChange={(event) => setGratitude(event.target.value)}
                      placeholder="A moment I treasured..."
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-slate-200" htmlFor="intention">
                      Intention whisper
                    </label>
                    <input
                      id="intention"
                      name="intention"
                      value={intention}
                      onChange={(event) => setIntention(event.target.value)}
                      placeholder="What I want to invite..."
                      className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-4 py-2.5 text-sm outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-400/50"
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <span className="text-sm font-medium text-slate-200">
                    Focus threads
                  </span>
                  <div className="flex flex-wrap gap-3">
                    {focusOptions.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        variant={focus === option ? "default" : "secondary"}
                        className={cn(
                          "rounded-full border border-white/10 bg-slate-900/60 px-4 py-2 text-xs uppercase tracking-[0.15em] transition",
                          focus === option
                            ? "bg-rose-400 text-slate-900 hover:bg-rose-300"
                            : "text-slate-300 hover:bg-slate-800"
                        )}
                        onClick={() => setFocus(focus === option ? null : option)}
                      >
                        {option}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>

              {error ? (
                <p className="mt-6 rounded-xl border border-rose-400/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                  {error}
                </p>
              ) : null}

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  Your guide will weave reflection, prompts & breathwork
                </p>
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !title.trim() || !entry.trim()}
                    className="rounded-full bg-rose-400 px-6 py-2 text-slate-950 transition hover:bg-rose-300"
                  >
                    {isSubmitting ? "Crafting ritual..." : "Generate reflection"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="rounded-full text-slate-300 hover:text-slate-100"
                    onClick={() => {
                      setTitle("");
                      setEntry("");
                      setGratitude("");
                      setIntention("");
                      setFocus(null);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    Reset
                  </Button>
                </div>
              </div>
            </form>

            {result ? (
              <section className="rounded-3xl border border-white/5 bg-slate-950/70 p-8 shadow-lg shadow-indigo-500/10">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-50">
                      Guided reflection
                    </h3>
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      Guided on {new Date(result.created_at).toLocaleString()}
                    </p>
                  </div>
                  <CalendarHeart className="h-8 w-8 text-rose-200" />
                </div>
                <p className="mt-6 whitespace-pre-line text-sm leading-7 text-slate-200">
                  {result.ai_reflection}
                </p>

                <div className="mt-8 grid gap-6 lg:grid-cols-2">
                  <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-rose-100">
                      Evening affirmation
                    </p>
                    <p className="mt-3 text-lg font-semibold text-rose-50">
                      {result.affirmation}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-sky-400/30 bg-sky-500/10 p-5">
                    <div className="flex items-center gap-3">
                      <Waves className="h-5 w-5 text-sky-200" />
                      <p className="text-xs uppercase tracking-[0.2em] text-sky-100">
                        Breathwork cadence
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-sky-50">
                      {result.breathing_exercise}
                    </p>
                  </div>
                </div>

                <div className="mt-8 rounded-2xl border border-white/5 bg-slate-950/80 p-5">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    Suggested prompts for tomorrow
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-slate-200">
                    {result.suggested_prompts.map((prompt) => (
                      <li
                        key={prompt}
                        className="flex items-start gap-3 rounded-xl border border-slate-800/80 bg-slate-900/70 px-4 py-3"
                      >
                        <span className="mt-1 h-2 w-2 rounded-full bg-rose-300" />
                        <span>{prompt}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            ) : null}
          </div>

          <aside className="space-y-8">
            <div className="rounded-3xl border border-white/5 bg-slate-950/70 p-6 backdrop-blur">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-400">
                    Ambient cues
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-slate-50">
                    Tonight&apos;s energy profile
                  </h3>
                </div>
                <Sparkles className="h-5 w-5 text-rose-200" />
              </div>
              <p className="mt-4 text-sm text-slate-300">
                Use these prompts as a warm-up or to spark your entry. They shift with the mood you select.
              </p>
              <ul className="mt-5 space-y-4">
                {curatedPrompts.map((prompt) => (
                  <li
                    key={prompt}
                    className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm text-slate-200"
                  >
                    {prompt}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-white/5 bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-slate-950 p-6">
              <div className="flex items-center gap-3">
                <HeartHandshake className="h-5 w-5 text-emerald-200" />
                <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">
                  Ritual cadence
                </p>
              </div>
              <h3 className="mt-2 text-lg font-semibold text-slate-50">
                Three touchpoints to anchor
              </h3>
              <ul className="mt-4 space-y-4 text-sm text-slate-300">
                {ritualMoments.map((moment) => (
                  <li
                    key={moment.theme}
                    className="rounded-2xl border border-emerald-400/20 bg-emerald-500/5 p-4"
                  >
                    <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">
                      {moment.time} — {moment.theme}
                    </p>
                    <p className="mt-2 text-slate-200">{moment.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}

