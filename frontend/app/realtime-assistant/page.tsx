"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Theme, Heading, Text } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

import RealtimeConversationPanel from "@/components/realtime-conversation";
import { Button } from "@/components/ui/button";
import WorkspaceBanner from "@/components/workspace-banner";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type ShareStatus = "idle" | "capturing" | "shared" | "error";

const BACKGROUND_FALLBACK = "#0f172a";

const STATUS_CARD_VARIANTS: Record<ShareStatus, string> = {
  idle: "border-slate-800/70 bg-slate-900/70 text-slate-300",
  capturing:
    "border-amber-400/50 bg-amber-400/10 text-amber-200 shadow-[0_10px_30px_-12px_rgba(251,191,36,0.45)]",
  shared:
    "border-emerald-400/60 bg-emerald-400/10 text-emerald-200 shadow-[0_10px_30px_-12px_rgba(16,185,129,0.55)]",
  error:
    "border-rose-500/60 bg-rose-500/10 text-rose-200 shadow-[0_10px_30px_-12px_rgba(244,63,94,0.55)]",
};

const DEFAULT_PYTHON_SNIPPET = `import time

class AttentionVisualizer:
    def __init__(self, tokens: list[str]):
        self.tokens = tokens
        self.weights = [[1 / len(tokens) for _ in tokens] for _ in tokens]

    def step(self) -> None:
        for row in self.weights:
            decay = 0.72 + (time.time() % 0.08)
            for index, weight in enumerate(row):
                row[index] = max(0.01, weight * decay)

    def summary(self) -> str:
        return " | ".join(
            f"{token}: {max(weights):.2f}"
            for token, weights in zip(self.tokens, self.weights)
        )

if __name__ == "__main__":
    visualizer = AttentionVisualizer(["The", "future", "is", "streaming"])
    for _ in range(4):
        visualizer.step()
        print(visualizer.summary())
`;

type DomElementDigest = {
  selector: string;
  tag: string;
  id?: string;
  classes?: string[];
  role?: string | null;
  ariaLabel?: string | null;
  dataTestId?: string | null;
  text?: string | null;
  href?: string | null;
  placeholder?: string | null;
  bounds: { x: number; y: number; width: number; height: number };
  visible: boolean;
};

type DomSnapshotDigest = {
  capturedAt: string;
  pageTitle: string;
  elementCount: number;
  elements: DomElementDigest[];
};

const cssEscape = (value: string): string => {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(
    /([\0-\x1F\x7F-\x9F!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~ ])/g,
    "\\$1"
  );
};

const computeUniqueSelector = (element: Element): string => {
  if (element instanceof HTMLElement && element.id) {
    return `#${cssEscape(element.id)}`;
  }

  const segments: string[] = [];
  let current: Element | null = element;
  while (current && current.nodeType === Node.ELEMENT_NODE) {
    if (current instanceof HTMLElement && current.id) {
      segments.unshift(`#${cssEscape(current.id)}`);
      break;
    }

    let segment = current.tagName.toLowerCase();
    const classList = current instanceof HTMLElement ? current.classList : null;
    if (classList && classList.length) {
      const classes = Array.from(classList)
        .slice(0, 2)
        .map((cls) => cssEscape(cls));
      if (classes.length) {
        segment += `.${classes.join(".")}`;
      }
    }

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (sibling) => sibling.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        segment += `:nth-of-type(${index})`;
      }
    }

    segments.unshift(segment);

    if (!current.parentElement || current.parentElement.tagName === "HTML") {
      break;
    }

    current = current.parentElement;
  }

  return segments.join(" > ");
};

const isElementVisible = (element: HTMLElement): boolean => {
  const rect = element.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return (
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    parseFloat(style.opacity || "1") > 0.05
  );
};

