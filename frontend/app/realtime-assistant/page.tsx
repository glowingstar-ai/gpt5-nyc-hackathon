"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { Theme, Heading, Text } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

import RealtimeConversationPanel from "@/components/realtime-conversation";
import { Button } from "@/components/ui/button";

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

  const [shareStatus, setShareStatus] = useState<ShareStatus>("idle");
  const [shareMessage, setShareMessage] = useState<string | null>(null);
  const [lastSharedAt, setLastSharedAt] = useState<string | null>(null);
  const [lastSharedPreview, setLastSharedPreview] = useState<string | null>(
    null
  );

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

  return (
    <Theme appearance="dark">
      <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.12),transparent_60%)]" />
        <div className="pointer-events-none absolute inset-0 -z-20 bg-[radial-gradient(circle_at_bottom_right,_rgba(16,185,129,0.12),transparent_55%)]" />
        <div
          className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 pb-20 pt-10 sm:px-10"
          ref={surfaceRef}
        >
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
                className="text-slate-200 hover:text-slate-50 hover:bg-slate-800/60"
              >
                <Link href="/">Back to studio</Link>
              </Button>
              <Button
                asChild
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
