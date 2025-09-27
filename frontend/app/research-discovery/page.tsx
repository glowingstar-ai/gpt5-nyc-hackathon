"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { BookOpenCheck, Bot, Search, Sparkles, Undo2 } from "lucide-react";

import { Button } from "@/components/ui/button";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type StepStatus = "pending" | "running" | "complete" | "error";

type Step = {
  id: string;
  label: string;
  status: StepStatus;
  message?: string;
  payload?: unknown;
};

type StreamStepEvent = {
  type: "step";
  step_id: string;
  status: "started" | "completed" | "failed";
  message: string;
  payload?: Record<string, unknown> | null;
};

type StreamResultsEvent = {
  type: "results";
  results: ResearchResult[];
};

type StreamErrorEvent = {
  type: "error";
  message: string;
};

type StreamEvent = StreamStepEvent | StreamResultsEvent | StreamErrorEvent;

type ResearchResult = {
  paper_id: string;
  title: string;
  summary: string;
  url: string;
  published?: string | null;
  relevance: number;
  justification: string;
};

type LogEntry = {
  id: string;
  status: StepStatus;
  title: string;
  detail?: string;
  payload?: unknown;
};

const createDefaultSteps = (): Step[] => [
  { id: "expand", label: "Expand with GPT-5", status: "pending" },
  { id: "retrieve", label: "Retrieve from ArXiv", status: "pending" },
  { id: "rank", label: "Rank with Cohere", status: "pending" },
  { id: "explain", label: "Explain relevance", status: "pending" },
];

const statusIconClasses: Record<StepStatus, string> = {
  pending: "border-slate-700 text-slate-500",
  running: "border-emerald-400/60 text-emerald-300 animate-pulse",
  complete: "border-emerald-400/60 text-emerald-200",
  error: "border-rose-500/60 text-rose-300",
};

const statusDotClasses: Record<StepStatus, string> = {
  pending: "bg-slate-700",
  running: "bg-emerald-400 animate-ping",
  complete: "bg-emerald-400",
  error: "bg-rose-500",
};

const statusLabel: Record<StepStatus, string> = {
  pending: "Waiting",
  running: "Running",
  complete: "Complete",
  error: "Error",
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object" && !Array.isArray(value);
};

const parseEventPayload = (chunk: string): StreamEvent | null => {
  const lines = chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data:"));
  if (lines.length === 0) return null;
  const payload = lines.map((line) => line.slice(5).trim()).join("\n");
  if (!payload) return null;
  try {
    return JSON.parse(payload) as StreamEvent;
  } catch (error) {
    console.error("Failed to parse stream payload", error, payload);
    return { type: "error", message: "Received an unreadable update from the server." };
  }
};

const mapStepStatus = (status: StreamStepEvent["status"]): StepStatus => {
  if (status === "started") return "running";
  if (status === "completed") return "complete";
  return "error";
};

const formatScore = (score: number): string => `${(score * 100).toFixed(0)}%`;

