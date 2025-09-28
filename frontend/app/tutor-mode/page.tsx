"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type SVGProps,
} from "react";
import {
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Compass,
  Loader2,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import WorkspaceBanner from "@/components/workspace-banner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const AGENTS = [
  {
    id: "manager",
    name: "GPT-5 Manager",
    tagline: "Coordinates the tutor galaxy and delegates work",
    accent: "from-amber-500/70 via-orange-500/60 to-amber-400/80",
    icon: Sparkles,
  },
  {
    id: "strategist",
    name: "Curriculum Strategist",
    tagline: "Designs the staged learning journey",
    accent: "from-sky-500/70 via-cyan-500/60 to-blue-500/70",
    icon: Compass,
  },
  {
    id: "researcher",
    name: "Modality Researcher",
    tagline: "Curates resources and multi-modal explanations",
    accent: "from-violet-500/70 via-fuchsia-500/60 to-purple-500/70",
    icon: BookOpen,
  },
  {
    id: "assessment",
    name: "Assessment Architect",
    tagline: "Builds mastery checks and feedback loops",
    accent: "from-emerald-500/70 via-teal-500/60 to-green-500/70",
    icon: ClipboardList,
  },
  {
    id: "coach",
    name: "Progress Coach",
    tagline: "Monitors understanding and celebrates wins",
    accent: "from-rose-500/70 via-pink-500/60 to-amber-500/70",
    icon: CheckCircle2,
  },
] as const;

type AgentConfig = (typeof AGENTS)[number];
type AgentId = AgentConfig["id"];

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
    beginner_flag_logic: string;
    follow_up_questions: string[];
    max_follow_up_iterations: number;
    escalation_strategy: string;
  };
  concept_breakdown: {
    concept: string;
    llm_reasoning: string;
    subtopics: string[];
    real_world_connections: string[];
    prerequisites: string[];
    mastery_checks: string[];
    remediation_plan: string;
    advancement_cue: string;
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
  conversation_manager: {
    agent_role: string;
    topic_extraction_prompt: string;
    level_assessment_summary: string;
    containment_strategy: string;
  };
  learning_stages: {
    name: string;
    focus: string;
    objectives: string[];
    prerequisites: string[];
    pass_criteria: string[];
    quiz: {
      prompt: string;
      answer_key?: string | null;
      remediation: string;
    };
    on_success: string;
    on_failure: string;
  }[];
};

type AgentTask = {
  agentId: AgentId;
  headline: string;
  tasks: string[];
};

type Message =
  | { id: string; role: "user"; type: "text"; text: string }
  | { id: string; role: AgentId; type: "text"; text: string }
  | { id: string; role: AgentId; type: "tasks"; headline: string; tasks: string[] }
  | { id: string; role: AgentId; type: "loading" };

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

function buildAgentTasks(plan: TutorModeResponse): AgentTask[] {
  const strategistTasks = plan.learning_stages.slice(0, 4).map((stage) => {
    const criteriaPreview = stage.pass_criteria[0] ?? "keep the learner engaged";
    return `Architect stage "${stage.name}" focused on ${stage.focus}. Prioritise: ${criteriaPreview}.`;
  });

  const modalityTasks = plan.teaching_modalities.slice(0, 4).map((modality) => {
    const resourcePreview = modality.resources[0]
      ? `Highlight ${modality.resources[0]}`
      : "Select supporting resources";
    return `Craft a ${modality.modality} experience: ${modality.description}. ${resourcePreview}.`;
  });

  const assessmentTasks = [
    `Design the "${plan.assessment.title}" assessment (${plan.assessment.format}).`,
    plan.assessment.human_in_the_loop_notes,
    ...plan.assessment.items.slice(0, 3).map((item, index) => {
      const label = index + 1;
      return `Draft item ${label}: ${item.prompt}`;
    }),
  ];

  const coachTasks = [
    `Kick off with: ${plan.understanding.approach}.`,
    plan.understanding.diagnostic_questions[0]
      ? `Use diagnostic question: ${plan.understanding.diagnostic_questions[0]}`
      : "Prepare diagnostic follow-ups.",
    `Watch for: ${plan.understanding.signals_to_watch.slice(0, 2).join(", ")}.`,
    `Wrap-up plan: ${plan.completion.wrap_up_plan}.`,
  ];

  const managerTasks = [
    plan.conversation_manager.agent_role,
    `Topic extraction focus: ${plan.conversation_manager.topic_extraction_prompt}.`,
    `Level insights: ${plan.conversation_manager.level_assessment_summary}.`,
    `Containment strategy: ${plan.conversation_manager.containment_strategy}.`,
  ];

  return [
    {
      agentId: "manager",
      headline: "Coordinate the tutoring collective",
      tasks: managerTasks,
    },
    {
      agentId: "strategist",
      headline: "Design the learning journey",
      tasks: strategistTasks.length > 0
        ? strategistTasks
        : ["Outline staged progression to cover the concept effectively."],
    },
    {
      agentId: "researcher",
      headline: "Curate multi-modal experiences",
      tasks: modalityTasks.length > 0
        ? modalityTasks
        : ["Select supporting resources and craft explanations across modalities."],
    },
    {
      agentId: "assessment",
      headline: "Engineer mastery checks",
      tasks: assessmentTasks.length > 0
        ? assessmentTasks
        : ["Build assessments that surface understanding and misconceptions."],
    },
    {
      agentId: "coach",
      headline: "Coach the learner through the plan",
      tasks: coachTasks.length > 0
        ? coachTasks
        : ["Monitor understanding signals and celebrate progress."],
    },
  ];
}

function AgentGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <Sparkles className={cn("h-4 w-4", className)} {...props} />;
}

export default function TutorModePage(): JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "manager",
      type: "text",
      text: "Hey there! I'm the GPT-5 tutor manager. What would you love to learn or get unstuck on today?",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [latestPlan, setLatestPlan] = useState<TutorModeResponse | null>(null);
  const [assignmentBoard, setAssignmentBoard] = useState<AgentTask[]>([]);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatViewportRef.current) return;
    chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
  }, [messages]);

  const formattedTimestamp = useMemo(() => {
    if (!latestPlan) return null;
    return formatDate(latestPlan.generated_at);
  }, [latestPlan]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const trimmed = inputValue.trim();
      if (!trimmed) {
        return;
      }

      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        type: "text",
        text: trimmed,
      };

      const placeholderId = `loading-${Date.now()}`;

      setMessages((previous) => [
        ...previous,
        userMessage,
        { id: placeholderId, role: "manager", type: "loading" },
      ]);
      setInputValue("");
      setIsSubmitting(true);

      try {
        const response = await fetch(`${API_BASE}/tutor/mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: trimmed,
            student_level: null,
            goals: null,
            preferred_modalities: null,
            additional_context: "Generated from tutor-mode chat interface",
          }),
        });

        if (!response.ok) {
          throw new Error("Unable to generate a tutor plan right now.");
        }

        const data: TutorModeResponse = await response.json();
        const tasks = buildAgentTasks(data);

        setLatestPlan(data);
        setAssignmentBoard(tasks);

        setMessages((previous) =>
          previous.flatMap((message) => {
            if (message.id !== placeholderId) {
              return [message];
            }

            const managerSummary: Message = {
              id: `manager-summary-${Date.now()}`,
              role: "manager",
              type: "text",
              text: `Deploying ${tasks.length} specialist agents to help you master "${data.topic}". Here's how we're dividing the work:`,
            };

            const taskMessages: Message[] = tasks.map((task, index) => ({
              id: `${task.agentId}-${Date.now()}-${index}`,
              role: task.agentId,
              type: "tasks",
              headline: task.headline,
              tasks: task.tasks,
            }));

            return [managerSummary, ...taskMessages];
          })
        );
      } catch (error) {
        console.error("Tutor mode request failed", error);
        setMessages((previous) =>
          previous.map((message) =>
            message.id === placeholderId
              ? {
                  id: `error-${Date.now()}`,
                  role: "manager",
                  type: "text",
                  text: "I ran into an issue reaching the tutor service. Let's try that again in a moment.",
                }
              : message
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [inputValue]
  );

  const renderMessage = useCallback((message: Message) => {
    if (message.role === "user") {
      return (
        <div key={message.id} className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl bg-sky-500/20 px-4 py-3 text-sm leading-relaxed text-sky-100 shadow-lg shadow-sky-500/10">
            {message.text}
          </div>
        </div>
      );
    }

    const agent = AGENTS.find((item) => item.id === message.role);
    const Icon = agent?.icon ?? AgentGlyph;

    if (message.type === "loading") {
      return (
        <div key={message.id} className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-800/70 text-slate-200">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
          <div className="flex-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-sm text-slate-300">
            Coordinating agents…
          </div>
        </div>
      );
    }

    if (message.type === "text") {
      return (
        <div key={message.id} className="flex items-start gap-3">
          <div
            className={cn(
              "mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/60 bg-slate-900",
              agent ? "text-white" : "text-slate-200"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 rounded-2xl border border-slate-800/60 bg-slate-900/60 px-4 py-3 text-sm leading-relaxed text-slate-200">
            {message.text}
          </div>
        </div>
      );
    }

    if (message.type === "tasks") {
      return (
        <div key={message.id} className="flex items-start gap-3">
          <div
            className={cn(
              "mt-1 flex h-10 w-10 items-center justify-center rounded-full border border-slate-700/60 bg-slate-900",
              agent ? "text-white" : "text-slate-200"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="flex-1 rounded-2xl border border-slate-800/70 bg-slate-900/70 px-4 py-4 text-sm text-slate-100 shadow-lg shadow-slate-900/30">
            <p className="text-sm font-semibold text-white">{message.headline}</p>
            <ul className="mt-3 space-y-2 text-left text-sm text-slate-200">
              {message.tasks.map((task, index) => (
                <li key={index} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-emerald-400" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
    }

    return null;
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 pb-16 text-slate-100">
      <WorkspaceBanner
        title="Tutor Mode Studio"
        current="Tutor Mode"
        subtitle="Assemble a collective of GPT-5 teaching agents"
        maxWidthClassName="max-w-6xl"
      />
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 pb-12 pt-10 lg:px-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
              Tutor mode (beta)
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              Ask the GPT-5 tutor collective anything
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Describe what you want to learn and watch the manager agent rally a crew of specialists to design a personalised path.
            </p>
          </div>
        </div>

        <section className="rounded-3xl border border-slate-900/70 bg-slate-900/40 p-6 shadow-xl shadow-emerald-500/10">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Agent constellation</p>
              <h2 className="mt-2 text-xl font-semibold text-white">Meet your tutor specialists</h2>
            </div>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {AGENTS.map((agent) => (
              <div
                key={agent.id}
                className="relative overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-950/40 p-5 shadow-lg shadow-slate-950/40"
              >
                <div
                  className={cn(
                    "absolute -top-10 right-0 h-24 w-24 rounded-full bg-gradient-to-br blur-2xl",
                    agent.accent
                  )}
                />
                <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-slate-800/80 bg-slate-950/70 text-white">
                  <agent.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-4 text-base font-semibold text-white">{agent.name}</h3>
                <p className="mt-2 text-sm text-slate-300">{agent.tagline}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <section className="flex h-[620px] flex-col overflow-hidden rounded-3xl border border-slate-900/70 bg-slate-950/60 shadow-2xl shadow-slate-950/60">
            <div className="border-b border-slate-900/60 px-6 py-4">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Tutor collective chat</p>
              <h2 className="mt-1 text-lg font-semibold text-white">What would you like to explore today?</h2>
            </div>
            <div ref={chatViewportRef} className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
              {messages.map((message) => renderMessage(message))}
            </div>
            <form onSubmit={handleSubmit} className="border-t border-slate-900/60 bg-slate-950/80 px-5 py-4">
              <div className="flex flex-col gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-3">
                <textarea
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask the collective what you'd like to learn…"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-transparent bg-transparent text-sm text-slate-100 outline-none placeholder:text-slate-500"
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between">
                  <p className="text-xs text-slate-500">
                    Tip: press <span className="font-semibold text-slate-300">Shift + Enter</span> for a new line.
                  </p>
                  <Button type="submit" disabled={isSubmitting} className="min-w-[140px] bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Coordinating…
                      </>
                    ) : (
                      "Send to agents"
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </section>

          <aside className="flex flex-col gap-6">
            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Live assignments</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Agent task board</h2>
              <p className="mt-2 text-sm text-slate-400">
                Each specialist receives a slice of the plan after the manager confers with GPT-5.
              </p>
              {assignmentBoard.length === 0 ? (
                <div className="mt-6 rounded-2xl border border-slate-900/60 bg-slate-900/50 p-5 text-sm text-slate-400">
                  Ask the collective a learning question to populate the task board.
                </div>
              ) : (
                <div className="mt-6 space-y-4">
                  {assignmentBoard.map((assignment) => {
                    const agent = AGENTS.find((item) => item.id === assignment.agentId);
                    const Icon = agent?.icon ?? AgentGlyph;

                    return (
                      <div
                        key={assignment.agentId}
                        className="rounded-2xl border border-slate-900/60 bg-slate-900/70 p-5"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-800/70 bg-slate-950 text-white">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white">
                              {agent?.name ?? "Tutor Agent"}
                            </p>
                            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              {assignment.headline}
                            </p>
                          </div>
                        </div>
                        <ul className="mt-4 space-y-2 text-sm text-slate-200">
                          {assignment.tasks.map((task, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                              <span>{task}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {latestPlan && (
              <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Latest GPT-5 intel</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Plan snapshot</h2>
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Topic</p>
                    <p className="mt-1 text-base text-white">{latestPlan.topic}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Learner profile</p>
                    <p className="mt-1 text-slate-300">{latestPlan.learner_profile}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Objectives</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {latestPlan.objectives.slice(0, 4).map((objective, index) => (
                        <li key={index}>{objective}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Model</p>
                    <p className="mt-1 text-slate-300">{latestPlan.model}</p>
                  </div>
                  {formattedTimestamp && (
                    <div>
                      <p className="text-xs uppercase text-slate-500">Generated</p>
                      <p className="mt-1 text-slate-300">{formattedTimestamp}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
