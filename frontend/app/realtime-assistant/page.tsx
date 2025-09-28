"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import html2canvas from "html2canvas";
import { Theme, Heading, Text } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

import RealtimeConversationPanel, {
  UiOverlayInstruction,
} from "@/components/realtime-conversation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  const overlayTimeoutsRef = useRef<Map<string, number>>(new Map());

  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [lastSharedAt, setLastSharedAt] = useState<string | null>(null);
  const [lastSharedPreview, setLastSharedPreview] = useState<string | null>(
    null
  );
  const [overlayInstructions, setOverlayInstructions] = useState<
    ActiveOverlayInstruction[]
  >([]);
  const [computedOverlays, setComputedOverlays] = useState<
    ComputedOverlay[]
  >([]);

  useEffect(() => {
    const timeouts = overlayTimeoutsRef.current;
    return () => {
      timeouts.forEach((handle) => {
        window.clearTimeout(handle);
      });
      timeouts.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
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

    try {
      const canvas = await html2canvas(target, {
        backgroundColor: resolveBackgroundColor(),
        scale: Math.min(window.devicePixelRatio || 1, 2),
        useCORS: true,
        logging: false,
      });

      const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      const base64 = dataUrl.split(",")[1];
      if (!base64) {
        throw new Error("Unable to encode the captured screenshot.");
      }

      const response = await fetch(`${API_BASE}/vision/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          captured_at: new Date().toISOString(),
          source: "ui",
        }),
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

  const scheduleOverlayRemoval = useCallback((id: string, durationMs = 8000) => {
    if (!durationMs || durationMs < 0) {
      return;
    }

    const existing = overlayTimeoutsRef.current.get(id);
    if (existing) {
      window.clearTimeout(existing);
    }

    const handle = window.setTimeout(() => {
      setOverlayInstructions((prev) =>
        prev.filter((instruction) => instruction.id !== id)
      );
      overlayTimeoutsRef.current.delete(id);
    }, durationMs);

    overlayTimeoutsRef.current.set(id, handle);
  }, []);

  const handleOverlayInstruction = useCallback(
    (instruction: UiOverlayInstruction) => {
      if (instruction.action === "clear") {
        setOverlayInstructions((prev) => {
          if (!instruction.id && !instruction.selector) {
            overlayTimeoutsRef.current.forEach((handle) => {
              window.clearTimeout(handle);
            });
            overlayTimeoutsRef.current.clear();
            return [];
          }

          const remaining: ActiveOverlayInstruction[] = [];
          prev.forEach((overlay) => {
            const matchesId = instruction.id
              ? overlay.id === instruction.id
              : true;
            const matchesSelector = instruction.selector
              ? overlay.selector === instruction.selector
              : true;
            const shouldRemove = matchesId && matchesSelector;

            if (shouldRemove) {
              const timer = overlayTimeoutsRef.current.get(overlay.id);
              if (timer) {
                window.clearTimeout(timer);
                overlayTimeoutsRef.current.delete(overlay.id);
              }
            } else {
              remaining.push(overlay);
            }
          });

          return remaining;
        });
        return;
      }

      const id =
        instruction.id ??
        `overlay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const shape: "circle" | "rect" = instruction.shape ?? "circle";

      setOverlayInstructions((prev) => {
        const filtered = prev.filter((overlay) => overlay.id !== id);
        return [
          ...filtered,
          {
            ...instruction,
            id,
            shape,
          },
        ];
      });

      scheduleOverlayRemoval(id, instruction.durationMs);
    },
    [scheduleOverlayRemoval]
  );

  useLayoutEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) {
      setComputedOverlays([]);
      return;
    }

    const computeOverlays = () => {
      const host = surfaceRef.current;
      if (!host) {
        setComputedOverlays([]);
        return;
      }

      const hostRect = host.getBoundingClientRect();
      const results: ComputedOverlay[] = [];

      overlayInstructions.forEach((overlay) => {
        let rect: DOMRectLike | null = null;

        if (overlay.selector) {
          const target = host.querySelector(overlay.selector);
          if (target instanceof HTMLElement) {
            const targetRect = target.getBoundingClientRect();
            rect = {
              left: targetRect.left - hostRect.left + host.scrollLeft,
              top: targetRect.top - hostRect.top + host.scrollTop,
              width: targetRect.width,
              height: targetRect.height,
            };
          }
        }

        if (!rect && overlay.coords) {
          rect = {
            left: overlay.coords.x,
            top: overlay.coords.y,
            width: overlay.coords.width,
            height: overlay.coords.height,
          };
        }

        if (!rect) {
          return;
        }

        const padding = overlay.padding ?? 12;

        if (overlay.shape === "circle") {
          const diameter = Math.max(rect.width, rect.height) + padding * 2;
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          results.push({
            ...overlay,
            left: centerX - diameter / 2,
            top: centerY - diameter / 2,
            width: diameter,
            height: diameter,
          });
          return;
        }

        results.push({
          ...overlay,
          left: rect.left - padding,
          top: rect.top - padding,
          width: rect.width + padding * 2,
          height: rect.height + padding * 2,
        });
      });

      setComputedOverlays(results);
    };

    computeOverlays();

    const handleResize = () => computeOverlays();
    const handleScroll = () => computeOverlays();

    window.addEventListener("resize", handleResize);
    document.addEventListener("scroll", handleScroll, true);

    const observer = new ResizeObserver(() => computeOverlays());
    observer.observe(surface);

    overlayInstructions.forEach((overlay) => {
      if (!overlay.selector) {
        return;
      }
      const element = surface.querySelector(overlay.selector);
      if (element instanceof Element) {
        observer.observe(element);
      }
    });

    return () => {
      window.removeEventListener("resize", handleResize);
      document.removeEventListener("scroll", handleScroll, true);
      observer.disconnect();
    };
  }, [overlayInstructions]);

  return (
    <Theme appearance="dark">
      <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),transparent_55%)]" />
        <div
          className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-20 pt-10 sm:px-10"
          ref={surfaceRef}
        >
          {computedOverlays.length > 0 ? (
            <div className="pointer-events-none absolute inset-0 z-30">
              {computedOverlays.map((overlay) => (
                <div
                  key={overlay.id}
                  className="absolute"
                  style={{
                    left: overlay.left,
                    top: overlay.top,
                    width: overlay.width,
                    height: overlay.height,
                  }}
                >
                  <div
                    className={cn(
                      "relative h-full w-full border-2 border-emerald-400/80 bg-emerald-400/10 shadow-[0_0_0_6px_rgba(16,185,129,0.2)] backdrop-blur-sm",
                      overlay.shape === "circle"
                        ? "rounded-full"
                        : "rounded-2xl"
                    )}
                  >
                    <div
                      className={cn(
                        "pointer-events-none absolute inset-0 animate-ping border-2 border-emerald-400/40",
                        overlay.shape === "circle"
                          ? "rounded-full"
                          : "rounded-2xl"
                      )}
                    />
                    {overlay.label ? (
                      <span className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full bg-emerald-400 px-3 py-1 text-xs font-semibold text-emerald-950 shadow-lg">
                        {overlay.label}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : null}
          <div className="pointer-events-none absolute inset-x-0 top-16 mx-auto h-72 max-w-3xl rounded-full bg-emerald-500/10 blur-3xl" />
          <header className="relative z-10 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800/60 bg-slate-900/70 px-6 py-5 shadow-[0_12px_40px_-24px_rgba(15,118,110,0.8)] backdrop-blur">
            <div>
              <Heading as="h1" size="5" className="font-heading text-slate-50">
                Realtime assistant workspace
              </Heading>
              <Text className="mt-1 text-sm text-slate-300">
                Speak with GPT-5 while sharing a live snapshot of the UI you are
                viewing.
              </Text>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                asChild
                data-ui="nav-home"
                className="text-slate-200 hover:text-slate-50 hover:bg-slate-800/60"
              >
                <Link href="/">Back to studio</Link>
              </Button>
              <Button
                asChild
                data-ui="nav-emotion-console"
                className="bg-emerald-400 text-slate-950 shadow-[0_12px_30px_-18px_rgba(16,185,129,0.9)] transition-transform hover:-translate-y-0.5 hover:bg-emerald-300"
              >
                <Link href="/emotion-console">Open emotion console</Link>
              </Button>
            </div>
          </header>

          <section className="relative z-10 mt-10 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <RealtimeConversationPanel
              onShareVisionFrame={() => shareUiContext({ silent: true })}
              visionFrameIntervalMs={15000} // 15 seconds - adjust this value to change frequency
              onOverlayInstruction={handleOverlayInstruction}
            />

            <div className="space-y-5 rounded-2xl border border-slate-800/60 bg-slate-900/75 p-6 shadow-[0_25px_50px_-20px_rgba(15,23,42,0.65)] backdrop-blur">
              <Heading as="h2" size="4" className="font-heading text-slate-50">
                Visual context sharing
              </Heading>
              <Text className="text-sm leading-relaxed text-slate-300">
                Capture the visible UI so the assistant understands what you
                see. Screenshots are automatically analyzed using AI vision and
                sent before each conversation, giving the assistant full context
                about your current workspace, applications, and tasks.
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
                  data-ui="action-share-view"
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
                  data-ui="action-mark-fresh"
                  className="flex-1 border-slate-700/70 bg-slate-900/40 text-slate-200 transition hover:bg-slate-800/70 hover:text-slate-50 disabled:border-slate-800/60 disabled:text-slate-500"
                >
                  Mark context as fresh
                </Button>
              </div>
              <Text className="text-xs text-slate-400">
                Screenshots are analyzed using AI vision and context is shared
                with the assistant. Data remains in-memory for prototyping
                purposes and is not persisted.
              </Text>
            </div>
          </section>
        </div>
      </main>
    </Theme>
  );
}

type ActiveOverlayInstruction = UiOverlayInstruction & {
  id: string;
  shape: "circle" | "rect";
};

type DOMRectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ComputedOverlay = ActiveOverlayInstruction & DOMRectLike;
