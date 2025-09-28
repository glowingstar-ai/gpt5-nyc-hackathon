"use client";

import { type ReactNode, useCallback, useEffect, useState } from "react";

const INVITE_CODE = "chenyu";
const STORAGE_KEY = "glowingstar.invite-code.timestamp";
const EXPIRATION_MS = 60 * 60 * 1000; // 1 hour

type InviteGateProps = {
  children: ReactNode;
};

type InviteStatus = "loading" | "granted" | "prompt";

type StoredInvite = {
  verifiedAt: number;
};

const loadStoredInvite = (): StoredInvite | null => {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredInvite;
    if (typeof parsed?.verifiedAt !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
};

const storeInvite = (value: StoredInvite | null) => {
  if (typeof window === "undefined") return;

  if (!value) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
};

export function InviteGate({ children }: InviteGateProps) {
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [codeInput, setCodeInput] = useState("");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistMessage, setWaitlistMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isVerified = status === "granted";

  useEffect(() => {
    const stored = loadStoredInvite();
    if (!stored) {
      setStatus("prompt");
      return;
    }

    const expiresAt = stored.verifiedAt + EXPIRATION_MS;
    if (Date.now() < expiresAt) {
      setStatus("granted");
    } else {
      storeInvite(null);
      setStatus("prompt");
    }
  }, []);

  const handleCodeSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setErrorMessage(null);

      if (codeInput.trim().toLowerCase() === INVITE_CODE.toLowerCase()) {
        const verifiedAt = Date.now();
        storeInvite({ verifiedAt });
        setStatus("granted");
        setCodeInput("");
      } else {
        setErrorMessage("That invitation code isn\'t valid. Please try again.");
      }
    },
    [codeInput]
  );

  const handleWaitlistSubmit = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      setWaitlistMessage(null);

      if (!waitlistEmail.trim()) {
        setWaitlistMessage("Please enter an email address to join the waitlist.");
        return;
      }

      setWaitlistMessage(
        "Thanks! We\'ve added you to the waitlist and will reach out as soon as private beta slots open."
      );
      setWaitlistEmail("");
    },
    [waitlistEmail]
  );

  return (
    <div className="relative min-h-screen">
      <div
        className={`min-h-screen transition-all duration-300 ${
          isVerified ? "blur-0" : "pointer-events-none select-none blur-lg"
        }`}
      >
        {children}
      </div>

      {status !== "granted" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-md rounded-3xl border border-white/10 bg-white/95 p-8 text-left shadow-2xl shadow-black/40 backdrop-blur-lg dark:border-white/10 dark:bg-zinc-900/90">
            {status === "loading" ? (
              <div className="flex flex-col items-center gap-4 text-center text-zinc-700 dark:text-zinc-200">
                <div className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
                <p className="text-sm">Preparing your experience&hellip;</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-2 text-center">
                  <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
                    Enter Invitation Code
                  </h1>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300">
                    We&apos;re currently in a private beta. Please enter your invitation code to continue.
                  </p>
                </div>

                <form className="space-y-3" onSubmit={handleCodeSubmit}>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200" htmlFor="invite-code">
                    Invitation code
                  </label>
                  <input
                    id="invite-code"
                    name="invite-code"
                    value={codeInput}
                    onChange={(event) => setCodeInput(event.target.value)}
                    className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-2 text-base text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    placeholder="Enter your code"
                    autoComplete="off"
                  />
                  {errorMessage && (
                    <p className="text-sm text-red-500" role="alert">
                      {errorMessage}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-offset-zinc-900"
                  >
                    Unlock experience
                  </button>
                </form>

                <div className="space-y-3 rounded-2xl bg-zinc-100/70 p-4 text-sm text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-200">
                  <p className="font-medium">Don&apos;t have a code yet?</p>
                  <p>
                    Join the waitlist and we&apos;ll reach out as soon as new private beta spots open up.
                  </p>
                  <form className="space-y-2" onSubmit={handleWaitlistSubmit}>
                    <label className="sr-only" htmlFor="waitlist-email">
                      Email address
                    </label>
                    <input
                      id="waitlist-email"
                      name="waitlist-email"
                      type="email"
                      value={waitlistEmail}
                      onChange={(event) => setWaitlistEmail(event.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl border border-transparent bg-white px-4 py-2 text-sm text-zinc-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-zinc-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-xl border border-indigo-200 bg-white px-4 py-2 text-sm font-semibold text-indigo-600 transition hover:border-indigo-300 hover:text-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-offset-2 focus:ring-offset-white dark:border-indigo-500/40 dark:bg-transparent dark:text-indigo-300 dark:hover:text-indigo-200 dark:focus:ring-offset-zinc-900"
                    >
                      Join the waitlist
                    </button>
                  </form>
                  {waitlistMessage && <p className="text-xs text-indigo-500 dark:text-indigo-300">{waitlistMessage}</p>}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default InviteGate;
