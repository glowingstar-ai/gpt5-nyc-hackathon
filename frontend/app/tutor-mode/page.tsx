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
    tagline: "Routes each tutoring specialist and keeps context aligned",
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
    id: "practice",
    name: "Practice Producer",
    tagline: "Curates warmups, sprints, and accountability loops",
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

type TutorCurriculumSession = {
  id: string;
  title: string;
  focus: string;
  duration: string;
  objectives: string[];
  learning_modality: "visual" | "verbal" | "interactive" | "experiential" | "reading" | "blended";
  core_activities: string[];
  practice_opportunity: string;
};

type TutorCurriculumResponse = {
  topic: string;
  summary: string;
  horizon: string;
  sessions: TutorCurriculumSession[];
  capstone_project: string;
  enrichment: string[];
};

type TutorAssessmentQuestion = {
  id: string;
  prompt: string;
  kind: "multiple_choice" | "short_answer";
  options?: string[] | null;
  answer: string;
  rationale: string;
};

type TutorAssessmentResponse = {
  title: string;
  description: string;
  duration: string;
  grading_notes: string[];
  questions: TutorAssessmentQuestion[];
};

type TutorPracticeSprint = {
  name: string;
  cadence: string;
  focus: string;
  checkpoints: string[];
};

type TutorPracticeResponse = {
  topic: string;
  warmups: string[];
  sprints: TutorPracticeSprint[];
  accountability: string[];
};

type TutorCoachCheckpoint = {
  milestone: string;
  prompt: string;
  success_signal: string;
  support_plan: string;
};

type TutorCoachResponse = {
  onboarding_message: string;
  check_ins: TutorCoachCheckpoint[];
  celebration_rituals: string[];
  escalation_paths: string[];
};

type TutorManagerAgentReport = {
  id: "curriculum" | "assessment" | "practice" | "coach";
  name: string;
  route: string;
  status: "completed" | "skipped" | "failed";
  summary: string;
  payload: unknown;
};