const captureDomSnapshot = (root: HTMLElement): DomSnapshotDigest | null => {
  if (typeof window === "undefined") {
    return null;
  }

  const selectorParts = [
    "a[href]",
    "button",
    "input",
    "textarea",
    "select",
    "[role='button']",
    "[role='link']",
    "[role='menuitem']",
    "[data-action]",
    "[data-testid]",
    "[data-test-id]",
    "summary",
    "details",
    "label",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "p",
    "[aria-label]",
  ];

  const nodes = Array.from(
    root.querySelectorAll<HTMLElement>(selectorParts.join(","))
  );

  const seenSelectors = new Set<string>();
  const elements: DomElementDigest[] = [];

  for (const node of nodes) {
    if (!node.isConnected) continue;
    const selector = computeUniqueSelector(node);
    if (!selector || seenSelectors.has(selector)) continue;
    seenSelectors.add(selector);

    const textContent = (node.textContent ?? "").replace(/\s+/g, " ").trim();
    const ariaLabel = node.getAttribute("aria-label");
    const placeholder = node.getAttribute("placeholder");
    const dataTestId =
      node.getAttribute("data-testid") ?? node.getAttribute("data-test-id");
    const bounds = node.getBoundingClientRect();

    elements.push({
      selector,
      tag: node.tagName.toLowerCase(),
      id: node.id || undefined,
      classes:
        node.classList.length > 0
          ? Array.from(node.classList).slice(0, 4)
          : undefined,
      role: node.getAttribute("role"),
      ariaLabel,
      dataTestId,
      text: textContent ? textContent.slice(0, 160) : null,
      href:
        node instanceof HTMLAnchorElement
          ? (node.getAttribute("href") ?? null)
          : null,
      placeholder: placeholder ?? null,
      bounds: {
        x: Math.round(bounds.left),
        y: Math.round(bounds.top),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      },
      visible: isElementVisible(node),
    });

    if (elements.length >= 150) {
      break;
    }
  }

  return {
    capturedAt: new Date().toISOString(),
    pageTitle: typeof document !== "undefined" ? document.title : "",
    elementCount: elements.length,
    elements,
  };
};

function resolveBackgroundColor(): string {
  if (typeof window === "undefined") {
    return BACKGROUND_FALLBACK;
  }

  const body = document.body;
  if (!body) {
    return BACKGROUND_FALLBACK;
  }

  const computed = window.getComputedStyle(body).backgroundColor;
  return computed && computed !== "transparent"
    ? computed
    : BACKGROUND_FALLBACK;
}

