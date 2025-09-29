"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type SVGProps,
} from "react";
import {
  AlertCircle,
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
    tagline: "Coordinates the tutoring collective and narrates progress",
    accent: "from-amber-500/70 via-orange-500/60 to-amber-400/80",
    icon: Sparkles,
  },
  {
    id: "curriculum",
    name: "Curriculum Strategist",
    tagline: "Designs the staged learning journey",
    accent: "from-sky-500/70 via-cyan-500/60 to-blue-500/70",
    icon: Compass,
  },
  {
    id: "workshop",
    name: "Workshop Designer",
    tagline: "Builds hands-on sessions for immediate application",
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
] as const;

type AgentConfig = (typeof AGENTS)[number];
type AgentId = AgentConfig["id"];

type TutorManagerResponse = {
  topic: string;
  student_level: string | null;
  summary: string;
  kickoff_script: string;
  agenda: string[];
  agents: {
    id: AgentId;
    name: string;
    route: string;
    description: string;
    deliverables: string[];
  }[];
};

type TutorCurriculumResponse = {
  topic: string;
  level: string;
  overview: string;
  pacing_guide: string;
  sections: {
    title: string;
    duration: string;
    focus: string;
    learning_goals: string[];
    activities: string[];
    resources: string[];
    assessment: string;
  }[];
};

type TutorWorkshopResponse = {
  topic: string;
  scenario: string;
  description: string;
  segments: {
    name: string;
    duration: string;
    objective: string;
    flow: string[];
    materials: string[];
    reflection_prompts: string[];
  }[];
  exit_ticket: string[];
};

type TutorAssessmentQuestion = {
  id: string;
  type: "multiple_choice" | "short_answer";
  prompt: string;
  options?: string[] | null;
  answer: string;
  rationale: string;
};

