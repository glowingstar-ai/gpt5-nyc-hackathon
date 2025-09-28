"use client";

import { type FormEvent, useCallback, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  ListChecks,
  ListTree,
  Loader2,
  LucideIcon,
  Search,
  Sparkles,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import WorkspaceBanner from "@/components/workspace-banner";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

interface ResearchPaperSummary {
  paper_id: string;
  title: string;
  summary: string;
  url: string;
  published_at?: string | null;
  authors: string[];
  score?: number | null;
  reason?: string | null;
}

type ResearchStreamEvent =
  | {
      type: "status";
      stage: string;
      message: string;
      paper_id?: string;
    }
  | {
      type: "expansion";
      stage: string;
      message: string;
      expansions: string[];
    }
  | {
      type: "retrieval";
      stage: string;
      message: string;
      count: number;
    }
  | {
      type: "ranking";
      stage: string;
      message: string;
      total_candidates: number;
      results: ResearchPaperSummary[];
    }
  | {
      type: "explanation";
      stage: string;
      paper_id: string;
      reason: string;
    }
  | {
      type: "results";
      stage: string;
      message: string;
      results: ResearchPaperSummary[];
    }
  | {
      type: "error";
      stage: string;
      message: string;
    };

const STAGE_META: Record<
  string,
  { label: string; icon: LucideIcon; accent: string }
> = {
  expanding_query: {
    label: "Query expansion",
    icon: Sparkles,
    accent: "from-emerald-400/70 to-cyan-400/70",
  },
  retrieving_candidates: {
    label: "Retrieval",
    icon: ListTree,
    accent: "from-cyan-400/70 to-sky-400/70",
  },
  ranking: {
    label: "Similarity ranking",
    icon: ListChecks,
    accent: "from-sky-400/70 to-indigo-400/70",
  },
  explaining: {
    label: "Relevance narratives",
    icon: BookOpen,
    accent: "from-indigo-400/70 to-fuchsia-400/70",
  },
  complete: {
    label: "Digest ready",
    icon: CheckCircle2,
    accent: "from-emerald-400/70 to-teal-400/70",
  },
  error: {
    label: "Something went wrong",
    icon: AlertTriangle,
    accent: "from-rose-500/70 to-amber-400/70",
  },
};

function getStageMeta(stage: string) {
  return STAGE_META[stage] ?? {
    label: stage.replace(/_/g, " "),
    icon: Sparkles,
    accent: "from-slate-500/70 to-slate-600/70",
  };
}

function formatDate(value?: string | null) {
  if (!value) return null;
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch (err) {
    return null;
  }
}

function formatScore(score?: number | null) {
  if (score == null) return null;
  return score.toFixed(2);
}

export default function ResearchExplorerPage(): JSX.Element {
  const [query, setQuery] = useState(
    "Autonomous agents that coordinate swarm robotics with vision transformers"
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [events, setEvents] = useState<ResearchStreamEvent[]>([]);
  const [results, setResults] = useState<ResearchPaperSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  const resetState = useCallback(() => {
    setEvents([]);
    setResults([]);
    setError(null);
  }, []);

  const handleEvent = useCallback((event: ResearchStreamEvent) => {
    setEvents((prev) => [...prev, event]);

    if (event.type === "ranking") {
      setResults(event.results);
    } else if (event.type === "explanation") {
      setResults((prev) =>
        prev.map((paper) =>
          paper.paper_id === event.paper_id
            ? { ...paper, reason: event.reason }
            : paper
        )
      );
    } else if (event.type === "results") {
      setResults(event.results);
    } else if (event.type === "error") {
      setError(event.message);
    }
  }, []);

  const submitSearch = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!query.trim()) {
        setError("Please describe the paper you're looking for.");
        return;
      }

      resetState();
      setIsStreaming(true);

      try {
        const response = await fetch(`${API_BASE}/research/discover`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        });

        if (!response.body) {
          throw new Error("Streaming not supported by the backend response.");
        }

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          const message = payload?.detail ?? `Request failed with ${response.status}`;
          throw new Error(message);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const chunk = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (chunk) {
              try {
                handleEvent(JSON.parse(chunk) as ResearchStreamEvent);
              } catch (err) {
                console.error("Unable to parse stream chunk", err, chunk);
              }
            }
            newlineIndex = buffer.indexOf("\n");
          }
        }

        const finalChunk = buffer.trim();
        if (finalChunk) {
          try {
            handleEvent(JSON.parse(finalChunk) as ResearchStreamEvent);
          } catch (err) {
            console.error("Unable to parse trailing chunk", err, finalChunk);
          }
        }
      } catch (err) {
        console.error("Research discovery failed", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsStreaming(false);
      }
    },
    [handleEvent, query, resetState]
  );

  const renderEventDetails = useCallback(
    (event: ResearchStreamEvent) => {
      switch (event.type) {
        case "expansion":
          return (
            <div className="mt-3 flex flex-wrap gap-2">
              {event.expansions.map((expansion) => (
                <span
                  key={expansion}
                  className="rounded-full border border-emerald-400/50 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-200"
                >
                  {expansion}
                </span>
              ))}
            </div>
          );
        case "retrieval":
          return (
            <p className="mt-2 text-xs text-slate-400">
              {event.message}.
            </p>
          );
        case "ranking":
          return (
            <p className="mt-2 text-xs text-slate-400">
              {event.results.length} shortlisted from {event.total_candidates} candidates.
            </p>
          );
        case "explanation": {
          const paper = results.find((item) => item.paper_id === event.paper_id);
          return (
            <div className="mt-2 space-y-1">
              {paper ? (
                <p className="text-sm font-medium text-slate-200">{paper.title}</p>
              ) : null}
              <p className="text-xs text-slate-400">{event.reason}</p>
            </div>
          );
        }
        case "error":
          return (
            <p className="mt-2 text-xs text-rose-300">{event.message}</p>
          );
        case "results":
          return (
            <p className="mt-2 text-xs text-emerald-200">
              {event.results.length} papers ready to review.
            </p>
          );
        default:
          return null;
      }
    },
    [results]
  );

  const timeline = useMemo(() => {
    if (events.length === 0) {
      return (
        <div className="rounded-3xl border border-slate-800/70 bg-slate-900/50 p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-800/70 text-emerald-300">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-slate-100">
            Awaiting your research brief
          </h3>
          <p className="mt-2 text-sm text-slate-400">
            Describe the paper you need and watch each reasoning step stream in like an OpenAI console.
          </p>
        </div>
      );
    }

    return (
      <ul className="space-y-4">
        {events.map((event, index) => {
          const meta = getStageMeta(event.stage);
          const isActive = index === events.length - 1;
          const Icon = meta.icon;
          return (
            <li
              key={`${event.type}-${index}`}
              className="relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 p-5 shadow-lg"
            >
              <div
                className={cn(
                  "absolute inset-y-0 left-0 w-1 bg-gradient-to-b",
                  meta.accent
                )}
              />
              <div
                className={cn(
                  "relative flex items-start gap-4",
                  isActive ? "opacity-100" : "opacity-90"
                )}
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-2xl border",
                    isActive
                      ? "border-emerald-400/70 bg-emerald-400/10 text-emerald-200"
                      : "border-slate-800 bg-slate-900 text-slate-300"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold uppercase tracking-wide text-slate-200">
                      {meta.label}
                    </p>
                    {isActive && isStreaming ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wider text-emerald-200">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Streaming
                      </span>
                    ) : null}
                  </div>
                  {"message" in event ? (
                    <p className="mt-1 text-sm text-slate-300">{event.message}</p>
                  ) : null}
                  {renderEventDetails(event)}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }, [events, isStreaming, renderEventDetails]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950" />
      <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl" />

      <div className="relative z-20">
        <WorkspaceBanner
          title="Research Explorer"
          current="Research Explorer"
          subtitle="Live-trace discovery for the papers you need"
          maxWidthClassName="max-w-6xl"
        />
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-12 sm:px-10 lg:px-16">
        <header className="mb-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.35em] text-emerald-200/80">
              Research Explorer
            </p>
            <h1 className="mt-3 text-4xl font-semibold leading-tight text-slate-50 sm:text-5xl">
              Streamed RAG for instant paper scouting.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-slate-300">
              Describe the research you need and watch GPT-5 expand your request, search arXiv, rerank with Cohere, and narrate why each paper matters—all in an OpenAI-style live trace.
            </p>
          </div>
        </header>

        <section className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 shadow-2xl backdrop-blur">
          <form onSubmit={submitSearch} className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium uppercase tracking-wide text-slate-300">
                Describe the paper or problem
              </label>
              <textarea
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                rows={4}
                className="w-full rounded-2xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-base text-slate-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                placeholder="e.g. Foundation models for temporal graph forecasting in climate risk analysis"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-xs text-slate-400">
                We&apos;ll expand your search with GPT-5, run arXiv retrieval, Cohere re-ranking, and send back GPT-5 explanations for the top matches.
              </p>
              <Button
                type="submit"
                disabled={isStreaming}
                className="group bg-emerald-400 text-slate-950 hover:bg-emerald-300"
              >
                <span className="inline-flex items-center gap-2 text-sm font-semibold">
                  {isStreaming ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Streaming
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 transition-transform group-hover:scale-110" />
                      Start discovery
                    </>
                  )}
                </span>
              </Button>
            </div>
          </form>
          {error ? (
            <div className="mt-6 rounded-2xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          ) : null}
        </section>

        <section className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Live reasoning trace
            </h2>
            {timeline}
          </div>
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-[0.3em] text-slate-400">
              Recommended papers
            </h2>
            {results.length === 0 ? (
              <div className="rounded-3xl border border-slate-800/70 bg-slate-950/60 p-8 text-center text-sm text-slate-400">
                Results will appear here once the pipeline finishes ranking and explaining the matches.
              </div>
            ) : (
              <div className="space-y-6">
                {results.map((paper, index) => {
                  const formattedDate = formatDate(paper.published_at);
                  const formattedScore = formatScore(paper.score ?? undefined);
                  return (
                    <article
                      key={paper.paper_id}
                      className="group relative overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/70 p-6 shadow-xl transition hover:border-emerald-400/60 hover:bg-slate-950/80"
                    >
                      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent opacity-0 transition group-hover:opacity-100" />
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-300/80">
                            #{index + 1} Recommendation
                          </p>
                          <h3 className="mt-2 text-xl font-semibold text-slate-50">
                            <a
                              href={paper.url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-2 text-slate-50 hover:text-emerald-200"
                            >
                              {paper.title}
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                            {paper.authors.length > 0 ? (
                              <span>{paper.authors.join(", ")}</span>
                            ) : null}
                            {formattedDate ? (
                              <span className="rounded-full border border-slate-700/80 px-2 py-0.5 text-[11px] uppercase tracking-wide">
                                {formattedDate}
                              </span>
                            ) : null}
                            {formattedScore ? (
                              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-emerald-200">
                                Score {formattedScore}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      {paper.reason ? (
                        <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                          {paper.reason}
                        </p>
                      ) : (
                        <p className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-sm text-slate-300">
                          Waiting for GPT-5 to finish the relevance narrative...
                        </p>
                      )}
                      <p className="mt-4 text-sm text-slate-300">
                        {paper.summary}
                      </p>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