function formatTimestamp(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function RealtimeAssistantPage(): JSX.Element {
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<number>();
  const shareInFlightRef = useRef(false);
  const splitRef = useRef<HTMLDivElement | null>(null);

  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [lastSharedAt, setLastSharedAt] = useState<string | null>(null);
  const [lastSharedPreview, setLastSharedPreview] = useState<string | null>(
    null
  );
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    "code" | "paper" | "youtube"
  >("code");
  const [pythonSnippet, setPythonSnippet] = useState<string>(
    DEFAULT_PYTHON_SNIPPET
  );
  const [leftWidthPct, setLeftWidthPct] = useState<number>(45);
  const isResizingRef = useRef(false);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleMove = (event: MouseEvent | TouchEvent) => {
      if (!isResizingRef.current) return;
      const container = splitRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      let clientX: number;
      if (event instanceof TouchEvent) {
        clientX = event.touches[0]?.clientX ?? 0;
      } else {
        clientX = (event as MouseEvent).clientX;
      }
      const x = Math.min(Math.max(clientX - rect.left, 0), rect.width);
      const pct = (x / rect.width) * 100;
      const clamped = Math.min(75, Math.max(25, pct));
      setLeftWidthPct(clamped);
    };

    const stop = () => {
      isResizingRef.current = false;
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };

    window.addEventListener("mousemove", handleMove);
    window.addEventListener("touchmove", handleMove, { passive: false });
    window.addEventListener("mouseup", stop);
    window.addEventListener("touchend", stop);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      window.removeEventListener(
        "touchmove",
        handleMove as unknown as EventListener
      );
      window.removeEventListener("mouseup", stop);
      window.removeEventListener("touchend", stop);
    };
  }, []);

  const shareUiContext = useCallback(async ({ silent = false } = {}) => {
    console.log(`[Vision Frame] shareUiContext called - silent: ${silent}`);
    const target = surfaceRef.current;
    if (!target) {
      const error = new Error("Context surface is not ready to capture yet.");
      if (!silent) {
        setShareStatus("error");
        setShareMessage(error.message);
      }
      throw error;
    }

    if (shareInFlightRef.current) {
      return;
    }

    shareInFlightRef.current = true;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    if (!silent) {
      setShareStatus("capturing");
      setShareMessage("Capturing and analyzing your current workspace…");
    }

    // Swap problematic embeds (iframes, PDFs) with capture-safe posters
    const restoreEmbedsForCapture = () => {
      const wrappers = target.querySelectorAll<HTMLElement>(
        "[data-youtube-id], [data-pdf-poster]"
      );
      wrappers.forEach((wrapper) => {
        const poster = wrapper.querySelector<HTMLElement>(
          "[data-capture-poster]"
        );
        const embed = wrapper.querySelector<HTMLElement>(
          "[data-capture-embed]"
        );
        if (poster) poster.classList.add("hidden");
        if (embed) embed.classList.remove("invisible");
      });
    };

    const prepareEmbedsForCapture = () => {
      const wrappers = target.querySelectorAll<HTMLElement>(
        "[data-youtube-id], [data-pdf-poster]"
      );
      wrappers.forEach((wrapper) => {
        const poster = wrapper.querySelector<HTMLElement>(
          "[data-capture-poster]"
        );
        const embed = wrapper.querySelector<HTMLElement>(
          "[data-capture-embed]"
        );
        if (poster) poster.classList.remove("hidden");
        if (embed) embed.classList.add("invisible");
      });
      return restoreEmbedsForCapture;
    };

    try {
      const restore = prepareEmbedsForCapture();
      const canvas = await html2canvas(target, {
        backgroundColor: resolveBackgroundColor(),
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
      });
      restore();

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        throw new Error("Unable to encode the captured screenshot.");
      }

      let domSnapshotPayload: string | undefined;
      try {
        const snapshot = captureDomSnapshot(target);
        if (snapshot) {
          domSnapshotPayload = JSON.stringify(snapshot);
        }
      } catch (domError) {
        console.warn("Unable to serialize DOM snapshot", domError);
      }

      const bodyPayload: Record<string, unknown> = {
        image_base64: base64,
        captured_at: new Date().toISOString(),
        source: "ui",
      };

      if (domSnapshotPayload) {
        bodyPayload.dom_snapshot = domSnapshotPayload;
      }

      const response = await fetch(`${API_BASE}/vision/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload),
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}.`);
      }

      const timestamp = new Date().toISOString();
      setLastSharedAt(timestamp);
      setLastSharedPreview(dataUrl);
      if (!silent) {
        setShareStatus("shared");
        setShareMessage(
          "Analyzed and shared your workspace context with the assistant."
        );

        timeoutRef.current = window.setTimeout(() => {
          setShareStatus("idle");
          setShareMessage(null);
        }, 2500);
      } else {
        setShareStatus("shared");
        setShareMessage("Context automatically refreshed for realtime sync.");
      }
    } catch (err) {
      console.error("Unable to capture UI context", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to capture the current UI for context sharing.";
      if (!silent) {
        setShareStatus("error");
        setShareMessage(message);
      }
      setLastSharedPreview(null);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      shareInFlightRef.current = false;
    }
  }, []);

  const lastSharedLabel = useMemo(
    () => formatTimestamp(lastSharedAt),
    [lastSharedAt]
  );

  const statusCardTone = useMemo(
    () => STATUS_CARD_VARIANTS[shareStatus],
    [shareStatus]
  );

  return (
    <Theme appearance="dark">
      <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-30 bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),transparent_55%)]" />
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="relative z-20">
          <WorkspaceBanner
            title="Realtime Assistant"
            current="Realtime Assistant"
            subtitle="Speak with GPT-5 while it sees what you see"
            maxWidthClassName="max-w-none"
            rightSlot={
              <Button
                asChild
                className="bg-emerald-400 text-slate-950 shadow-[0_12px_30px_-18px_rgba(16,185,129,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                <Link href="/emotion-console">Emotion console</Link>
              </Button>
            }
          />
        </div>
        <main className="relative z-10">
          <div
            className="relative mx-auto flex min-h-screen w-full max-w-none flex-col px-6 pb-20 pt-10 sm:px-10"
            ref={surfaceRef}
          >
            <section
              ref={splitRef}
              className="relative z-10 mt-10 grid gap-6"
              style={{
                gridTemplateColumns: `minmax(280px, ${leftWidthPct}%) 14px minmax(320px, ${100 - leftWidthPct}%)`,
              }}
            >
              <div className="flex flex-col gap-0 rounded-2xl border border-slate-800/60 bg-slate-900/70 p-6 shadow-[0_25px_50px_-20px_rgba(15,118,110,0.45)] backdrop-blur">
                <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300/80">
                      Workspace tools
                    </p>
                    <Heading
                      as="h2"
                      size="4"
                      className="mt-1 font-heading text-slate-50"
                    >
                      Creative companion panel
                    </Heading>
                    <Text className="mt-2 text-sm text-slate-300">
                      Swap between a Python scratchpad or dive into the
                      “Attention Is All You Need” paper without leaving the
                      assistant.
                    </Text>
                  </div>
                  <div className="inline-flex h-9 items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-4 text-xs font-semibold uppercase tracking-[0.28em] text-emerald-200">
                    Live
                  </div>
                </header>

                <div>
                  <div className="flex gap-2 rounded-xl border border-slate-800/60 bg-slate-950/60 p-1">
                    {[
                      { id: "code" as const, label: "Python editor" },
                      { id: "paper" as const, label: "Research paper" },
                      { id: "youtube" as const, label: "YouTube" },
                    ].map((tab) => {
                      const isActive = activeWorkspaceTab === tab.id;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setActiveWorkspaceTab(tab.id)}
                          className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                            isActive
                              ? "bg-emerald-400 text-slate-950 shadow-[0_10px_30px_-20px_rgba(16,185,129,0.9)]"
                              : "text-slate-300 hover:text-slate-100"
                          }`}
                        >
                          {tab.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2">
                    {activeWorkspaceTab === "code" ? (
                      <div className="space-y-4 rounded-xl border border-slate-800/70 bg-slate-950/70 p-5">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Text className="text-sm font-semibold text-emerald-200">
                            Python scratchpad
                          </Text>
                          <span className="rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-200">
                            Synced
                          </span>
                        </div>
                        <textarea
                          value={pythonSnippet}
                          onChange={(event) =>
                            setPythonSnippet(event.target.value)
                          }
                          spellCheck={false}
                          className="h-[26rem] w-full resize-none rounded-lg border border-slate-800/70 bg-slate-950/80 p-4 font-mono text-sm leading-relaxed text-emerald-100 shadow-inner focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                          aria-label="Python code editor"
                        />
                        <Text className="text-xs text-slate-400">
                          Draft quick utilities or calculations while
                          collaborating with GPT-5. Code is kept locally in this
                          tab for rapid iteration.
                        </Text>
                      </div>
                    ) : activeWorkspaceTab === "paper" ? (
                      <div className="overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/70">
                        <div
                          className="relative h-[26rem] w-full"
                          data-pdf-poster
                        >
                          <div
                            data-capture-poster
                            className="pointer-events-none absolute inset-0 hidden select-none bg-slate-950/70"
                          >
                            <div className="flex h-full w-full items-center justify-center">
                              <span className="rounded-md border border-slate-700 bg-slate-900/70 px-3 py-1 text-xs text-slate-300">
                                PDF preview (captured)
                              </span>
                            </div>
                          </div>
                          <object
                            data="https://arxiv.org/pdf/1706.03762.pdf#toolbar=0"
                            type="application/pdf"
                            className="absolute left-0 top-0 h-full w-full"
                            data-capture-embed
                          >
                            <div className="p-6 text-sm text-slate-300">
                              Your browser cannot display PDFs.
                              <a
                                href="https://arxiv.org/pdf/1706.03762.pdf"
                                className="ml-2 text-emerald-300 underline"
                              >
                                Download the paper
                              </a>
                              .
                            </div>
                          </object>
                        </div>
                      </div>
                    ) : (
                      <div className="overflow-hidden rounded-xl border border-slate-800/70 bg-slate-950/70">
                        <div
                          className="relative h-[26rem] w-full"
                          data-youtube-id="n1OaYHnzCuE"
                        >
                          <div
                            data-capture-poster
                            className="pointer-events-none absolute inset-0 hidden select-none"
                            style={{
                              backgroundImage:
                                "url(https://img.youtube.com/vi/n1OaYHnzCuE/hqdefault.jpg)",
                              backgroundSize: "cover",
                              backgroundPosition: "center",
                            }}
                          >
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent p-3 text-xs text-slate-200">
                              YouTube preview (captured)
                            </div>
                          </div>
                          <iframe
                            className="absolute left-0 top-0 h-full w-full"
                            src="https://www.youtube.com/embed/n1OaYHnzCuE"
                            title="YouTube video player"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            data-capture-embed
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize panels"
                onMouseDown={() => {
                  isResizingRef.current = true;
                  document.body.style.userSelect = "none";
                  document.body.style.cursor = "col-resize";
                }}
                onTouchStart={() => {
                  isResizingRef.current = true;
                  document.body.style.userSelect = "none";
                  document.body.style.cursor = "col-resize";
                }}
                className="relative mx-auto h-full w-[10px] cursor-col-resize rounded-full bg-slate-800/70 transition-colors hover:bg-emerald-400/70"
              >
                <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md bg-slate-900/80 p-0.5 text-slate-400 shadow-sm">
                  <svg
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="block"
                  >
                    <path
                      d="M10 6L6 12L10 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 6L18 12L14 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
              <div className="space-y-6">
                <RealtimeConversationPanel
                  onShareVisionFrame={() => shareUiContext({ silent: true })}
                  visionFrameIntervalMs={15000} // 15 seconds - adjust this value to change frequency
                />

                <div className="space-y-5 rounded-2xl border border-slate-800/60 bg-slate-900/75 p-6 shadow-[0_25px_50px_-20px_rgba(15,23,42,0.65)] backdrop-blur">
                  <Heading
                    as="h2"
                    size="4"
                    className="font-heading text-slate-50"
                  >
                    Visual context sharing
                  </Heading>
                  <Text className="text-sm leading-relaxed text-slate-300">
                    Capture the visible UI so the assistant understands what you
                    see. Screenshots are automatically analyzed using AI vision
                    and sent before each conversation, giving the assistant full
                    context about your current workspace, applications, and
                    tasks.
                  </Text>
                  {lastSharedPreview ? (
                    <figure className="overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/80 shadow-lg">
                      <div className="relative">
                        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-slate-950/70 via-slate-950/10 to-transparent px-4 py-3">
                          <Text className="text-xs font-medium uppercase tracking-wide text-emerald-300">
                            Latest shared view
                          </Text>
                          {lastSharedLabel ? (
                            <Text className="text-[11px] text-slate-200/80">
                              Captured at {lastSharedLabel}
                            </Text>
                          ) : null}
                        </div>
                        <img
                          src={lastSharedPreview}
                          alt="Latest screenshot shared with the assistant"
                          className="max-h-72 w-full object-cover"
                        />
                      </div>
                      <figcaption className="border-t border-slate-800/80 bg-slate-950/60 px-4 py-3 text-xs text-slate-400">
                        This preview mirrors the exact screenshot transmitted to
                        GPT-5 in the realtime session, helping you confirm the
                        assistant sees the correct workspace.
                      </figcaption>
                    </figure>
                  ) : null}
                  <div
                    className={`space-y-2 rounded-xl border px-4 py-3 transition-colors ${statusCardTone}`}
                  >
                    <Text className="text-sm font-medium">
                      {shareMessage ?? "No context shared yet."}
                    </Text>
                    {lastSharedLabel ? (
                      <Text className="text-xs uppercase tracking-wide text-slate-400">
                        Last shared · {lastSharedLabel}
                      </Text>
                    ) : null}
                  </div>
                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      onClick={() => {
                        void shareUiContext().catch(() => undefined);
                      }}
                      disabled={shareStatus === "capturing"}
                      className="flex-1 bg-emerald-400 text-slate-950 shadow-[0_16px_40px_-24px_rgba(16,185,129,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-80"
                    >
                      {shareStatus === "capturing"
                        ? "Analyzing…"
                        : "Share current view"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (lastSharedAt) {
                          setShareMessage(
                            "The assistant has the latest analyzed context."
                          );
                          setShareStatus("shared");
                          if (timeoutRef.current) {
                            window.clearTimeout(timeoutRef.current);
                          }
                          timeoutRef.current = window.setTimeout(() => {
                            setShareStatus("idle");
                            setShareMessage(null);
                          }, 2000);
                        }
                      }}
                      disabled={!lastSharedAt}
                      className="flex-1 border-slate-700/70 bg-slate-900/40 text-slate-200 transition hover:bg-slate-800/70 hover:text-slate-50 disabled:border-slate-800/60 disabled:text-slate-500"
                    >
                      Mark context as fresh
                    </Button>
                  </div>
                  <Text className="text-xs text-slate-400">
                    Screenshots are analyzed using AI vision and context is
                    shared with the assistant. Data remains in-memory for
                    prototyping purposes and is not persisted.
                  </Text>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </Theme>
  );
}
