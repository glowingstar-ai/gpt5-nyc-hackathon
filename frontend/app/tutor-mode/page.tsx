"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, SVGProps } from "react";
import Link from "next/link";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Compass,
  GraduationCap,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const MODALITY_OPTIONS = [
  {
    value: "visual" as const,
    label: "Visual",
    description: "Diagrams, infographics, or whiteboard style walk-throughs.",
  },
  {
    value: "verbal" as const,
    label: "Verbal",
    description: "Narrative explanations, analogies, or stories.",
  },
  {
    value: "interactive" as const,
    label: "Interactive",
    description: "Hands-on coding, simulations, or explorations.",
  },
  {
    value: "experiential" as const,
    label: "Experiential",
    description: "Real-world exercises, labs, or guided practice.",
  },
  {
    value: "reading" as const,
    label: "Reading",
    description: "Curated articles, docs, or primary sources.",
  },
  {
    value: "other" as const,
    label: "Other",
    description: "Something different—describe it in the context field.",
  },
];

type TutorTeachingModalityKind =
  | "visual"
  | "verbal"
  | "interactive"
  | "experiential"
  | "reading"
  | "other";

type TutorModeResponse = {
  model: string;
  generated_at: string;
  topic: string;
  learner_profile: string;
  objectives: string[];
  understanding: {
    approach: string;
    diagnostic_questions: string[];
    signals_to_watch: string[];
  };
  concept_breakdown: {
    concept: string;
    llm_reasoning: string;
    subtopics: string[];
    real_world_connections: string[];
  }[];
  teaching_modalities: {
    modality: TutorTeachingModalityKind;
    description: string;
    resources: string[];
  }[];
  assessment: {
    title: string;
    format: string;
    human_in_the_loop_notes: string;
    items: {
      prompt: string;
      kind: "multiple_choice" | "short_answer" | "reflection" | "practical";
      options?: string[] | null;
      answer_key?: string | null;
    }[];
  };
  completion: {
    mastery_indicators: string[];
    wrap_up_plan: string;
    follow_up_suggestions: string[];
  };
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function TutorModePage(): JSX.Element {
  const [topic, setTopic] = useState("Understanding diffusion transformers for creative coding");
  const [studentLevel, setStudentLevel] = useState(
    "Mid-level engineer comfortable with Python but new to generative AI models"
  );
  const [goalsInput, setGoalsInput] = useState(
    [
      "Decode the intuition behind diffusion and transformer hybrids",
      "Build a mental model of the training process",
      "Design a weekend project to apply the concept",
    ].join("\n")
  );
  const [selectedModalities, setSelectedModalities] = useState<TutorTeachingModalityKind[]>([
    "visual",
    "interactive",
  ]);
  const [additionalContext, setAdditionalContext] = useState(
    "I love analogies to music production and I learn fastest when I can tinker."
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [plan, setPlan] = useState<TutorModeResponse | null>(null);
  const [activeStage, setActiveStage] = useState<string | null>(null);

  const formattedTimestamp = useMemo(() => {
    if (!plan) return null;
    return formatDate(plan.generated_at);
  }, [plan]);

  useEffect(() => {
    if (!plan) {
      setActiveStage(null);
      return;
    }

    setActiveStage("understanding");
  }, [plan]);

  const handleToggleModality = useCallback((value: TutorTeachingModalityKind) => {
    setSelectedModalities((previous) =>
      previous.includes(value)
        ? previous.filter((item) => item !== value)
        : [...previous, value]
    );
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!topic.trim()) {
        setError("Please add a topic you want to explore with the tutor.");
        return;
      }

      setError(null);
      setIsSubmitting(true);
      setPlan(null);

      const payload: Record<string, unknown> = {
        topic: topic.trim(),
      };

      if (studentLevel.trim()) {
        payload["student_level"] = studentLevel.trim();
      }

      const goals = goalsInput
        .split("\n")
        .map((goal) => goal.trim())
        .filter(Boolean);
      if (goals.length > 0) {
        payload["goals"] = goals;
      }

      if (selectedModalities.length > 0) {
        payload["preferred_modalities"] = selectedModalities;
      }

      if (additionalContext.trim()) {
        payload["additional_context"] = additionalContext.trim();
      }

      try {
        const response = await fetch(`${API_BASE}/tutor/mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Unable to generate a tutor plan right now.");
        }

        const data: TutorModeResponse = await response.json();
        setPlan(data);
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "Something went wrong while generating your tutor mode plan."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [additionalContext, goalsInput, selectedModalities, studentLevel, topic]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-900/60 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <div className="space-y-1">
            <h1 className="text-xl font-semibold">Tutor Mode Studio</h1>
            <p className="text-sm text-slate-400">
              Compose a rich learner brief and watch GPT-5 draft a multi-step instruction plan.
            </p>
          </div>
          <nav className="text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-100">
              Home
            </Link>
            <span className="mx-2 text-slate-700">/</span>
            <span className="text-slate-100">Tutor Mode</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 lg:flex-row">
        <section className="w-full space-y-6 rounded-xl border border-slate-800/70 bg-slate-900/60 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Learner profile</h2>
              <p className="mt-1 text-sm text-slate-400">
                Share context about the learner, their objectives, and how they like to absorb new concepts.
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-amber-300" />
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label htmlFor="topic" className="text-sm font-medium text-slate-200">
                What should the tutor cover?
              </label>
              <input
                id="topic"
                name="topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                required
                placeholder="Explain diffusion transformers for generative media"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="studentLevel" className="text-sm font-medium text-slate-200">
                Who is the learner?
              </label>
              <textarea
                id="studentLevel"
                name="studentLevel"
                rows={3}
                value={studentLevel}
                onChange={(event) => setStudentLevel(event.target.value)}
                placeholder="Describe their current level, strengths, or prior knowledge."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm leading-6 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="goals" className="text-sm font-medium text-slate-200">
                What outcomes matter most?
              </label>
              <textarea
                id="goals"
                name="goals"
                rows={4}
                value={goalsInput}
                onChange={(event) => setGoalsInput(event.target.value)}
                placeholder={"List goals on separate lines, e.g.\n• Understand the fundamentals\n• Apply with a hands-on build"}
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm leading-6 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40"
              />
            </div>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-slate-200">
                Which teaching modalities resonate?
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {MODALITY_OPTIONS.map((option) => {
                  const isActive = selectedModalities.includes(option.value);
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleModality(option.value)}
                      className={cn(
                        "rounded-lg border px-4 py-3 text-left transition",
                        isActive
                          ? "border-amber-300/70 bg-amber-300/10 text-amber-100"
                          : "border-slate-800/80 bg-slate-950 text-slate-300 hover:border-amber-200/50 hover:text-amber-50"
                      )}
                    >
                      <div className="text-sm font-semibold">{option.label}</div>
                      <p className="mt-1 text-xs text-slate-400">
                        {option.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="space-y-2">
              <label htmlFor="context" className="text-sm font-medium text-slate-200">
                Anything else the tutor should know?
              </label>
              <textarea
                id="context"
                name="context"
                rows={3}
                value={additionalContext}
                onChange={(event) => setAdditionalContext(event.target.value)}
                placeholder="Share constraints, analogies they love, or pacing preferences."
                className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm leading-6 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-300/40"
              />
            </div>

            {error ? (
              <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
                {error}
              </div>
            ) : null}

            <Button
              type="submit"
              className="w-full bg-amber-300/90 text-slate-950 hover:bg-amber-200"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating tutor plan…
                </span>
              ) : (
                "Generate tutor plan"
              )}
            </Button>
          </form>
        </section>

        <section className="w-full rounded-xl border border-slate-800/70 bg-slate-900/40 p-6 shadow-xl shadow-slate-950/40 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-100">Tutor blueprint</h2>
              <p className="mt-1 text-sm text-slate-400">
                The agent orchestrates understanding checks, concept arcs, and completion signals.
              </p>
            </div>
            <ClipboardList className="h-5 w-5 text-emerald-300" />
          </div>

          {!plan ? (
            <div className="mt-8 space-y-4 rounded-lg border border-dashed border-slate-800/80 bg-slate-950/40 p-6 text-center">
              <GraduationCap className="mx-auto h-10 w-10 text-slate-600" />
              <p className="text-sm text-slate-400">
                Submit a learner profile to receive a step-by-step tutor mode playbook.
              </p>
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              <div className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-4">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-300">
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-300" />
                    {plan.model}
                  </span>
                  {formattedTimestamp ? (
                    <span className="inline-flex items-center gap-2 text-slate-400">
                      <ClockIcon className="h-4 w-4" />
                      {formattedTimestamp}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-lg font-semibold text-slate-100">{plan.topic}</h3>
                <p className="mt-2 text-sm text-slate-300">{plan.learner_profile}</p>
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-slate-200">Objectives</h4>
                  <ul className="mt-2 space-y-1 text-sm text-slate-300">
                    {plan.objectives.map((objective) => (
                      <li key={objective} className="flex items-start gap-2">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-300" />
                        <span>{objective}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <StageMachine plan={plan} activeStage={activeStage} onStageChange={setActiveStage} />
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

type StageMachineProps = {
  plan: TutorModeResponse;
  activeStage: string | null;
  onStageChange: (stageId: string) => void;
};

type StageConfig = {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  icon: (props: SVGProps<SVGSVGElement>) => JSX.Element;
  accent: string;
  content: JSX.Element;
};

function StageMachine({ plan, activeStage, onStageChange }: StageMachineProps) {
  const stages = useMemo<StageConfig[]>(
    () => [
      {
        id: "understanding",
        stepNumber: 0,
        title: "Understand the learner",
        description: "Assess readiness and calibrate tone.",
        icon: Compass,
        accent: "text-sky-300",
        content: (
          <div className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-300 shadow-lg shadow-sky-500/10">
            <div>
              <h5 className="font-semibold text-slate-200">Approach</h5>
              <p className="mt-1">{plan.understanding.approach}</p>
            </div>
            <div>
              <h5 className="font-semibold text-slate-200">Diagnostic questions</h5>
              <ul className="mt-1 space-y-1">
                {plan.understanding.diagnostic_questions.map((question) => (
                  <li key={question} className="rounded-md border border-slate-800/70 bg-slate-950/60 px-3 py-2">
                    {question}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="font-semibold text-slate-200">Signals to watch</h5>
              <ul className="mt-1 flex flex-wrap gap-2 text-xs">
                {plan.understanding.signals_to_watch.map((signal) => (
                  <li
                    key={signal}
                    className="rounded-full border border-slate-800/70 bg-slate-950/80 px-3 py-1 text-slate-300"
                  >
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ),
      },
      {
        id: "concepts",
        stepNumber: 1,
        title: "Concept breakdowns",
        description: "Sequence the instructional narrative.",
        icon: BookOpen,
        accent: "text-indigo-300",
        content: (
          <div className="space-y-4">
            {plan.concept_breakdown.map((concept) => (
              <article
                key={`${concept.concept}-${concept.llm_reasoning.slice(0, 12)}`}
                className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-300 shadow-lg shadow-indigo-500/10"
              >
                <h5 className="text-base font-semibold text-slate-100">{concept.concept}</h5>
                <p className="mt-1 text-slate-300">{concept.llm_reasoning}</p>
                <div className="mt-3">
                  <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Subtopics</h6>
                  <ul className="mt-1 flex flex-wrap gap-2 text-xs">
                    {concept.subtopics.map((topic) => (
                      <li
                        key={topic}
                        className="rounded-full border border-slate-800/70 bg-slate-950/80 px-3 py-1"
                      >
                        {topic}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-3">
                  <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Real-world connections
                  </h6>
                  <ul className="mt-1 space-y-1">
                    {concept.real_world_connections.map((connection) => (
                      <li
                        key={connection}
                        className="rounded-md border border-slate-800/70 bg-slate-950/70 px-3 py-2"
                      >
                        {connection}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        ),
      },
      {
        id: "modalities",
        stepNumber: 2,
        title: "Teaching modalities",
        description: "Mix formats to keep momentum.",
        icon: Sparkles,
        accent: "text-amber-300",
        content: (
          <div className="space-y-3">
            {plan.teaching_modalities.map((modality) => (
              <article
                key={`${modality.modality}-${modality.description.slice(0, 12)}`}
                className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-300 shadow-lg shadow-amber-500/10"
              >
                <h5 className="text-base font-semibold capitalize text-slate-100">{modality.modality}</h5>
                <p className="mt-1">{modality.description}</p>
                {modality.resources.length > 0 ? (
                  <div className="mt-3">
                    <h6 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Resources</h6>
                    <ul className="mt-1 list-disc space-y-1 pl-5">
                      {modality.resources.map((resource) => (
                        <li key={resource}>{resource}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ),
      },
      {
        id: "assessment",
        stepNumber: 3,
        title: "Assessment plan",
        description: "Check for understanding and depth.",
        icon: ClipboardList,
        accent: "text-emerald-300",
        content: (
          <article className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-300 shadow-lg shadow-emerald-500/10">
            <div>
              <h5 className="text-base font-semibold text-slate-100">{plan.assessment.title}</h5>
              <p className="mt-1 text-xs uppercase tracking-wide text-slate-400">{plan.assessment.format}</p>
              <p className="mt-2">{plan.assessment.human_in_the_loop_notes}</p>
            </div>
            <div className="space-y-3">
              {plan.assessment.items.map((item, index) => (
                <div
                  key={`${item.prompt}-${index}`}
                  className="rounded-lg border border-slate-800/70 bg-slate-950/60 p-3"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
                    <span>{item.kind.replace(/_/g, " ")}</span>
                    <span>Item {index + 1}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-200">{item.prompt}</p>
                  {item.options && item.options.length > 0 ? (
                    <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-300">
                      {item.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  ) : null}
                  {item.answer_key ? (
                    <p className="mt-2 text-xs text-emerald-300">Answer key: {item.answer_key}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </article>
        ),
      },
      {
        id: "completion",
        stepNumber: 4,
        title: "Completion signals",
        description: "Lock in mastery and next steps.",
        icon: CheckCircle2,
        accent: "text-emerald-300",
        content: (
          <article className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-950/60 p-4 text-sm text-slate-300 shadow-lg shadow-emerald-500/10">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Mastery indicators</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {plan.completion.mastery_indicators.map((indicator) => (
                  <li key={indicator}>{indicator}</li>
                ))}
              </ul>
            </div>
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Wrap-up plan</h5>
              <p className="mt-1">{plan.completion.wrap_up_plan}</p>
            </div>
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Follow-up suggestions</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {plan.completion.follow_up_suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
          </article>
        ),
      },
    ],
    [plan]
  );

  const currentStage = useMemo(() => {
    if (stages.length === 0) return null;
    return stages.find((stage) => stage.id === activeStage) ?? stages[0];
  }, [activeStage, stages]);

  if (!currentStage) return null;

  const CurrentIcon = currentStage.icon;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-800/70 bg-slate-950/40 p-4">
        <h4 className="text-sm font-semibold text-slate-200">Tutor mode state machine</h4>
        <p className="mt-1 text-xs text-slate-400">
          Navigate between orchestration stages. The highlighted card shows the currently active phase of the
          teaching loop.
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <aside className="lg:w-64">
          <ol className="space-y-3">
            {stages.map((stage) => {
              const Icon = stage.icon;
              const isActive = stage.id === currentStage.id;
              return (
                <li key={stage.id}>
                  <button
                    type="button"
                    onClick={() => onStageChange(stage.id)}
                    className={cn(
                      "w-full rounded-lg border px-4 py-3 text-left text-sm transition focus:outline-none focus:ring-2 focus:ring-amber-300/60",
                      isActive
                        ? "border-emerald-300/70 bg-emerald-300/10 text-slate-100 shadow-lg shadow-emerald-500/20"
                        : "border-slate-800/70 bg-slate-950/60 text-slate-300 hover:border-emerald-300/40 hover:text-slate-100"
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full border border-slate-800/70 bg-slate-950/80",
                          stage.accent
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="flex flex-col">
                        <span className="text-xs uppercase tracking-wide text-slate-400">
                          Step {stage.stepNumber}
                        </span>
                        <span className="font-semibold text-slate-200">{stage.title}</span>
                        <span className="text-xs text-slate-400">{stage.description}</span>
                      </span>
                    </span>
                    {isActive ? (
                      <span className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/60 bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" aria-hidden />
                        Active stage
                      </span>
                    ) : null}
                  </button>
                </li>
              );
            })}
          </ol>
        </aside>

        <section className="flex-1 space-y-4">
          <header className="flex items-center gap-3 text-sm font-semibold text-slate-200">
            <CurrentIcon className={cn("h-4 w-4", currentStage.accent)} />
            Step {currentStage.stepNumber} · {currentStage.title}
          </header>
          {currentStage.content}
        </section>
      </div>
    </div>
  );
}

function ClockIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
