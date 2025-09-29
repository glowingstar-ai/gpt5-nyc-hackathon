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
    id: "curriculum",
    name: "Curriculum Strategist",
    tagline: "Designs the staged learning journey",
    accent: "from-sky-500/70 via-cyan-500/60 to-blue-500/70",
    icon: Compass,
  },
  {
    id: "modalities",
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

type TutorStageQuiz = {
  prompt: string;
  answer_key?: string | null;
  remediation: string;
};

type TutorLearningStage = {
  name: string;
  focus: string;
  objectives: string[];
  prerequisites: string[];
  pass_criteria: string[];
  quiz: TutorStageQuiz;
  on_success: string;
  on_failure: string;
};

type TutorConceptBreakdown = {
  concept: string;
  llm_reasoning: string;
  subtopics: string[];
  real_world_connections: string[];
  prerequisites: string[];
  mastery_checks: string[];
  remediation_plan: string;
  advancement_cue: string;
};

type TutorTeachingModality = {
  modality: TutorTeachingModalityKind;
  description: string;
  resources: string[];
};

type TutorAssessmentItem = {
  prompt: string;
  kind: "multiple_choice" | "short_answer" | "reflection" | "practical";
  options?: string[] | null;
  answer_key?: string | null;
};

type TutorAssessmentPlan = {
  title: string;
  format: string;
  human_in_the_loop_notes: string;
  items: TutorAssessmentItem[];
};

type TutorUnderstandingPlan = {
  approach: string;
  diagnostic_questions: string[];
  signals_to_watch: string[];
  beginner_flag_logic: string;
  follow_up_questions: string[];
  max_follow_up_iterations: number;
  escalation_strategy: string;
};

type TutorCompletionPlan = {
  mastery_indicators: string[];
  wrap_up_plan: string;
  follow_up_suggestions: string[];
};

type TutorManagerResponse = {
  model: string;
  generated_at: string;
  topic: string;
  learner_profile: string;
  objectives: string[];
  conversation_manager: {
    agent_role: string;
    topic_extraction_prompt: string;
    level_assessment_summary: string;
    containment_strategy: string;
  };
  agent_hooks: {
    id: AgentId;
    name: string;
    description: string;
    endpoint: string;
  }[];
};

type TutorCurriculumResponse = {
  model: string;
  generated_at: string;
  topic: string;
  concept_breakdown: TutorConceptBreakdown[];
  learning_stages: TutorLearningStage[];
};

type TutorModalitiesResponse = {
  model: string;
  generated_at: string;
  topic: string;
  objectives: string[];
  teaching_modalities: TutorTeachingModality[];
};

type TutorAssessmentResponse = {
  model: string;
  generated_at: string;
  topic: string;
  assessment: TutorAssessmentPlan;
  stage_quizzes: { stage: string; quiz: TutorStageQuiz }[];
};

type TutorCoachResponse = {
  model: string;
  generated_at: string;
  topic: string;
  understanding: TutorUnderstandingPlan;
  completion: TutorCompletionPlan;
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

type BuildAgentTaskInputs = {
  manager?: TutorManagerResponse | null;
  curriculum?: TutorCurriculumResponse | null;
  modalities?: TutorModalitiesResponse | null;
  assessment?: TutorAssessmentResponse | null;
  coach?: TutorCoachResponse | null;
};

function buildAgentTasks({
  manager,
  curriculum,
  modalities,
  assessment,
  coach,
}: BuildAgentTaskInputs): AgentTask[] {
  const strategistTasks = (curriculum?.learning_stages ?? []).slice(0, 4).map((stage) => {
    const criteriaPreview = stage.pass_criteria[0] ?? "keep the learner engaged";
    return `Architect stage "${stage.name}" focused on ${stage.focus}. Prioritise: ${criteriaPreview}.`;
  });

  const modalityTasks = (modalities?.teaching_modalities ?? []).slice(0, 4).map((modality) => {
    const resourcePreview = modality.resources[0]
      ? `Highlight ${modality.resources[0]}`
      : "Select supporting resources";
    return `Craft a ${modality.modality} experience: ${modality.description}. ${resourcePreview}.`;
  });

  const assessmentTasks = assessment
    ? [
        `Design the "${assessment.assessment.title}" assessment (${assessment.assessment.format}).`,
        assessment.assessment.human_in_the_loop_notes,
        ...assessment.assessment.items.slice(0, 3).map((item, index) => {
          const label = index + 1;
          return `Draft item ${label}: ${item.prompt}`;
        }),
      ]
    : [];

  const coachTasks = coach
    ? [
        `Kick off with: ${coach.understanding.approach}.`,
        coach.understanding.diagnostic_questions[0]
          ? `Use diagnostic question: ${coach.understanding.diagnostic_questions[0]}`
          : "Prepare diagnostic follow-ups.",
        coach.understanding.signals_to_watch.length > 0
          ? `Watch for: ${coach.understanding.signals_to_watch.slice(0, 2).join(", ")}.`
          : "Define signals to watch during sessions.",
        `Wrap-up plan: ${coach.completion.wrap_up_plan}.`,
      ]
    : [];

  const managerTasks = manager
    ? [
        manager.conversation_manager.agent_role,
        `Topic extraction focus: ${manager.conversation_manager.topic_extraction_prompt}.`,
        `Level insights: ${manager.conversation_manager.level_assessment_summary}.`,
        `Containment strategy: ${manager.conversation_manager.containment_strategy}.`,
      ]
    : ["Coordinate the tutoring collective and route work to specialist agents."];

  return [
    {
      agentId: "manager",
      headline: "Coordinate the tutoring collective",
      tasks: managerTasks,
    },
    {
      agentId: "curriculum",
      headline: "Design the learning journey",
      tasks:
        strategistTasks.length > 0
          ? strategistTasks
          : ["Outline staged progression to cover the concept effectively."],
    },
    {
      agentId: "modalities",
      headline: "Curate multi-modal experiences",
      tasks:
        modalityTasks.length > 0
          ? modalityTasks
          : ["Select supporting resources and craft explanations across modalities."],
    },
    {
      agentId: "assessment",
      headline: "Engineer mastery checks",
      tasks:
        assessmentTasks.length > 0
          ? assessmentTasks
          : ["Build assessments that surface understanding and misconceptions."],
    },
    {
      agentId: "coach",
      headline: "Coach the learner through the plan",
      tasks:
        coachTasks.length > 0
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
  const [managerOverview, setManagerOverview] = useState<TutorManagerResponse | null>(null);
  const [curriculumPlan, setCurriculumPlan] = useState<TutorCurriculumResponse | null>(null);
  const [modalitiesPlan, setModalitiesPlan] = useState<TutorModalitiesResponse | null>(null);
  const [assessmentPlan, setAssessmentPlan] = useState<TutorAssessmentResponse | null>(null);
  const [coachPlan, setCoachPlan] = useState<TutorCoachResponse | null>(null);
  const [assignmentBoard, setAssignmentBoard] = useState<AgentTask[]>([]);
  const [quizState, setQuizState] = useState<
    Record<
      number,
      {
        selectedOption: string | null;
        responseText: string;
        status: "correct" | "incorrect" | "submitted" | null;
        revealed: boolean;
      }
    >
  >({});
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatViewportRef.current) return;
    chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    if (!assessmentPlan) {
      setQuizState({});
      return;
    }
    const initial: Record<number, { selectedOption: string | null; responseText: string; status: "correct" | "incorrect" | "submitted" | null; revealed: boolean }> =
      {};
    assessmentPlan.assessment.items.forEach((_, index) => {
      initial[index] = {
        selectedOption: null,
        responseText: "",
        status: null,
        revealed: false,
      };
    });
    setQuizState(initial);
  }, [assessmentPlan]);

  const formattedTimestamp = useMemo(() => {
    if (!managerOverview) return null;
    return formatDate(managerOverview.generated_at);
  }, [managerOverview]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }, []);

  const handleSelectOption = useCallback((index: number, option: string) => {
    setQuizState((previous) => {
      const current = previous[index] ?? {
        selectedOption: null,
        responseText: "",
        status: null,
        revealed: false,
      };
      return {
        ...previous,
        [index]: {
          ...current,
          selectedOption: option,
          status: null,
        },
      };
    });
  }, []);

  const handleResponseChange = useCallback((index: number, value: string) => {
    setQuizState((previous) => {
      const current = previous[index] ?? {
        selectedOption: null,
        responseText: "",
        status: null,
        revealed: false,
      };
      return {
        ...previous,
        [index]: {
          ...current,
          responseText: value,
          status: null,
        },
      };
    });
  }, []);

  const handleCheckAnswer = useCallback((index: number, item: TutorAssessmentItem) => {
    setQuizState((previous) => {
      const current = previous[index] ?? {
        selectedOption: null,
        responseText: "",
        status: null,
        revealed: false,
      };
      if (item.kind === "multiple_choice") {
        if (!current.selectedOption) {
          return previous;
        }
        const expected = item.answer_key?.trim().toLowerCase();
        const actual = current.selectedOption.trim().toLowerCase();
        const isCorrect = expected ? actual === expected : false;
        return {
          ...previous,
          [index]: {
            ...current,
            status: isCorrect ? "correct" : "incorrect",
          },
        };
      }
      return {
        ...previous,
        [index]: {
          ...current,
          status: "submitted",
        },
      };
    });
  }, []);

  const handleRevealAnswer = useCallback((index: number) => {
    setQuizState((previous) => {
      const current = previous[index] ?? {
        selectedOption: null,
        responseText: "",
        status: null,
        revealed: false,
      };
      return {
        ...previous,
        [index]: {
          ...current,
          revealed: true,
        },
      };
    });
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

      setManagerOverview(null);
      setCurriculumPlan(null);
      setModalitiesPlan(null);
      setAssessmentPlan(null);
      setCoachPlan(null);
      setAssignmentBoard([]);
      setQuizState({});

      const requestPayload = {
        topic: trimmed,
        student_level: null,
        goals: null,
        preferred_modalities: null,
        additional_context: "Generated from tutor-mode chat interface",
      };
      const requestBody = JSON.stringify(requestPayload);
      const headers = { "Content-Type": "application/json" } as const;

      const fetchJson = async <T,>(path: string): Promise<T> => {
        const response = await fetch(`${API_BASE}${path}`, {
          method: "POST",
          headers,
          body: requestBody,
        });
        if (!response.ok) {
          throw new Error(`Request to ${path} failed with status ${response.status}`);
        }
        return (await response.json()) as T;
      };

      try {
        const managerData = await fetchJson<TutorManagerResponse>("/tutor/mode");
        setManagerOverview(managerData);

        const agentPlaceholders = managerData.agent_hooks.map((hook) => ({
          id: `${hook.id}-loading-${Date.now()}`,
          role: hook.id as AgentId,
          type: "loading" as const,
        }));

        setMessages((previous) =>
          previous.flatMap((message) => {
            if (message.id !== placeholderId) {
              return [message];
            }
            const managerSummary: Message = {
              id: `manager-summary-${Date.now()}`,
              role: "manager",
              type: "text",
              text: `Deploying ${managerData.agent_hooks.length} specialist agents to help you master "${managerData.topic}". Here's how we're dividing the work:`,
            };
            return [managerSummary, ...agentPlaceholders];
          })
        );

        const [
          curriculumResult,
          modalitiesResult,
          assessmentResult,
          coachResult,
        ] = await Promise.allSettled([
          fetchJson<TutorCurriculumResponse>("/tutor/curriculum"),
          fetchJson<TutorModalitiesResponse>("/tutor/modalities"),
          fetchJson<TutorAssessmentResponse>("/tutor/assessment"),
          fetchJson<TutorCoachResponse>("/tutor/coach"),
        ]);

        let curriculumData: TutorCurriculumResponse | null = null;
        let modalitiesData: TutorModalitiesResponse | null = null;
        let assessmentData: TutorAssessmentResponse | null = null;
        let coachData: TutorCoachResponse | null = null;
        const failedAgentNames: string[] = [];

        const hookName = (id: AgentId) =>
          managerData.agent_hooks.find((hook) => hook.id === id)?.name ?? id;

        if (curriculumResult.status === "fulfilled") {
          curriculumData = curriculumResult.value;
          setCurriculumPlan(curriculumResult.value);
        } else {
          failedAgentNames.push(hookName("curriculum"));
        }

        if (modalitiesResult.status === "fulfilled") {
          modalitiesData = modalitiesResult.value;
          setModalitiesPlan(modalitiesResult.value);
        } else {
          failedAgentNames.push(hookName("modalities"));
        }

        if (assessmentResult.status === "fulfilled") {
          assessmentData = assessmentResult.value;
          setAssessmentPlan(assessmentResult.value);
        } else {
          failedAgentNames.push(hookName("assessment"));
        }

        if (coachResult.status === "fulfilled") {
          coachData = coachResult.value;
          setCoachPlan(coachResult.value);
        } else {
          failedAgentNames.push(hookName("coach"));
        }

        const tasks = buildAgentTasks({
          manager: managerData,
          curriculum: curriculumData,
          modalities: modalitiesData,
          assessment: assessmentData,
          coach: coachData,
        });
        setAssignmentBoard(tasks);

        setMessages((previous) => {
          const withoutLoading = previous.filter((message) => message.type !== "loading");
          const taskMessages: Message[] = tasks.map((task, index) => ({
            id: `${task.agentId}-${Date.now()}-${index}`,
            role: task.agentId,
            type: "tasks",
            headline: task.headline,
            tasks: task.tasks,
          }));
          const nextMessages = [...withoutLoading, ...taskMessages];
          if (failedAgentNames.length > 0) {
            nextMessages.push({
              id: `warning-${Date.now()}`,
              role: "manager",
              type: "text",
              text: `Heads up: I couldn't reach the ${failedAgentNames.join(", ")} agent${failedAgentNames.length > 1 ? "s" : ""}. Check back shortly for their materials.`,
            });
          }
          return nextMessages;
        });
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

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Latest GPT-5 intel</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Manager snapshot</h2>
              {managerOverview ? (
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Topic</p>
                    <p className="mt-1 text-base text-white">{managerOverview.topic}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Learner profile</p>
                    <p className="mt-1 text-slate-300">{managerOverview.learner_profile}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Objectives</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {managerOverview.objectives.slice(0, 4).map((objective, index) => (
                        <li key={index}>{objective}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Manager directives</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      <li>{managerOverview.conversation_manager.agent_role}</li>
                      <li>{managerOverview.conversation_manager.topic_extraction_prompt}</li>
                      <li>{managerOverview.conversation_manager.level_assessment_summary}</li>
                      <li>{managerOverview.conversation_manager.containment_strategy}</li>
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Model</p>
                    <p className="mt-1 text-slate-300">{managerOverview.model}</p>
                  </div>
                  {formattedTimestamp && (
                    <div>
                      <p className="text-xs uppercase text-slate-500">Generated</p>
                      <p className="mt-1 text-slate-300">{formattedTimestamp}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs uppercase text-slate-500">Agent hooks</p>
                    <ul className="mt-2 space-y-2">
                      {managerOverview.agent_hooks.map((hook) => (
                        <li
                          key={hook.id}
                          className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-3 text-slate-200"
                        >
                          <p className="text-sm font-semibold text-white">{hook.name}</p>
                          <p className="text-xs text-slate-400">{hook.description}</p>
                          <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-emerald-400">
                            {hook.endpoint}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-900/60 bg-slate-900/50 p-5 text-sm text-slate-400">
                  Ask the manager to plan a session to populate this snapshot.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Curriculum blueprint</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Learning path</h2>
              {curriculumPlan ? (
                <div className="mt-4 space-y-5 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Stages</p>
                    <div className="mt-3 space-y-3">
                      {curriculumPlan.learning_stages.map((stage, index) => (
                        <div
                          key={stage.name}
                          className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-white">
                              Stage {index + 1}: {stage.name}
                            </p>
                            <span className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                              {stage.focus}
                            </span>
                          </div>
                          <p className="mt-2 text-slate-300">
                            {stage.objectives[0] ?? "Focus on building intuition for this topic."}
                          </p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <div>
                              <p className="text-xs uppercase text-slate-500">Prerequisites</p>
                              <ul className="mt-2 space-y-1 text-slate-300">
                                {(stage.prerequisites.length > 0 ? stage.prerequisites : ["None specified"]).map(
                                  (item, idx) => (
                                    <li key={idx}>{item}</li>
                                  )
                                )}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-slate-500">Pass criteria</p>
                              <ul className="mt-2 space-y-1 text-slate-300">
                                {(stage.pass_criteria.length > 0
                                  ? stage.pass_criteria
                                  : ["Demonstrate understanding before advancing."]).map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-3">
                            <p className="text-xs uppercase text-slate-500">Quiz prompt</p>
                            <p className="mt-1 text-slate-200">{stage.quiz.prompt}</p>
                            <p className="mt-2 text-xs text-slate-500">Remediation: {stage.quiz.remediation}</p>
                          </div>
                          <div className="mt-3 text-xs text-slate-500">
                            <p>On success: {stage.on_success}</p>
                            <p className="mt-1">On failure: {stage.on_failure}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Key concepts</p>
                    <div className="mt-3 space-y-3">
                      {curriculumPlan.concept_breakdown.slice(0, 3).map((concept) => (
                        <div
                          key={concept.concept}
                          className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
                        >
                          <p className="text-sm font-semibold text-white">{concept.concept}</p>
                          <p className="mt-2 text-slate-300">{concept.llm_reasoning}</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-3">
                            <div>
                              <p className="text-xs uppercase text-slate-500">Subtopics</p>
                              <ul className="mt-2 space-y-1 text-slate-300">
                                {(concept.subtopics.length > 0 ? concept.subtopics : ["Introduce fundamentals."]).map(
                                  (item, idx) => (
                                    <li key={idx}>{item}</li>
                                  )
                                )}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-slate-500">Connections</p>
                              <ul className="mt-2 space-y-1 text-slate-300">
                                {(concept.real_world_connections.length > 0
                                  ? concept.real_world_connections
                                  : ["Relate to a real-world scenario."]).map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs uppercase text-slate-500">Mastery checks</p>
                              <ul className="mt-2 space-y-1 text-slate-300">
                                {(concept.mastery_checks.length > 0
                                  ? concept.mastery_checks
                                  : ["Ask the learner to explain in their own words."]).map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      ))}
                      {curriculumPlan.concept_breakdown.length > 3 && (
                        <p className="text-xs text-slate-500">
                          Additional concepts are available through the curriculum API endpoint.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-900/60 bg-slate-900/50 p-5 text-sm text-slate-400">
                  The curriculum strategist will populate staged learning materials once you launch a tutoring request.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Modality lab</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Teaching approaches</h2>
              {modalitiesPlan ? (
                <div className="mt-4 space-y-3 text-sm text-slate-200">
                  {modalitiesPlan.teaching_modalities.map((modality) => (
                    <div
                      key={`${modality.modality}-${modality.description.slice(0, 12)}`}
                      className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white capitalize">{modality.modality}</p>
                        <span className="text-xs uppercase tracking-[0.2em] text-emerald-400">
                          {modalitiesPlan.topic}
                        </span>
                      </div>
                      <p className="mt-2 text-slate-300">{modality.description}</p>
                      {modality.resources.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs uppercase text-slate-500">Suggested resources</p>
                          <ul className="mt-2 space-y-1 text-slate-300">
                            {modality.resources.map((resource, index) => (
                              <li key={index}>{resource}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-900/60 bg-slate-900/50 p-5 text-sm text-slate-400">
                  The modality researcher shares resources here once you brief the collective.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Assessment studio</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Take the quiz</h2>
              {assessmentPlan ? (
                <div className="mt-4 space-y-5 text-sm text-slate-200">
                  <div className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
                    <p className="text-sm font-semibold text-white">{assessmentPlan.assessment.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                      {assessmentPlan.assessment.format}
                    </p>
                    <p className="mt-2 text-slate-300">
                      {assessmentPlan.assessment.human_in_the_loop_notes}
                    </p>
                  </div>
                  <div className="space-y-4">
                    {assessmentPlan.assessment.items.map((item, index) => {
                      const state = quizState[index];
                      const status = state?.status ?? null;
                      const reveal = state?.revealed ?? false;
                      const disableCheck =
                        item.kind === "multiple_choice" && !(state?.selectedOption && state.selectedOption.length > 0);
                      return (
                        <div
                          key={`${item.prompt}-${index}`}
                          className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">
                              Question {index + 1}: {item.kind.replace("_", " ")}
                            </p>
                            {status === "correct" && (
                              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-400">
                                Correct
                              </span>
                            )}
                            {status === "incorrect" && (
                              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-rose-400">
                                Try again
                              </span>
                            )}
                            {status === "submitted" && (
                              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                                Submitted
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-slate-300">{item.prompt}</p>
                          {item.options && item.options.length > 0 ? (
                            <div className="mt-4 space-y-2">
                              {item.options.map((option, optionIndex) => {
                                const isSelected = state?.selectedOption === option;
                                return (
                                  <button
                                    key={optionIndex}
                                    type="button"
                                    onClick={() => handleSelectOption(index, option)}
                                    className={cn(
                                      "w-full rounded-xl border px-3 py-2 text-left text-sm transition",
                                      isSelected
                                        ? "border-emerald-400/80 bg-emerald-500/10 text-emerald-200"
                                        : "border-slate-800/80 bg-slate-900/40 text-slate-200 hover:border-emerald-400/40"
                                    )}
                                  >
                                    {option}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <textarea
                              value={state?.responseText ?? ""}
                              onChange={(event) => handleResponseChange(index, event.target.value)}
                              rows={3}
                              placeholder="Type your response here…"
                              className="mt-4 w-full rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-emerald-400/60 focus:outline-none"
                            />
                          )}
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <Button
                              type="button"
                              onClick={() => handleCheckAnswer(index, item)}
                              disabled={disableCheck}
                              className="bg-emerald-500 text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-500/50"
                            >
                              Check answer
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleRevealAnswer(index)}
                              className="border-emerald-500/40 text-emerald-300 hover:border-emerald-400 hover:text-emerald-200"
                            >
                              {reveal ? "Hide answer" : "Reveal answer"}
                            </Button>
                          </div>
                          {reveal && (
                            <div className="mt-3 rounded-xl border border-slate-800/60 bg-slate-900/50 p-3 text-sm text-slate-200">
                              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Answer key</p>
                              <p className="mt-1 text-slate-200">
                                {item.answer_key ?? "The facilitator will review this response manually."}
                              </p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {assessmentPlan.stage_quizzes.length > 0 && (
                    <div className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
                      <p className="text-sm font-semibold text-white">Stage-level quizzes</p>
                      <ul className="mt-3 space-y-3 text-slate-200">
                        {assessmentPlan.stage_quizzes.map((quiz) => (
                          <li
                            key={quiz.stage}
                            className="rounded-xl border border-slate-800/60 bg-slate-900/50 p-3"
                          >
                            <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">{quiz.stage}</p>
                            <p className="mt-1 text-slate-200">{quiz.quiz.prompt}</p>
                            {quiz.quiz.answer_key && (
                              <p className="mt-2 text-xs text-slate-500">Answer key: {quiz.quiz.answer_key}</p>
                            )}
                            <p className="mt-2 text-xs text-slate-500">Remediation: {quiz.quiz.remediation}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-900/60 bg-slate-900/50 p-5 text-sm text-slate-400">
                  Launch a tutoring request to receive quizzes and answer keys from the assessment architect.
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Progress coaching</p>
              <h2 className="mt-2 text-lg font-semibold text-white">Understanding signals</h2>
              {coachPlan ? (
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Approach</p>
                    <p className="mt-1 text-slate-300">{coachPlan.understanding.approach}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Diagnostic questions</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {coachPlan.understanding.diagnostic_questions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Signals to watch</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {coachPlan.understanding.signals_to_watch.map((signal, index) => (
                        <li key={index}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Escalation strategy</p>
                    <p className="mt-1 text-slate-300">{coachPlan.understanding.escalation_strategy}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Completion plan</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      <li>Wrap up: {coachPlan.completion.wrap_up_plan}</li>
                      {coachPlan.completion.mastery_indicators.map((indicator, index) => (
                        <li key={index}>Indicator: {indicator}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Follow-up suggestions</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {coachPlan.completion.follow_up_suggestions.map((suggestion, index) => (
                        <li key={index}>{suggestion}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-slate-900/60 bg-slate-900/50 p-5 text-sm text-slate-400">
                  The progress coach will share diagnostic and celebration tips after the manager assembles a plan.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