type TutorManagerResponse = {
  model: string;
  generated_at: string;
  topic: string;
  learner_profile: string;
  manager: {
    name: string;
    mission: string;
    rationale: string;
    priorities: string[];
    next_steps: string[];
  };
  agents: TutorManagerAgentReport[];
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

type AgentPayloads = {
  curriculum?: TutorCurriculumResponse;
  assessment?: TutorAssessmentResponse;
  practice?: TutorPracticeResponse;
  coach?: TutorCoachResponse;
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

function isCurriculumReport(
  agent: TutorManagerAgentReport,
): agent is TutorManagerAgentReport & { payload: TutorCurriculumResponse } {
  return agent.id === "curriculum";
}

function isAssessmentReport(
  agent: TutorManagerAgentReport,
): agent is TutorManagerAgentReport & { payload: TutorAssessmentResponse } {
  return agent.id === "assessment";
}

function isPracticeReport(
  agent: TutorManagerAgentReport,
): agent is TutorManagerAgentReport & { payload: TutorPracticeResponse } {
  return agent.id === "practice";
}

function isCoachReport(
  agent: TutorManagerAgentReport,
): agent is TutorManagerAgentReport & { payload: TutorCoachResponse } {
  return agent.id === "coach";
}

function extractAgentPayloads(plan: TutorManagerResponse): AgentPayloads {
  const payloads: AgentPayloads = {};

  plan.agents.forEach((agent) => {
    if (isCurriculumReport(agent)) {
      payloads.curriculum = agent.payload;
    }
    if (isAssessmentReport(agent)) {
      payloads.assessment = agent.payload;
    }
    if (isPracticeReport(agent)) {
      payloads.practice = agent.payload;
    }
    if (isCoachReport(agent)) {
      payloads.coach = agent.payload;
    }
  });

  return payloads;
}

function buildAgentTasks(plan: TutorManagerResponse): AgentTask[] {
  const payloads = extractAgentPayloads(plan);
  const tasks: AgentTask[] = [];

  tasks.push({
    agentId: "manager",
    headline: "Coordinate the tutoring collective",
    tasks: [plan.manager.mission, plan.manager.rationale, ...plan.manager.priorities.slice(0, 2)],
  });

  if (payloads.curriculum) {
    const sessionHighlights = payloads.curriculum.sessions
      .slice(0, 3)
      .map((session) => `${session.title} → emphasise ${session.learning_modality} moves.`);
    tasks.push({
      agentId: "curriculum",
      headline: "Design the learning journey",
      tasks: [payloads.curriculum.summary, ...sessionHighlights],
    });
  }

  if (payloads.practice) {
    const practiceHighlights = payloads.practice.sprints
      .slice(0, 2)
      .map((sprint) => `${sprint.name}: ${sprint.focus}`);
    tasks.push({
      agentId: "practice",
      headline: "Curate practice loops",
      tasks: [...payloads.practice.warmups.slice(0, 1), ...practiceHighlights],
    });
  }

  if (payloads.assessment) {
    const questionSnippets = payloads.assessment.questions
      .slice(0, 2)
      .map((question, index) => `Item ${index + 1}: ${question.prompt}`);
    tasks.push({
      agentId: "assessment",
      headline: "Engineer mastery checks",
      tasks: [payloads.assessment.description, ...questionSnippets],
    });
  }

  if (payloads.coach) {
    const coachingMoments = payloads.coach.check_ins
      .slice(0, 2)
      .map((checkpoint) => `${checkpoint.milestone}: ${checkpoint.prompt}`);
    tasks.push({
      agentId: "coach",
      headline: "Coach the learner through",
      tasks: [payloads.coach.onboarding_message, ...coachingMoments],
    });
  }

  return tasks;
}

function AgentGlyph({ className, ...props }: SVGProps<SVGSVGElement>) {
  return <Sparkles className={cn("h-4 w-4", className)} {...props} />;
}

function CurriculumPanel({ curriculum }: { curriculum: TutorCurriculumResponse }) {
  return (
    <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/50">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Curriculum roadmap</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{curriculum.summary}</h3>
      <p className="mt-3 text-sm text-slate-300">
        Horizon: <span className="font-medium text-white">{curriculum.horizon}</span>
      </p>
      <div className="mt-4 space-y-4">
        {curriculum.sessions.map((session) => (
          <div
            key={session.id}
            className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{session.title}</p>
              <span className="text-xs uppercase text-slate-500">{session.duration}</span>
            </div>
            <p className="mt-2 text-sm text-slate-300">{session.focus}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.2em] text-slate-500">
              Modality: {session.learning_modality}
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-200">
              {session.objectives.map((objective, index) => (
                <li key={index} className="flex items-start gap-2">
                  <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                  <span>{objective}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-400">
              Practice: <span className="text-slate-300">{session.practice_opportunity}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Capstone</p>
        <p className="mt-2 text-sm text-slate-200">{curriculum.capstone_project}</p>
        <p className="mt-3 text-xs uppercase tracking-[0.3em] text-slate-500">Enrichment</p>
        <ul className="mt-2 space-y-2 text-sm text-slate-200">
          {curriculum.enrichment.map((item, index) => (
            <li key={index} className="flex items-start gap-2">
              <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-sky-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function PracticePanel({ practice }: { practice: TutorPracticeResponse }) {
  return (
    <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/50">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Practice lab</p>
      <h3 className="mt-2 text-lg font-semibold text-white">Stay accountable while applying the craft</h3>
      <div className="mt-4 space-y-4">
        <div className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Warmups</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {practice.warmups.map((warmup, index) => (
              <li key={index} className="flex items-start gap-2">
                <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
                <span>{warmup}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4">
          {practice.sprints.map((sprint) => (
            <div
              key={sprint.name}
              className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
            >
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-white">{sprint.name}</p>
                <span className="text-xs uppercase text-slate-500">{sprint.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{sprint.focus}</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-200">
                {sprint.checkpoints.map((checkpoint, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-emerald-400" />
                    <span>{checkpoint}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Accountability moves</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {practice.accountability.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-purple-400" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function CoachPanel({ coach }: { coach: TutorCoachResponse }) {
  return (
    <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/50">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Coaching playbook</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{coach.onboarding_message}</h3>
      <div className="mt-4 space-y-4">
        {coach.check_ins.map((checkpoint) => (
          <div
            key={checkpoint.milestone}
            className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4"
          >
            <p className="text-sm font-semibold text-white">{checkpoint.milestone}</p>
            <p className="mt-2 text-sm text-slate-300">{checkpoint.prompt}</p>
            <p className="mt-3 text-xs text-emerald-400">
              Success signal: <span className="text-slate-200">{checkpoint.success_signal}</span>
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Support plan: <span className="text-slate-200">{checkpoint.support_plan}</span>
            </p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Celebrations</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {coach.celebration_rituals.map((ritual, index) => (
              <li key={index} className="flex items-start gap-2">
                <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-amber-400" />
                <span>{ritual}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-4">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Escalation paths</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-200">
            {coach.escalation_paths.map((path, index) => (
              <li key={index} className="flex items-start gap-2">
                <AgentGlyph className="mt-0.5 h-3.5 w-3.5 text-rose-400" />
                <span>{path}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function QuizPanel({
  assessment,
  quizResponses,
  quizResults,
  quizSubmitted,
  onChange,
  onSubmit,
}: {
  assessment: TutorAssessmentResponse;
  quizResponses: Record<string, string>;
  quizResults: Record<string, { correct: boolean; answer: string }>;
  quizSubmitted: boolean;
  onChange: (questionId: string, value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const allCorrect = useMemo(() => {
    if (!quizSubmitted) return false;
    return assessment.questions.every((question) => quizResults[question.id]?.correct);
  }, [quizResults, quizSubmitted, assessment.questions]);

  return (
    <div className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-xl shadow-slate-950/50 lg:col-span-2">
      <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Assessment lab</p>
      <h3 className="mt-2 text-lg font-semibold text-white">{assessment.title}</h3>
      <p className="mt-2 text-sm text-slate-300">{assessment.description}</p>
      <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-500">
        Duration: {assessment.duration}
      </p>
      <form onSubmit={onSubmit} className="mt-5 space-y-6">
        {assessment.questions.map((question) => {
          const response = quizResponses[question.id] ?? "";
          const result = quizResults[question.id];
          const isMultipleChoice = question.kind === "multiple_choice";

          return (
            <div
              key={question.id}
              className="rounded-2xl border border-slate-900/60 bg-slate-900/60 p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  {question.prompt}
                </p>
                <span className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  {isMultipleChoice ? "Multiple choice" : "Short answer"}
                </span>
              </div>
              {isMultipleChoice ? (
                <div className="mt-3 space-y-2">
                  {question.options?.map((option) => (
                    <label
                      key={option}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded-xl border border-slate-900/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 transition",
                        response === option && "border-emerald-500/60 bg-emerald-500/10 text-white",
                      )}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={option}
                        checked={response === option}
                        onChange={() => onChange(question.id, option)}
                        className="hidden"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <textarea
                  value={response}
                  onChange={(event) => onChange(question.id, event.target.value)}
                  rows={3}
                  className="mt-3 w-full resize-none rounded-xl border border-slate-900/60 bg-slate-950/40 px-3 py-2 text-sm text-slate-200 focus:border-emerald-500/60 focus:outline-none"
                  placeholder="Type your reflection"
                />
              )}
              {quizSubmitted && result && (
                <div
                  className={cn(
                    "mt-3 rounded-xl border px-3 py-2 text-sm",
                    result.correct
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                      : "border-rose-500/40 bg-rose-500/10 text-rose-200",
                  )}
                >
                  <p className="font-semibold">
                    {result.correct ? "Correct" : "Let's review"}
                  </p>
                  {!result.correct && (
                    <p className="mt-1 text-xs text-slate-200">
                      Answer: <span className="font-medium text-white">{result.answer}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-200">{question.rationale}</p>
                </div>
              )}
            </div>
          );
        })}
        <div className="flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {assessment.grading_notes.map((note, index) => (
              <p key={index} className="mt-1">
                {note}
              </p>
            ))}
          </div>
          <Button type="submit" className="min-w-[160px] bg-emerald-500 text-slate-950 hover:bg-emerald-400">
            {quizSubmitted ? "Retake quiz" : "Submit answers"}
          </Button>
        </div>
        {quizSubmitted && (
          <div
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm",
              allCorrect
                ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-200"
                : "border-amber-500/60 bg-amber-500/10 text-amber-200",
            )}
          >
            {allCorrect
              ? "Flawless run! Ready to level-up the challenge."
              : "Great effort—review the notes above and adjust your plan."}
          </div>
        )}
      </form>
    </div>
  );
}

export default function TutorModePage(): JSX.Element {
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "manager",
      type: "text",
      text: "Hi there! I'm the GPT-5 tutor manager. Tell me what you want to learn and I'll assemble the right agents.",
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [managerPlan, setManagerPlan] = useState<TutorManagerResponse | null>(null);
  const [agentPayloads, setAgentPayloads] = useState<AgentPayloads>({});
  const [assignmentBoard, setAssignmentBoard] = useState<AgentTask[]>([]);
  const [quizResponses, setQuizResponses] = useState<Record<string, string>>({});
  const [quizResults, setQuizResults] = useState<
    Record<string, { correct: boolean; answer: string }>
  >({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const chatViewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!chatViewportRef.current) return;
    chatViewportRef.current.scrollTop = chatViewportRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    setQuizResponses({});
    setQuizResults({});
    setQuizSubmitted(false);
  }, [agentPayloads.assessment?.title]);

  const formattedTimestamp = useMemo(() => {
    if (!managerPlan) return null;
    return formatDate(managerPlan.generated_at);
  }, [managerPlan]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }, []);

  const handleQuizChange = useCallback((questionId: string, value: string) => {
    setQuizResponses((previous) => ({ ...previous, [questionId]: value }));
  }, []);

  const handleQuizSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!agentPayloads.assessment) {
        return;
      }

      const results: Record<string, { correct: boolean; answer: string }> = {};

      agentPayloads.assessment.questions.forEach((question) => {
        const userAnswer = (quizResponses[question.id] ?? "").trim();
        let correct = false;

        if (question.kind === "multiple_choice") {
          correct = userAnswer === question.answer;
        } else {
          correct = userAnswer.toLowerCase() === question.answer.trim().toLowerCase();
        }

        results[question.id] = { correct, answer: question.answer };
      });

      setQuizResults(results);
      setQuizSubmitted(true);
    },
    [agentPayloads.assessment, quizResponses],
  );

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

        const data: TutorManagerResponse = await response.json();
        const payloads = extractAgentPayloads(data);
        const tasks = buildAgentTasks(data);

        setManagerPlan(data);
        setAgentPayloads(payloads);
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
              text: `${data.manager.name} dispatched ${data.agents.length} specialists. ${data.manager.rationale}`,
            };

            const taskMessages: Message[] = tasks.map((task, index) => ({
              id: `${task.agentId}-${Date.now()}-${index}`,
              role: task.agentId,
              type: "tasks",
              headline: task.headline,
              tasks: task.tasks,
            }));

            return [managerSummary, ...taskMessages];
          }),
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
              : message,
          ),
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [inputValue],
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
              agent ? "text-white" : "text-slate-200",
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
              agent ? "text-white" : "text-slate-200",
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
                    agent.accent,
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
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="min-w-[140px] bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  >
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
                Each specialist receives a slice of the plan after the manager coordinates with GPT-5.
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
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Latest GPT-5 intel</p>
                <h2 className="mt-2 text-lg font-semibold text-white">Plan snapshot</h2>
                <div className="mt-4 space-y-4 text-sm text-slate-200">
                  <div>
                    <p className="text-xs uppercase text-slate-500">Topic</p>
                    <p className="mt-1 text-base text-white">{managerPlan.topic}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Learner profile</p>
                    <p className="mt-1 text-slate-300">{managerPlan.learner_profile}</p>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Manager priorities</p>
                    <ul className="mt-2 space-y-1 text-slate-300">
                      {managerPlan.manager.priorities.slice(0, 3).map((priority, index) => (
                        <li key={index}>{priority}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase text-slate-500">Model</p>
                    <p className="mt-1 text-slate-300">{managerPlan.model}</p>
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

        {(agentPayloads.curriculum ||
          agentPayloads.practice ||
          agentPayloads.assessment ||
          agentPayloads.coach) && (
          <section className="rounded-3xl border border-slate-900/70 bg-slate-950/60 p-6 shadow-2xl shadow-slate-950/60">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Agent output stream</p>
                <h2 className="mt-2 text-xl font-semibold text-white">Review what each specialist produced</h2>
              </div>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {agentPayloads.curriculum && <CurriculumPanel curriculum={agentPayloads.curriculum} />}
              {agentPayloads.practice && <PracticePanel practice={agentPayloads.practice} />}
              {agentPayloads.assessment && (
                <QuizPanel
                  assessment={agentPayloads.assessment}
                  quizResponses={quizResponses}
                  quizResults={quizResults}
                  quizSubmitted={quizSubmitted}
                  onChange={handleQuizChange}
                  onSubmit={handleQuizSubmit}
                />
              )}
              {agentPayloads.coach && <CoachPanel coach={agentPayloads.coach} />}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

