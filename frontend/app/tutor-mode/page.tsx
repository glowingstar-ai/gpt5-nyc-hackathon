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

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

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

type TutorManagerAgentResponse = {
  model: string;
  generated_at: string;
  topic: string;
  learner_profile: string;
  objectives: string[];
  manager: {
    agent_role: string;
    topic_extraction_prompt: string;
    level_assessment_summary: string;
    containment_strategy: string;
  };
  understanding: {
    approach: string;
    diagnostic_questions: string[];
    signals_to_watch: string[];
    beginner_flag_logic: string;
    follow_up_questions: string[];
    max_follow_up_iterations: number;
    escalation_strategy: string;
  };
  completion: {
    mastery_indicators: string[];
    wrap_up_plan: string;
    follow_up_suggestions: string[];
  };
  agents: {
    id: "manager" | "curriculum" | "modalities" | "assessment" | "coach";
    name: string;
    description: string;
    endpoint: string;
    capabilities: string[];
  }[];
};

type TutorCurriculumAgentResponse = {
  model: string;
  generated_at: string;
  topic: string;
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

type TutorModalitiesAgentResponse = {
  model: string;
  generated_at: string;
  topic: string;
  teaching_modalities: {
    modality: TutorTeachingModalityKind;
    description: string;
    resources: string[];
  }[];
};

type AssessmentItemKind =
  | "multiple_choice"
  | "short_answer"
  | "reflection"
  | "practical";

type TutorAssessmentAgentResponse = {
  model: string;
  generated_at: string;
  topic: string;
  assessment: {
    title: string;
    format: string;
    human_in_the_loop_notes: string;
    items: {
      prompt: string;
      kind: AssessmentItemKind;
      options?: string[] | null;
      answer_key?: string | null;
    }[];
  };
  stage_quizzes: {
    stage_name: string;
    pass_criteria: string[];
    on_success: string;
    on_failure: string;
    quiz: {
      prompt: string;
      answer_key?: string | null;
      remediation: string;
    };
  }[];
};

type TutorCoachAgentResponse = {
  model: string;
  generated_at: string;
  topic: string;
  objectives: string[];
  understanding: TutorManagerAgentResponse["understanding"];
  completion: TutorManagerAgentResponse["completion"];
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

type QuizStatus = "idle" | "correct" | "incorrect";

type QuizResponseState = {
  answer: string;
  status: QuizStatus;
  revealed: boolean;
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

function normalizeAnswer(value: string | null | undefined) {
  return value ? value.trim().toLowerCase() : "";
}

function buildAgentTasks(options: {
  manager: TutorManagerAgentResponse | null;
  curriculum: TutorCurriculumAgentResponse | null;
  modalities: TutorModalitiesAgentResponse | null;
  assessment: TutorAssessmentAgentResponse | null;
  coach: TutorCoachAgentResponse | null;
}): AgentTask[] {
  const managerTasks = options.manager
    ? [
        options.manager.manager.agent_role,
        `Topic extraction focus: ${options.manager.manager.topic_extraction_prompt}.`,
        `Level insights: ${options.manager.manager.level_assessment_summary}.`,
        `Containment strategy: ${options.manager.manager.containment_strategy}.`,
      ]
    : [
        "Open with a warm introduction and clarify the learner's objective.",
        "Confirm the topic before dispatching other agents.",
      ];

  const strategistTasks = options.curriculum?.learning_stages?.map((stage) => {
    const criteriaPreview = stage.pass_criteria[0] ?? "reinforce understanding";
    return `Architect stage "${stage.name}" focused on ${stage.focus}. Prioritise: ${criteriaPreview}.`;
  });

  const modalityTasks = options.modalities?.teaching_modalities?.map((modality) => {
    const resourcePreview = modality.resources[0]
      ? `Highlight ${modality.resources[0]}`
      : "Select supporting resources";
    return `Craft a ${modality.modality} experience: ${modality.description}. ${resourcePreview}.`;
  });

  const assessmentTasks = options.assessment
    ? [
        `Design the "${options.assessment.assessment.title}" assessment (${options.assessment.assessment.format}).`,
        options.assessment.assessment.human_in_the_loop_notes,
        ...options.assessment.assessment.items.slice(0, 3).map((item, index) => {
          const label = index + 1;
          return `Draft item ${label}: ${item.prompt}`;
        }),
      ]
    : ["Draft formative and summative checks aligned to the curriculum."];

  const coachUnderstanding = options.coach ?? null;
  const coachTasks = coachUnderstanding
    ? [
        `Kick off with: ${coachUnderstanding.understanding.approach}.`,
        coachUnderstanding.understanding.diagnostic_questions[0]
          ? `Use diagnostic question: ${coachUnderstanding.understanding.diagnostic_questions[0]}`
          : "Prepare diagnostic follow-ups.",
        `Watch for: ${coachUnderstanding.understanding.signals_to_watch
          .slice(0, 2)
          .join(", ")}.`,
        `Wrap-up plan: ${coachUnderstanding.completion.wrap_up_plan}.`,
      ]
    : [
        "Gauge the learner's current mastery and capture actionable signals.",
        "Plan how to celebrate progress and recommend next steps.",
      ];

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
        strategistTasks && strategistTasks.length > 0
          ? strategistTasks
          : ["Outline staged progression to cover the concept effectively."],
    },
    {
      agentId: "modalities",
      headline: "Curate multi-modal experiences",
      tasks:
        modalityTasks && modalityTasks.length > 0
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
      tasks: coachTasks,
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
  const [managerData, setManagerData] = useState<TutorManagerAgentResponse | null>(null);
  const [curriculumData, setCurriculumData] =
    useState<TutorCurriculumAgentResponse | null>(null);
  const [modalitiesData, setModalitiesData] =
    useState<TutorModalitiesAgentResponse | null>(null);
  const [assessmentData, setAssessmentData] =
    useState<TutorAssessmentAgentResponse | null>(null);
  const [coachData, setCoachData] =
    useState<TutorCoachAgentResponse | null>(null);
  const [assignmentBoard, setAssignmentBoard] = useState<AgentTask[]>([]);
  const [quizResponses, setQuizResponses] = useState<Record<number, QuizResponseState>>({});
  const [stageQuizReveals, setStageQuizReveals] = useState<Record<number, boolean>>({});
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatViewportRef.current) return;
    chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setQuizResponses({});
    setStageQuizReveals({});
  }, [assessmentData]);

  const formattedTimestamp = useMemo(() => {
    if (!managerData) return null;
    return formatDate(managerData.generated_at);
  }, [managerData]);

  const coachPlan: TutorCoachAgentResponse | null = useMemo(() => {
    if (coachData) return coachData;
    if (!managerData) return null;
    return {
      model: managerData.model,
      generated_at: managerData.generated_at,
      topic: managerData.topic,
      objectives: managerData.objectives,
      understanding: managerData.understanding,
      completion: managerData.completion,
    };
  }, [coachData, managerData]);

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
      setManagerData(null);
      setCurriculumData(null);
      setModalitiesData(null);
      setAssessmentData(null);
      setCoachData(null);
      setAssignmentBoard([]);
      setQuizResponses({});
      setStageQuizReveals({});

      const payload = {
        topic: trimmed,
        student_level: null,
        goals: null,
        preferred_modalities: null,
        additional_context: "Generated from tutor-mode chat interface",
      };

      const requestBody = JSON.stringify(payload);

      try {
        const managerResponse = await fetch(`${API_BASE}/tutor/manager`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: requestBody,
        });

        if (!managerResponse.ok) {
          throw new Error("Unable to coordinate the tutor manager right now.");
        }

        const managerJson: TutorManagerAgentResponse = await managerResponse.json();

        const fetchAgent = async <T,>(path: string) => {
          const response = await fetch(`${API_BASE}${path}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
          });
          if (!response.ok) {
            throw new Error(`Agent request failed for ${path}`);
          }
          return (await response.json()) as T;
        };

        const [curriculumResult, modalitiesResult, assessmentResult, coachResult] =
          await Promise.allSettled([
            fetchAgent<TutorCurriculumAgentResponse>("/tutor/curriculum"),
            fetchAgent<TutorModalitiesAgentResponse>("/tutor/modalities"),
            fetchAgent<TutorAssessmentAgentResponse>("/tutor/assessment"),
            fetchAgent<TutorCoachAgentResponse>("/tutor/coach"),
          ]);

        const curriculumJson =
          curriculumResult.status === "fulfilled" ? curriculumResult.value : null;
        const modalitiesJson =
          modalitiesResult.status === "fulfilled" ? modalitiesResult.value : null;
        const assessmentJson =
          assessmentResult.status === "fulfilled" ? assessmentResult.value : null;
        const coachJson = coachResult.status === "fulfilled" ? coachResult.value : null;

        if (curriculumResult.status === "rejected") {
          console.error(curriculumResult.reason);
        }
        if (modalitiesResult.status === "rejected") {
          console.error(modalitiesResult.reason);
        }
        if (assessmentResult.status === "rejected") {
          console.error(assessmentResult.reason);
        }
        if (coachResult.status === "rejected") {
          console.error(coachResult.reason);
        }

        const fallbackCoach: TutorCoachAgentResponse = {
          model: managerJson.model,
          generated_at: managerJson.generated_at,
          topic: managerJson.topic,
          objectives: managerJson.objectives,
          understanding: managerJson.understanding,
          completion: managerJson.completion,
        };

        const tasks = buildAgentTasks({
          manager: managerJson,
          curriculum: curriculumJson,
          modalities: modalitiesJson,
          assessment: assessmentJson,
          coach: coachJson ?? fallbackCoach,
        });

        setManagerData(managerJson);
        setCurriculumData(curriculumJson);
        setModalitiesData(modalitiesJson);
        setAssessmentData(assessmentJson);
        setCoachData(coachJson);
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
              text: `Manager agent deployed ${tasks.length} specialists to help you master "${managerJson.topic}". Here's how the work is divided:`,
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

  const updateQuizResponse = useCallback((index: number, value: string) => {
    setQuizResponses((previous) => ({
      ...previous,
      [index]: {
        answer: value,
        status: "idle",
        revealed: previous[index]?.revealed ?? false,
      },
    }));
  }, []);

  const checkQuizResponse = useCallback(
    (index: number) => {
      if (!assessmentData) return;
      const item = assessmentData.assessment.items[index];
      const answerKey = item.answer_key ?? "";

      if (!answerKey) {
        setQuizResponses((previous) => ({
          ...previous,
          [index]: {
            answer: previous[index]?.answer ?? "",
            status: previous[index]?.status ?? "idle",
            revealed: true,
          },
        }));
        return;
      }

      setQuizResponses((previous) => {
        const current = previous[index] ?? { answer: "", status: "idle" as QuizStatus, revealed: false };
        const isCorrect =
          normalizeAnswer(current.answer) !== "" &&
          normalizeAnswer(current.answer) === normalizeAnswer(answerKey);

        return {
          ...previous,
          [index]: {
            answer: current.answer,
            status: isCorrect ? "correct" : "incorrect",
            revealed: isCorrect ? true : current.revealed,
          },
        };
      });
    },
    [assessmentData]
  );

  const revealQuizAnswer = useCallback((index: number) => {
    setQuizResponses((previous) => {
      const current = previous[index] ?? { answer: "", status: "idle" as QuizStatus, revealed: false };
      return {
        ...previous,
        [index]: {
          ...current,
          revealed: true,
        },
      };
    });
  }, []);

  const toggleStageReveal = useCallback((index: number) => {
    setStageQuizReveals((previous) => ({
      ...previous,
      [index]: !previous[index],
    }));
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

            {managerData && (
              <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/60">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Latest GPT-5 intel</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Plan snapshot</h2>
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Topic</p>
                    <p className="mt-1 text-base text-white">{managerData.topic}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Learner profile</p>
                    <p className="mt-1 text-slate-300">{managerData.learner_profile}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Objectives</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {managerData.objectives.slice(0, 4).map((objective, index) => (
                        <li key={index}>{objective}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Model</p>
                    <p className="mt-1 text-slate-300">{managerData.model}</p>
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

        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Mission control</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Manager agent briefing</h2>
            </div>
          </div>
          {managerData ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Conversation directives</h3>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  <li>
                    <span className="font-semibold text-slate-100">Role:</span> {managerData.manager.agent_role}
                  </li>
                  <li>
                    <span className="font-semibold text-slate-100">Topic extraction:</span> {managerData.manager.topic_extraction_prompt}
                  </li>
                  <li>
                    <span className="font-semibold text-slate-100">Level assessment:</span> {managerData.manager.level_assessment_summary}
                  </li>
                  <li>
                    <span className="font-semibold text-slate-100">Containment:</span> {managerData.manager.containment_strategy}
                  </li>
                </ul>
              </div>
              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Agent roster</h3>
                <ul className="mt-3 space-y-3 text-sm text-slate-300">
                  {managerData.agents.map((agent) => (
                    <li key={agent.id} className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                      <p className="text-sm font-semibold text-white">{agent.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
                        {agent.endpoint}
                      </p>
                      <p className="mt-2 text-xs text-slate-400">{agent.description}</p>
                      <ul className="mt-3 space-y-1 text-xs text-slate-400">
                        {agent.capabilities.map((capability, index) => (
                          <li key={index} className="flex items-start gap-2">
                            <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                            <span>{capability}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-400">
              Share a learning goal above to activate the manager briefing.
            </div>
          )}
        </section>
        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Learning blueprint</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Curriculum strategist output</h2>
            </div>
          </div>
          {curriculumData ? (
            <div className="mt-6 space-y-6">
              <div className="grid gap-4 lg:grid-cols-2">
                {curriculumData.concept_breakdown.map((concept, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5 shadow-lg shadow-slate-950/40"
                  >
                    <p className="text-sm font-semibold text-white">{concept.concept}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                      Concept rationale
                    </p>
                    <p className="mt-1 text-sm text-slate-300">{concept.llm_reasoning}</p>
                    <div className="mt-4 grid gap-3 text-sm text-slate-300">
                      <div>
                        <p className="text-xs uppercase text-slate-500">Subtopics</p>
                        <ul className="mt-1 space-y-1">
                          {concept.subtopics.map((item, subIndex) => (
                            <li key={subIndex} className="flex items-start gap-2">
                              <AgentGlyph className="mt-0.5 h-3 w-3 text-emerald-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="text-xs uppercase text-slate-500">Real-world ties</p>
                        <ul className="mt-1 space-y-1">
                          {concept.real_world_connections.map((item, linkIndex) => (
                            <li key={linkIndex} className="flex items-start gap-2">
                              <AgentGlyph className="mt-0.5 h-3 w-3 text-amber-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-xs text-slate-400">
                      <div>
                        <p className="font-semibold text-slate-200">Prerequisites</p>
                        <ul className="mt-1 space-y-1">
                          {concept.prerequisites.map((item, preIndex) => (
                            <li key={preIndex}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-200">Mastery checks</p>
                        <ul className="mt-1 space-y-1">
                          {concept.mastery_checks.map((item, masteryIndex) => (
                            <li key={masteryIndex}>{item}</li>
                          ))}
                        </ul>
                      </div>
                      <p>
                        <span className="font-semibold text-slate-200">Remediation:</span> {concept.remediation_plan}
                      </p>
                      <p>
                        <span className="font-semibold text-slate-200">Advancement cue:</span> {concept.advancement_cue}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Stage timeline</h3>
                <div className="mt-4 space-y-5">
                  {curriculumData.learning_stages.map((stage, index) => (
                    <div key={index} className="rounded-xl border border-slate-800/60 bg-slate-950/60 p-5">
                      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm font-semibold text-white">{stage.name}</p>
                        <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{stage.focus}</p>
                      </div>
                      <div className="mt-3 grid gap-3 text-sm text-slate-300 md:grid-cols-2">
                        <div>
                          <p className="text-xs uppercase text-slate-500">Objectives</p>
                          <ul className="mt-1 space-y-1">
                            {stage.objectives.map((item, objIndex) => (
                              <li key={objIndex}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="text-xs uppercase text-slate-500">Prerequisites</p>
                          <ul className="mt-1 space-y-1">
                            {stage.prerequisites.map((item, preIndex) => (
                              <li key={preIndex}>{item}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
                        <div>
                          <p className="font-semibold text-slate-200">Pass criteria</p>
                          <ul className="mt-1 space-y-1">
                            {stage.pass_criteria.map((item, criteriaIndex) => (
                              <li key={criteriaIndex}>{item}</li>
                            ))}
                          </ul>
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">If successful</p>
                          <p className="mt-1">{stage.on_success}</p>
                          <p className="mt-2 font-semibold text-slate-200">If reinforcement is needed</p>
                          <p className="mt-1">{stage.on_failure}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-400">
              Activate the curriculum agent by submitting a learning request above.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Resource lab</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Modality researcher output</h2>
            </div>
          </div>
          {modalitiesData ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {modalitiesData.teaching_modalities.map((modality, index) => (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5 shadow-lg shadow-slate-950/40"
                >
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-300">
                    {modality.modality}
                  </p>
                  <p className="mt-2 text-sm text-slate-200">{modality.description}</p>
                  <p className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">Resources</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-300">
                    {modality.resources.map((resource, resourceIndex) => (
                      <li key={resourceIndex} className="flex items-start gap-2">
                        <AgentGlyph className="mt-0.5 h-3 w-3 text-emerald-400" />
                        <span>{resource}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-400">
              The modality researcher will appear here once you run a tutoring request.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Assessment hub</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Assessment architect output</h2>
            </div>
          </div>
          {assessmentData ? (
            <div className="mt-6 space-y-6">
              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Assessment overview</h3>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-semibold text-slate-100">Title:</span> {assessmentData.assessment.title}
                </p>
                <p className="mt-1 text-sm text-slate-300">
                  <span className="font-semibold text-slate-100">Format:</span> {assessmentData.assessment.format}
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  {assessmentData.assessment.human_in_the_loop_notes}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Take the quiz</h3>
                <div className="mt-4 space-y-5">
                  {assessmentData.assessment.items.map((item, index) => {
                    const state =
                      quizResponses[index] ?? ({ answer: "", status: "idle", revealed: false } as QuizResponseState);
                    const hasOptions = item.options && item.options.length > 0;
                    const statusStyles =
                      state.status === "correct"
                        ? "border-emerald-500/50 bg-emerald-500/10"
                        : state.status === "incorrect"
                        ? "border-rose-500/50 bg-rose-500/10"
                        : "border-slate-800/70 bg-slate-950/60";

                    return (
                      <div
                        key={index}
                        className={cn(
                          "rounded-2xl border px-5 py-4 text-sm text-slate-200 shadow-md shadow-slate-950/30",
                          statusStyles
                        )}
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
                          <p className="text-sm font-semibold text-white">Question {index + 1}</p>
                          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{item.kind.replace("_", " ")}</p>
                        </div>
                        <p className="mt-2 text-sm text-slate-200">{item.prompt}</p>
                        <div className="mt-3 space-y-3">
                          {hasOptions ? (
                            <div className="space-y-2">
                              {item.options?.map((option, optionIndex) => {
                                const optionLabel = String.fromCharCode(65 + optionIndex);
                                return (
                                  <label
                                    key={optionIndex}
                                    className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-800/70 bg-slate-900/70 px-4 py-3 text-sm hover:border-emerald-500/60"
                                  >
                                    <input
                                      type="radio"
                                      name={`quiz-${index}`}
                                      value={option}
                                      checked={state.answer === option}
                                      onChange={() => updateQuizResponse(index, option)}
                                      className="mt-1 h-4 w-4"
                                      disabled={state.revealed}
                                    />
                                    <span>
                                      <span className="font-semibold text-emerald-300">{optionLabel}.</span> {option}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          ) : (
                            <textarea
                              value={state.answer}
                              onChange={(event) => updateQuizResponse(index, event.target.value)}
                              rows={3}
                              className="w-full rounded-xl border border-slate-800/70 bg-slate-950/60 p-3 text-sm text-slate-200 outline-none placeholder:text-slate-500"
                              placeholder="Type your answer"
                              disabled={state.revealed}
                            />
                          )}
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="bg-emerald-500/90 text-slate-950 hover:bg-emerald-400"
                            onClick={() => checkQuizResponse(index)}
                            disabled={state.revealed && state.status === "correct"}
                          >
                            Check answer
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                            onClick={() => revealQuizAnswer(index)}
                          >
                            Reveal answer
                          </Button>
                          {state.status === "correct" && <span className="text-emerald-300">Correct! 🎉</span>}
                          {state.status === "incorrect" && state.revealed && (
                            <span className="text-rose-300">Let&rsquo;s review the solution together.</span>
                          )}
                          {state.revealed && item.answer_key && (
                            <span className="text-slate-300">
                              <span className="font-semibold text-slate-100">Answer:</span> {item.answer_key}
                            </span>
                          )}
                          {state.revealed && !item.answer_key && (
                            <span className="text-slate-300">
                              Answer key provided during the live coaching session.
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Stage mastery checkpoints</h3>
                <div className="mt-4 space-y-4">
                  {assessmentData.stage_quizzes.map((stageQuiz, index) => {
                    const revealed = stageQuizReveals[index] ?? false;
                    return (
                      <div key={index} className="rounded-xl border border-slate-800/70 bg-slate-950/60 p-4">
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="text-sm font-semibold text-white">{stageQuiz.stage_name}</p>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                            onClick={() => toggleStageReveal(index)}
                          >
                            {revealed ? "Hide guidance" : "Reveal guidance"}
                          </Button>
                        </div>
                        <p className="mt-2 text-sm text-slate-300">{stageQuiz.quiz.prompt}</p>
                        <div className="mt-3 grid gap-3 text-xs text-slate-400 md:grid-cols-2">
                          <div>
                            <p className="font-semibold text-slate-200">Pass criteria</p>
                            <ul className="mt-1 space-y-1">
                              {stageQuiz.pass_criteria.map((item, criteriaIndex) => (
                                <li key={criteriaIndex}>{item}</li>
                              ))}
                            </ul>
                          </div>
                          {revealed && (
                            <div className="space-y-2">
                              {stageQuiz.quiz.answer_key && (
                                <p>
                                  <span className="font-semibold text-slate-200">Answer key:</span> {stageQuiz.quiz.answer_key}
                                </p>
                              )}
                              <p>
                                <span className="font-semibold text-slate-200">Remediation:</span> {stageQuiz.quiz.remediation}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-200">On success:</span> {stageQuiz.on_success}
                              </p>
                              <p>
                                <span className="font-semibold text-slate-200">On retry:</span> {stageQuiz.on_failure}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-400">
              When you dispatch the assessment agent, quizzes and answer keys will appear here.
            </div>
          )}
        </section>

        <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/60">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Coaching console</p>
              <h2 className="mt-1 text-xl font-semibold text-white">Progress coach output</h2>
            </div>
          </div>
          {coachPlan ? (
            <div className="mt-6 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Understanding plan</h3>
                <p className="mt-2 text-sm text-slate-300">{coachPlan.understanding.approach}</p>
                <div className="mt-4 grid gap-3 text-sm text-slate-300">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Diagnostic questions</p>
                    <ul className="mt-1 space-y-1">
                      {coachPlan.understanding.diagnostic_questions.map((question, index) => (
                        <li key={index}>{question}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Signals to watch</p>
                    <ul className="mt-1 space-y-1">
                      {coachPlan.understanding.signals_to_watch.map((signal, index) => (
                        <li key={index}>{signal}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-4 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Beginner flag logic:</span> {coachPlan.understanding.beginner_flag_logic}
                </p>
                <p className="mt-2 text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Escalation strategy:</span> {coachPlan.understanding.escalation_strategy}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-900/70 bg-slate-900/50 p-5">
                <h3 className="text-sm font-semibold text-white">Completion plan</h3>
                <div className="mt-3 text-sm text-slate-300">
                  <p className="text-xs uppercase text-slate-500">Mastery indicators</p>
                  <ul className="mt-1 space-y-1">
                    {coachPlan.completion.mastery_indicators.map((indicator, index) => (
                      <li key={index}>{indicator}</li>
                    ))}
                  </ul>
                </div>
                <p className="mt-4 text-sm text-slate-300">
                  <span className="font-semibold text-slate-100">Wrap-up plan:</span> {coachPlan.completion.wrap_up_plan}
                </p>
                <div className="mt-3 text-sm text-slate-300">
                  <p className="text-xs uppercase text-slate-500">Follow-up suggestions</p>
                  <ul className="mt-1 space-y-1">
                    {coachPlan.completion.follow_up_suggestions.map((suggestion, index) => (
                      <li key={index}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-800/70 bg-slate-900/40 p-6 text-sm text-slate-400">
              The progress coach will summarise diagnostics and celebrations once a plan is generated.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