export default function ResearchDiscoveryPage(): JSX.Element {
  const [query, setQuery] = useState("");
  const [maxResults, setMaxResults] = useState(3);
  const [steps, setSteps] = useState<Step[]>(createDefaultSteps);
  const [logEntries, setLogEntries] = useState<LogEntry[]>([]);
  const [results, setResults] = useState<ResearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const resetWorkflow = useCallback(() => {
    setSteps(createDefaultSteps());
    setLogEntries([]);
    setResults([]);
    setError(null);
  }, []);

  const handleStreamEvent = useCallback((event: StreamEvent) => {
    if (event.type === "step") {
      setSteps((previous) =>
        previous.map((step) =>
          step.id === event.step_id
            ? {
                ...step,
                status: mapStepStatus(event.status),
                message: event.message,
                payload: event.payload ?? undefined,
              }
            : step
        )
      );

      setLogEntries((previous) => [
        ...previous,
        {
          id: `${event.step_id}-${event.status}-${previous.length}`,
          status: mapStepStatus(event.status),
          title: event.message,
          payload: event.payload ?? undefined,
          detail:
            event.status === "completed" && event.payload
              ? JSON.stringify(event.payload)
              : undefined,
        },
      ]);
    } else if (event.type === "results") {
      setResults(event.results);
      setLogEntries((previous) => [
        ...previous,
        {
          id: `results-${previous.length}`,
          status: "complete",
          title: "Delivered ranked research papers.",
        },
      ]);
    } else if (event.type === "error") {
      setError(event.message);
      setSteps((previous) =>
        previous.map((step) =>
          step.status === "running"
            ? { ...step, status: "error", message: event.message }
            : step
        )
      );
      setLogEntries((previous) => [
        ...previous,
        {
          id: `error-${previous.length}`,
          status: "error",
          title: event.message,
        },
      ]);
    }
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!query.trim() || isStreaming) return;

      controllerRef.current?.abort();
      resetWorkflow();
      const controller = new AbortController();
      controllerRef.current = controller;
      setIsStreaming(true);

      try {
        const response = await fetch(`${API_BASE}/research/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: query.trim(), max_results: maxResults }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const message = await response.text();
          throw new Error(
            message || "The research service could not start streaming results."
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let boundary = buffer.indexOf("\n\n");
          while (boundary !== -1) {
            const chunk = buffer.slice(0, boundary).trim();
            buffer = buffer.slice(boundary + 2);
            if (chunk) {
              const eventPayload = parseEventPayload(chunk);
              if (eventPayload) {
                handleStreamEvent(eventPayload);
              }
            }
            boundary = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") {
          setError("Streaming cancelled.");
        } else {
          console.error(err);
          setError(
            err instanceof Error
              ? err.message
              : "Unable to reach the research discovery service."
          );
          setSteps((previous) =>
            previous.map((step) =>
              step.status === "running"
                ? { ...step, status: "error", message: "Request aborted." }
                : step
            )
          );
        }
      } finally {
        setIsStreaming(false);
        controllerRef.current = null;
      }
    },
    [handleStreamEvent, isStreaming, maxResults, query, resetWorkflow]
  );

  const handleAbort = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
  }, []);

  const isSubmitDisabled = useMemo(
    () => query.trim().length === 0 || isStreaming,
    [isStreaming, query]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-emerald-400/40 bg-emerald-400/10 p-2">
              <BookOpenCheck className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">ArXiv Research Discovery</h1>
              <p className="text-sm text-slate-400">
                Describe the paper you need and watch the RAG workflow unfold live.
              </p>
            </div>
          </div>
          <nav className="text-sm text-slate-400">
            <Link href="/" className="hover:text-slate-100">
              Home
            </Link>
            <span className="mx-2 text-slate-700">/</span>
            <span className="text-slate-100">Research discovery</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10">
        <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 shadow-xl">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-200" htmlFor="query">
                Describe your target paper
              </label>
              <textarea
                id="query"
                name="query"
                rows={5}
                required
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: I'm looking for a recent RAG paper that evaluates retrieval quality for enterprise knowledge bases"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/70 px-3 py-2 text-sm leading-6 text-slate-100 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/40"
              />
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-sm text-slate-300">
                <Bot className="h-5 w-5 text-emerald-300" />
                <span>
                  GPT-5 expands your query, searches our ArXiv cache, reranks with Cohere, and
                  justifies every recommendation.
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <label htmlFor="maxResults" className="text-slate-300">
                  Top results
                </label>
                <input
                  id="maxResults"
                  name="maxResults"
                  type="number"
                  min={1}
                  max={5}
                  value={maxResults}
                  onChange={(event) => setMaxResults(Number(event.target.value))}
                  className="h-10 w-16 rounded-md border border-slate-700 bg-slate-950 px-2 text-center text-sm text-slate-100 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="submit"
                className="bg-emerald-400 text-slate-950 hover:bg-emerald-300"
                disabled={isSubmitDisabled}
              >
                <Sparkles className="mr-2 h-4 w-4" /> Start discovery
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleAbort}
                disabled={!isStreaming}
                className="border-slate-700 bg-slate-950/60 text-slate-200 hover:bg-slate-900/70 disabled:cursor-not-allowed disabled:border-slate-800 disabled:text-slate-600"
              >
                <Undo2 className="mr-2 h-4 w-4" /> Cancel stream
              </Button>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-500/50 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                {error}
              </div>
            )}
          </form>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-emerald-300" />
              <h2 className="text-lg font-semibold">Live reasoning trace</h2>
            </div>
            <ul className="space-y-4">
              {steps.map((step) => (
                <li
                  key={step.id}
                  className={`rounded-xl border px-4 py-3 transition ${statusIconClasses[step.status]}`}
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-100">{step.label}</span>
                    <span className="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-400">
                      <span
                        className={`h-2.5 w-2.5 rounded-full ${statusDotClasses[step.status]}`}
                      />
                      {statusLabel[step.status]}
                    </span>
                  </div>
                  {step.message && (
                    <p className="mt-2 text-sm text-slate-300">{step.message}</p>
                  )}
                  {step.id === "expand" && isRecord(step.payload) && Array.isArray(step.payload.expansions) && (
                    <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                      {(step.payload.expansions as string[]).map((item) => (
                        <span
                          key={item}
                          className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.id === "rank" && isRecord(step.payload) && Array.isArray(step.payload.ranking) && (
                    <div className="mt-3 space-y-2 text-xs text-slate-400">
                      {(step.payload.ranking as { paper_id: string; score: number | null }[])
                        .slice(0, 3)
                        .map((entry) => (
                          <div
                            key={entry.paper_id}
                            className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2"
                          >
                            <span className="font-mono text-[11px] text-slate-400">
                              {entry.paper_id}
                            </span>
                            <span className="text-emerald-300">
                              {formatScore(entry.score ?? 0)}
                            </span>
                          </div>
                        ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-300" />
              <h2 className="text-lg font-semibold">Execution log</h2>
            </div>
            <div className="space-y-3">
              {logEntries.length === 0 && (
                <p className="text-sm text-slate-500">
                  Submit a description to watch GPT-5 narrate each action it takes.
                </p>
              )}
              {logEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-sm text-slate-300"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span>{statusLabel[entry.status]}</span>
                    <span>{entry.status === "complete" ? "✓" : "…"}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-200">{entry.title}</p>
                  {entry.payload && typeof entry.payload === "object" && entry.payload !== null && (
                    <pre className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-slate-950/80 p-3 text-xs text-slate-400">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <BookOpenCheck className="h-5 w-5 text-emerald-300" />
            <h2 className="text-lg font-semibold">Top matches</h2>
          </div>
          {results.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
              When the pipeline finishes, the most relevant ArXiv papers will surface here with GPT-5 justifications.
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {results.map((result) => (
                <article
                  key={result.paper_id}
                  className="group flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 p-6 shadow-xl transition hover:border-emerald-400/60 hover:shadow-emerald-500/10"
                >
                  <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                    <span className="font-mono text-emerald-300">{result.paper_id}</span>
                    <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-1 text-emerald-200">
                      {formatScore(result.relevance)} relevant
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-100">{result.title}</h3>
                  {result.published && (
                    <p className="text-xs text-slate-500">Published: {result.published}</p>
                  )}
                  <p className="text-sm leading-6 text-slate-300">{result.summary}</p>
                  <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-sm text-slate-200">
                    <strong className="text-emerald-300">Why it matters:</strong>
                    <p className="mt-2 text-slate-300">{result.justification}</p>
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    className="border-emerald-400/50 bg-transparent text-emerald-200 hover:bg-emerald-400/10"
                  >
                    <Link href={result.url} target="_blank" rel="noreferrer">
                      View on arXiv
                    </Link>
                  </Button>
                </article>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