type TutorAssessmentResponse = {
  topic: string;
  difficulty: string;
  instructions: string;
  success_criteria: string[];
  questions: TutorAssessmentQuestion[];
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

type QuizState = Record<string, { answer: string; status?: "correct" | "incorrect" }>;
type AgentLoadingState = Partial<Record<AgentId, boolean>>;
type AgentErrorState = Partial<Record<AgentId, string>>;

type ParsedOption = { value: string; label: string };

function buildAgentTasks(plan: TutorManagerResponse): AgentTask[] {
  return plan.agents.map((agent) => ({
    agentId: agent.id,
    headline: agent.name,
    tasks: agent.deliverables,
  }));
}

function parseOption(option: string): ParsedOption {
  const [rawValue, ...rest] = option.split(". ");
  if (rawValue && rawValue.trim().length === 1 && rest.length > 0) {
    return { value: rawValue.trim(), label: `${rawValue.trim()}. ${rest.join(". ")}` };
  }
  return { value: option.trim(), label: option.trim() };
}

function findOptionLabel(options: ParsedOption[] | undefined, value: string): string | null {
  if (!options) return null;
  const normalized = value.trim().toLowerCase();
  for (const option of options) {
    if (option.value.trim().toLowerCase() === normalized) {
      return option.label;
    }
  }
  return null;
}

function summariseCurriculum(plan: TutorCurriculumResponse): string {
  return `Curriculum Strategist mapped ${plan.sections.length} stages for "${plan.topic}" and suggested pacing across ${plan.pacing_guide.toLowerCase()}.`;
}

function summariseWorkshop(plan: TutorWorkshopResponse): string {
  return `Workshop Designer assembled ${plan.segments.length} segments anchored in "${plan.scenario}".`;
}

function summariseAssessment(plan: TutorAssessmentResponse): string {
  return `Assessment Architect published ${plan.questions.length} mastery checks with answer keys.`;
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
  const [managerPlan, setManagerPlan] = useState<TutorManagerResponse | null>(null);
  const [curriculumPlan, setCurriculumPlan] = useState<TutorCurriculumResponse | null>(null);
  const [workshopPlan, setWorkshopPlan] = useState<TutorWorkshopResponse | null>(null);
  const [assessmentPlan, setAssessmentPlan] = useState<TutorAssessmentResponse | null>(null);
  const [assignmentBoard, setAssignmentBoard] = useState<AgentTask[]>([]);
  const [agentLoading, setAgentLoading] = useState<AgentLoadingState>({});
  const [agentErrors, setAgentErrors] = useState<AgentErrorState>({});
  const [quizState, setQuizState] = useState<QuizState>({});
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatViewportRef.current) return;
    chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setQuizState({});
  }, [assessmentPlan]);

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
      setManagerPlan(null);
      setCurriculumPlan(null);
      setWorkshopPlan(null);
      setAssessmentPlan(null);
      setAssignmentBoard([]);
      setAgentLoading({});
      setAgentErrors({});
      setQuizState({});

      const basePayload = {
        topic: trimmed,
        student_level: null,
        goals: null,
        preferred_modalities: null,
        additional_context: "Generated from tutor-mode chat interface",
      };

      try {
        const response = await fetch(`${API_BASE}/tutor/mode`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(basePayload),
        });

        if (!response.ok) {
          throw new Error("Unable to coordinate the tutor manager right now.");
        }

        const data: TutorManagerResponse = await response.json();
        const tasks = buildAgentTasks(data);

        setManagerPlan(data);
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
              text: `${data.summary} Here's how I'm delegating this mission:`,
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

        const followUpAgents = data.agents.filter((agent) => agent.id !== "manager");

        await Promise.all(
          followUpAgents.map(async (agent) => {
            const agentId = agent.id;
            setAgentLoading((previous) => ({ ...previous, [agentId]: true }));

            try {
              const specialistResponse = await fetch(`${API_BASE}${agent.route}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(basePayload),
              });

              if (!specialistResponse.ok) {
                throw new Error(`Agent ${agentId} unavailable`);
              }

              const specialistData = await specialistResponse.json();

              let completionSummary = "";
              if (agentId === "curriculum") {
                setCurriculumPlan(specialistData as TutorCurriculumResponse);
                completionSummary = summariseCurriculum(specialistData as TutorCurriculumResponse);
              } else if (agentId === "workshop") {
                setWorkshopPlan(specialistData as TutorWorkshopResponse);
                completionSummary = summariseWorkshop(specialistData as TutorWorkshopResponse);
              } else if (agentId === "assessment") {
                setAssessmentPlan(specialistData as TutorAssessmentResponse);
                completionSummary = summariseAssessment(specialistData as TutorAssessmentResponse);
              }

              if (completionSummary) {
                setMessages((previous) => [
                  ...previous,
                  {
                    id: `agent-${agentId}-${Date.now()}`,
                    role: agentId,
                    type: "text",
                    text: completionSummary,
                  },
                ]);
              }
            } catch (specialistError) {
              console.error(`Tutor agent ${agentId} failed`, specialistError);
              setAgentErrors((previous) => ({
                ...previous,
                [agentId]: `${agent.name} is unavailable. Please try again shortly.`,
              }));
              setMessages((previous) => [
                ...previous,
                {
                  id: `agent-error-${agentId}-${Date.now()}`,
                  role: agentId,
                  type: "text",
                  text: `${agent.name} hit a snag while generating their output. Let's retry in a moment.`,
                },
              ]);
            } finally {
              setAgentLoading((previous) => ({ ...previous, [agentId]: false }));
            }
          })
        );
      } catch (error) {
        console.error("Tutor manager request failed", error);
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

  const handleQuizAnswerChange = useCallback((questionId: string, value: string) => {
    setQuizState((previous) => ({ ...previous, [questionId]: { answer: value } }));
  }, []);

  const handleQuizCheck = useCallback(() => {
    if (!assessmentPlan) return;

    setQuizState((previous) => {
      const nextState: QuizState = { ...previous };

      assessmentPlan.questions.forEach((question) => {
        const current = nextState[question.id] ?? { answer: "" };
        const userAnswer = (current.answer ?? "").trim();
        let status: "correct" | "incorrect" = "incorrect";

        if (question.type === "multiple_choice") {
          status = userAnswer && userAnswer.toLowerCase() === question.answer.toLowerCase() ? "correct" : "incorrect";
        } else {
          const normalized = userAnswer.toLowerCase();
          const hits = ["scenario", "outcome", "why", "value"].filter((keyword) => normalized.includes(keyword));
          status = hits.length >= 2 ? "correct" : "incorrect";
        }

        nextState[question.id] = { answer: current.answer, status };
      });

      return nextState;
    });
  }, [assessmentPlan]);

  const handleQuizReset = useCallback(() => {
    setQuizState({});
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
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">Tutor mode (beta)</p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              Ask the GPT-5 tutor collective anything
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-300">
              Describe what you want to learn and watch the manager agent rally a crew of specialists to design a personalised
              path.
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
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

            {managerPlan && (
              <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Manager briefing</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Plan snapshot</h2>
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Topic</p>
                    <p className="mt-1 text-base text-white">{managerPlan.topic}</p>
                  </div>
                  {managerPlan.student_level && (
                    <div>
                      <p className="text-xs uppercase text-slate-500">Learner profile</p>
                      <p className="mt-1 text-slate-300">{managerPlan.student_level}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase text-slate-500">Summary</p>
                    <p className="mt-1 text-slate-300">{managerPlan.summary}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Kickoff script</p>
                    <p className="mt-1 whitespace-pre-line text-slate-300">{managerPlan.kickoff_script}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Agenda</p>
                    <ol className="mt-2 space-y-1 text-slate-300">
                      {managerPlan.agenda.map((item, index) => (
                        <li key={index}>{item}</li>
                      ))}
                    </ol>
                  </div>
                </div>
              </div>
            )}

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Curriculum strategist</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Curriculum blueprint</h2>
              {agentLoading.curriculum ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Drafting stages…
                </div>
              ) : agentErrors.curriculum ? (
                <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {agentErrors.curriculum}
                </div>
              ) : curriculumPlan ? (
                <div className="mt-4 space-y-5 text-sm text-slate-200">
                  <p className="text-slate-300">{curriculumPlan.overview}</p>
                  <p className="text-slate-400">{curriculumPlan.pacing_guide}</p>
                  <div className="space-y-4">
                    {curriculumPlan.sections.map((section) => (
                      <div key={section.title} className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{section.title}</p>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{section.duration}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{section.focus}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase text-slate-500">Learning goals</p>
                            <ul className="mt-1 space-y-1 text-slate-200">
                              {section.learning_goals.map((goal) => (
                                <li key={goal}>{goal}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-slate-500">Activities</p>
                            <ul className="mt-1 space-y-1 text-slate-200">
                              {section.activities.map((activity) => (
                                <li key={activity}>{activity}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase text-slate-500">Resources</p>
                            <ul className="mt-1 space-y-1 text-slate-200">
                              {section.resources.map((resource) => (
                                <li key={resource}>{resource}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-slate-500">Assessment</p>
                            <p className="mt-1 text-slate-200">{section.assessment}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Activate the manager to request a curriculum. The strategist will outline stages once dispatched.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Workshop designer</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Hands-on session plan</h2>
              {agentLoading.workshop ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Crafting the workshop…
                </div>
              ) : agentErrors.workshop ? (
                <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {agentErrors.workshop}
                </div>
              ) : workshopPlan ? (
                <div className="mt-4 space-y-5 text-sm text-slate-200">
                  <p className="text-slate-300">{workshopPlan.description}</p>
                  <p className="text-xs uppercase text-slate-500">Scenario</p>
                  <p className="text-slate-200">{workshopPlan.scenario}</p>
                  <div className="space-y-4">
                    {workshopPlan.segments.map((segment) => (
                      <div key={segment.name} className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-white">{segment.name}</p>
                          <span className="text-xs uppercase tracking-[0.2em] text-slate-500">{segment.duration}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{segment.objective}</p>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2">
                          <div>
                            <p className="text-xs uppercase text-slate-500">Facilitation flow</p>
                            <ul className="mt-1 space-y-1 text-slate-200">
                              {segment.flow.map((step) => (
                                <li key={step}>{step}</li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <p className="text-xs uppercase text-slate-500">Materials</p>
                            <ul className="mt-1 space-y-1 text-slate-200">
                              {segment.materials.map((material) => (
                                <li key={material}>{material}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="mt-3">
                          <p className="text-xs uppercase text-slate-500">Reflection prompts</p>
                          <ul className="mt-1 space-y-1 text-slate-200">
                            {segment.reflection_prompts.map((prompt) => (
                              <li key={prompt}>{prompt}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Exit ticket</p>
                    <ul className="mt-1 space-y-1 text-slate-200">
                      {workshopPlan.exit_ticket.map((prompt) => (
                        <li key={prompt}>{prompt}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Once the manager dispatches the workshop designer, your live session plan will appear here.
                </p>
              )}
            </div>

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Assessment architect</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Interactive quiz</h2>
              {agentLoading.assessment ? (
                <div className="mt-6 flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
                  Generating mastery checks…
                </div>
              ) : agentErrors.assessment ? (
                <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
                  {agentErrors.assessment}
                </div>
              ) : assessmentPlan ? (
                <div className="mt-4 space-y-5 text-sm text-slate-200">
                  <p className="text-slate-300">{assessmentPlan.instructions}</p>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Success criteria</p>
                    <ul className="mt-1 space-y-1 text-slate-200">
                      {assessmentPlan.success_criteria.map((criterion) => (
                        <li key={criterion}>{criterion}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-4">
                    {assessmentPlan.questions.map((question) => {
                      const parsedOptions = question.options?.map((option) => parseOption(option));
                      const state = quizState[question.id];
                      const feedbackStatus = state?.status;
                      const correctLabel = parsedOptions
                        ? findOptionLabel(parsedOptions, question.answer) ?? question.answer
                        : question.answer;

                      return (
                        <div key={question.id} className="rounded-2xl border border-slate-800/70 bg-slate-900/50 p-4">
                          <p className="text-sm font-semibold text-white">{question.prompt}</p>
                          {parsedOptions ? (
                            <div className="mt-3 space-y-2">
                              {parsedOptions.map((option) => (
                                <label
                                  key={option.value}
                                  className={cn(
                                    "flex cursor-pointer items-center gap-3 rounded-2xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-sm transition",
                                    state?.answer === option.value ? "border-emerald-500/60 bg-emerald-500/10" : "hover:border-slate-700/80"
                                  )}
                                >
                                  <input
                                    type="radio"
                                    name={question.id}
                                    value={option.value}
                                    checked={state?.answer === option.value}
                                    onChange={(event) => handleQuizAnswerChange(question.id, event.target.value)}
                                    className="h-4 w-4 accent-emerald-500"
                                  />
                                  <span>{option.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : (
                            <textarea
                              value={state?.answer ?? ""}
                              onChange={(event) => handleQuizAnswerChange(question.id, event.target.value)}
                              rows={3}
                              placeholder="Share your scenario and how the concept helps…"
                              className="mt-3 w-full rounded-2xl border border-slate-800/70 bg-slate-900/40 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
                            />
                          )}
                          {feedbackStatus && (
                            <div
                              className={cn(
                                "mt-4 flex items-start gap-3 rounded-2xl border px-3 py-2",
                                feedbackStatus === "correct"
                                  ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                                  : "border-amber-500/40 bg-amber-500/10 text-amber-200"
                              )}
                            >
                              {feedbackStatus === "correct" ? (
                                <CheckCircle2 className="mt-0.5 h-5 w-5" />
                              ) : (
                                <AlertCircle className="mt-0.5 h-5 w-5" />
                              )}
                              <div className="space-y-1 text-sm">
                                <p>
                                  {feedbackStatus === "correct"
                                    ? "Great job! That aligns with the expected answer."
                                    : "Let's review the ideal response."}
                                </p>
                                <p className="text-xs text-slate-200">
                                  <span className="font-semibold text-white">Answer:&nbsp;</span>
                                  {correctLabel}
                                </p>
                                <p className="text-xs text-slate-200">
                                  <span className="font-semibold text-white">Why it matters:&nbsp;</span>
                                  {question.rationale}
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={handleQuizCheck} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                      Check answers
                    </Button>
                    <Button
                      onClick={handleQuizReset}
                      variant="outline"
                      className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-900"
                    >
                      Reset responses
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-400">
                  Launch the manager to request a quiz. You'll be able to check answers and reveal rationales here.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
