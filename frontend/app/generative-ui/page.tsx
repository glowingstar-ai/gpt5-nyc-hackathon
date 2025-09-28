"use client";

import { CSSProperties, FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Loader2, Palette, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import WorkspaceBanner from "@/components/workspace-banner";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type ThemeState = {
  primary: string;
  accent: string;
  background: string;
  text: string;
};

const DEFAULT_THEME: ThemeState = {
  primary: "#22d3ee",
  accent: "#a855f7",
  background: "#0f172a",
  text: "#f8fafc",
};

const toRequestTheme = (theme: ThemeState) => ({
  primary_color: theme.primary,
  accent_color: theme.accent,
  background_color: theme.background,
  text_color: theme.text,
});

export default function GenerativeUIPage(): JSX.Element {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "Hey there! I'm your GPT-5 co-designer. Ask for layout tweaks, palette shifts, or microcopy adjustments and I'll adapt the canvas in real time.",
    },
  ]);
  const [input, setInput] = useState("");
  const [theme, setTheme] = useState<ThemeState>(DEFAULT_THEME);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const themeStyle = useMemo(
    () =>
      ({
        "--primary-color": theme.primary,
        "--accent-color": theme.accent,
        "--background-color": theme.background,
        "--text-color": theme.text,
      }) as CSSProperties,
    [theme]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      return;
    }

    setIsLoading(true);
    setError(null);

    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: trimmed },
    ];
    setMessages(nextMessages);
    setInput("");

    try {
      const response = await fetch(`${API_BASE}/generative-ui/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
          current_theme: toRequestTheme(theme),
        }),
      });

      if (!response.ok) {
        throw new Error("The generative UI service is unavailable right now.");
      }

      const data = await response.json();
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content:
          typeof data.message === "string"
            ? data.message
            : "I'm here, but I couldn't interpret that response. Try again?",
      };

      const suggestion = data.suggested_theme as
        | {
            primary_color?: string;
            accent_color?: string;
            background_color?: string;
            text_color?: string;
          }
        | undefined;

      setMessages((prev) => [...prev, assistantMessage]);

      if (suggestion) {
        setTheme((prev) => ({
          primary: suggestion.primary_color ?? prev.primary,
          accent: suggestion.accent_color ?? prev.accent,
          background: suggestion.background_color ?? prev.background,
          text: suggestion.text_color ?? prev.text,
        }));
      }
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while contacting GPT-5."
      );
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I hit a snag talking to the model. Give it another go in a moment?",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <WorkspaceBanner
        title="Generative UI Studio"
        current="Generative UI"
        subtitle="Co-design live interfaces with GPT-5 as your palette partner"
        maxWidthClassName="max-w-7xl"
      />
      <div className="mx-auto grid min-h-screen w-full max-w-7xl grid-cols-1 gap-6 px-6 py-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:px-12">
        <section className="flex flex-col rounded-2xl border border-white/10 bg-slate-900/40 p-6 shadow-2xl shadow-cyan-900/20">
          <header className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm uppercase tracking-[0.4em] text-cyan-200/80">
                Layout Canvas
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-slate-50">
                Generative UI Studio
              </h1>
              <p className="mt-1 text-sm text-slate-300">
                Preview the PDF brief while GPT-5 shapes the experience on the right.
              </p>
            </div>
            <Palette className="h-10 w-10 text-cyan-300" aria-hidden />
          </header>
          <div className="mt-6 flex grow items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-slate-950/60">
            <object
              data="/generative-ui-preview.pdf"
              type="application/pdf"
              className="h-full w-full"
            >
              <p className="p-4 text-center text-sm text-slate-300">
                Your browser cannot display PDFs. <Link href="/generative-ui-preview.pdf" className="text-cyan-300 underline">Download the brief</Link>.
              </p>
            </object>
          </div>
        </section>

        <section
          className="flex flex-col rounded-2xl border border-white/10 shadow-[0_0_40px_rgba(14,116,144,0.3)]"
          style={themeStyle}
        >
          <div className="rounded-t-2xl border-b border-white/10 bg-[color:var(--background-color)]/80 px-6 py-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold" style={{ color: "var(--text-color)" }}>
                  GPT-5 Generative Panel
                </h2>
                <p className="text-sm text-slate-300">
                  Ask for palette shifts, typography vibes, or component tweaks.
                </p>
              </div>
              <Sparkles className="h-6 w-6 text-[color:var(--accent-color)]" aria-hidden />
            </div>
          </div>

          <div className="flex flex-1 flex-col bg-[color:var(--background-color)]/90">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {messages.map((message, index) => (
                <div
                  key={`${message.role}-${index}`}
                  className={cn("flex", {
                    "justify-end": message.role === "user",
                  })}
                >
                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-lg",
                      message.role === "user"
                        ? "bg-[color:var(--accent-color)]/80 text-white"
                        : "bg-slate-900/70 text-slate-100"
                    )}
                  >
                    {message.content}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Thinking through your request...
                </div>
              )}
            </div>

            <div className="border-t border-white/10 bg-slate-900/70 px-6 py-5">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  rows={3}
                  placeholder="E.g. soften the background, give buttons a sunrise gradient, make typography calmer"
                  className="w-full resize-none rounded-xl border border-slate-700/60 bg-slate-950/60 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-[color:var(--accent-color)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-color)]/40"
                />
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span>
                    Colors update live based on GPT-5 suggestions.
                  </span>
                  <Button type="submit" disabled={isLoading} size="sm">
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" />
                        Ask GPT-5
                      </>
                    )}
                  </Button>
                </div>
              </form>
              {error && (
                <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
                  {error}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-b-2xl border-t border-white/10 bg-slate-900/60 px-6 py-4 text-xs text-slate-300">
            <p className="font-semibold uppercase tracking-[0.3em] text-[color:var(--accent-color)]">
              Theme tokens
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {["primary", "accent", "background", "text"].map((key) => {
                const value = (theme as Record<string, string>)[key];
                return (
                  <div key={key} className="rounded-xl border border-white/10 bg-slate-950/80 p-3">
                    <div className="flex items-center justify-between text-[0.7rem] uppercase tracking-wide text-slate-400">
                      <span>{key}</span>
                      <span className="font-mono text-slate-300">{value}</span>
                    </div>
                    <div
                      className="mt-2 h-8 w-full rounded-lg border border-white/10"
                      style={{ background: value }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
