"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Heading, Text } from "@radix-ui/themes";

import { Button } from "@/components/ui/button";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type RealtimeSessionToken = {
  session_id?: string | null;
  client_secret: string;
  expires_at: string;
  model: string;
  url: string;
  voice?: string | null;
  dom_summary?: string | null;
  dom_snapshot?: string | null;
  highlight_instructions?: HighlightInstruction[] | null;
};

type TranscriptEntry = {
  id: string;
  role: "assistant" | "user" | "system";
  text: string;
};

type HighlightInstruction = {
  selector?: string | null;
  action: "highlight" | "execute";
  reason?: string | null;
  script?: string | null;
};

type AssistantStructuredResponse = {
  answer: string;
  highlights: HighlightInstruction[];
};

const waitForIceGathering = (pc: RTCPeerConnection): Promise<void> =>
  new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      resolve();
      return;
    }
    const checkState = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", checkState);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", checkState);
  });

const normalizeDelta = (payload: Record<string, unknown>): string => {
  const delta = payload.delta ?? payload.text ?? payload.content;
  if (typeof delta === "string") {
    return delta;
  }
  return "";
};

const extractResponseId = (payload: Record<string, unknown>): string => {
  if (typeof payload.response_id === "string") return payload.response_id;
  if (typeof payload.id === "string") return payload.id;
  const response = payload.response;
  if (response && typeof response === "object" && "id" in response) {
    const { id } = response as { id?: unknown };
    if (typeof id === "string") return id;
  }
  return `resp_${Date.now()}`;
};

const extractJsonObject = (raw: string): unknown => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return null;
  }

  const candidate = raw.slice(start, end + 1);
  try {
    return JSON.parse(candidate);
  } catch (error) {
    console.warn("Failed to parse assistant JSON payload", error);
    return null;
  }
};

const parseAssistantStructuredResponse = (
  raw: string
): AssistantStructuredResponse | null => {
  const data = extractJsonObject(raw);
  if (!data || typeof data !== "object") {
    return null;
  }

  const { answer, highlights } = data as {
    answer?: unknown;
    highlights?: unknown;
  };

  if (typeof answer !== "string") {
    return null;
  }

  const parsedHighlights: HighlightInstruction[] = Array.isArray(highlights)
    ? (highlights as unknown[])
        .map((entry) => {
          if (!entry || typeof entry !== "object") {
            return null;
          }
          const { selector, action, reason, script, code } = entry as {
            selector?: unknown;
            action?: unknown;
            reason?: unknown;
            script?: unknown;
            code?: unknown;
          };
          const normalizedAction =
            typeof action === "string" && action.trim() !== ""
              ? (action.trim().toLowerCase() as HighlightInstruction["action"])
              : "highlight";
          if (
            normalizedAction !== "highlight" &&
            normalizedAction !== "execute"
          ) {
            return null;
          }
          const selectorValue =
            typeof selector === "string" && selector.trim() !== ""
              ? selector.trim()
              : null;
          const scriptSource =
            typeof script === "string" && script.trim() !== ""
              ? script.trim()
              : typeof code === "string" && code.trim() !== ""
                ? code.trim()
                : null;
          if (normalizedAction === "highlight" && !selectorValue) {
            return null;
          }
          return {
            selector: selectorValue,
            action: normalizedAction,
            reason:
              typeof reason === "string" && reason.trim() !== ""
                ? reason.trim()
                : null,
            script: scriptSource,
          } satisfies HighlightInstruction;
        })
        .filter((entry): entry is HighlightInstruction => Boolean(entry))
    : [];

  return {
    answer: answer.trim(),
    highlights: parsedHighlights,
  };
};

type RealtimeConversationPanelProps = {
  onShareVisionFrame?: () => Promise<void>;
  visionFrameIntervalMs?: number; // Interval between automatic vision frame captures in milliseconds
};

export function RealtimeConversationPanel({
  onShareVisionFrame,
  visionFrameIntervalMs = 15000, // Default to 15 seconds
}: RealtimeConversationPanelProps): JSX.Element {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const pendingResponsesRef = useRef<Map<string, string>>(new Map());
  const isMountedRef = useRef(true);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState(
    "Idle – start a call to speak with the realtime assistant."
  );
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [highlightInstructions, setHighlightInstructions] = useState<
    HighlightInstruction[]
  >([]);

  const resetConnection = useCallback((message?: string) => {
    dataChannelRef.current?.close();
    dataChannelRef.current = null;

    const pc = peerConnectionRef.current;
    peerConnectionRef.current = null;
    if (pc) {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.onconnectionstatechange = null;
      pc.close();
    }

    const localStream = localStreamRef.current;
    localStreamRef.current = null;
    localStream?.getTracks().forEach((track) => track.stop());

    if (audioRef.current) {
      audioRef.current.srcObject = null;
    }

    pendingResponsesRef.current.clear();
    setIsConnecting(false);
    setIsActive(false);
    setHighlightInstructions([]);
    if (message) {
      setStatus(message);
    } else {
      setStatus("Call ended. Start again to reconnect.");
    }
  }, []);

  const appendAssistantDelta = useCallback(
    (responseId: string, delta: string) => {
      if (!delta) return;
      const updated =
        (pendingResponsesRef.current.get(responseId) ?? "") + delta;
      pendingResponsesRef.current.set(responseId, updated);
      setTranscript((prev) => {
        const index = prev.findIndex((entry) => entry.id === responseId);
        if (index >= 0) {
          const clone = [...prev];
          clone[index] = { ...clone[index], text: updated };
          return clone;
        }
        return [...prev, { id: responseId, role: "assistant", text: updated }];
      });
    },
    []
  );

  const handleServerMessage = useCallback(
    (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as Record<string, unknown>;
        const type = typeof payload.type === "string" ? payload.type : "";
        if (
          type === "response.output_text.delta" ||
          type === "response.output_audio_transcript.delta"
        ) {
          appendAssistantDelta(
            extractResponseId(payload),
            normalizeDelta(payload)
          );
          return;
        }

        if (type === "response.done") {
          const responseId = extractResponseId(payload);
          const existing = pendingResponsesRef.current.get(responseId);
          if (existing) {
            const structured = parseAssistantStructuredResponse(existing);
            if (structured) {
              pendingResponsesRef.current.set(
                responseId,
                structured.answer
              );
              setTranscript((prev) => {
                const index = prev.findIndex((entry) => entry.id === responseId);
                if (index === -1) return prev;
                const clone = [...prev];
                clone[index] = { ...clone[index], text: structured.answer };
                return clone;
              });
              setHighlightInstructions(structured.highlights ?? []);
            } else {
              const normalized = existing.trim();
              pendingResponsesRef.current.set(responseId, normalized);
              setTranscript((prev) => {
                const index = prev.findIndex((entry) => entry.id === responseId);
                if (index === -1) return prev;
                const clone = [...prev];
                clone[index] = { ...clone[index], text: normalized };
                return clone;
              });
              setHighlightInstructions([]);
            }
          }
          return;
        }

        if (type === "conversation.item.created") {
          const item = payload.item;
          if (item && typeof item === "object") {
            const { role, content, id } = item as {
              role?: unknown;
              content?: unknown;
              id?: unknown;
            };
            if (role === "user" && Array.isArray(content)) {
              const textPart = content.find(
                (part) =>
                  part &&
                  typeof part === "object" &&
                  (part as { type?: string }).type === "input_text"
              ) as { text?: unknown } | undefined;
              if (typeof textPart?.text === "string") {
                const entryId =
                  typeof id === "string" ? id : `user_${Date.now()}`;
                setTranscript((prev) => [
                  ...prev,
                  { id: entryId, role: "user", text: textPart.text },
                ]);
              }
            }
          }
        }
      } catch (err) {
        console.warn("Failed to parse realtime event", err);
      }
    },
    [appendAssistantDelta]
  );

  const startConversation = useCallback(async () => {
    if (isConnecting || isActive) {
      return;
    }

    setIsConnecting(true);
    setError(null);
    setStatus("Requesting realtime session…");
    setTranscript([]);
    pendingResponsesRef.current.clear();
    setHighlightInstructions([]);

    try {
      if (onShareVisionFrame) {
        console.log(
          `[Vision Frame] Initial capture triggered on connection start`
        );
        try {
          await onShareVisionFrame();
          console.log(`[Vision Frame] Initial capture completed successfully`);
        } catch (err) {
          console.warn("Unable to capture context frame", err);
        }
      }

      const response = await fetch(`${API_BASE}/realtime/session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!response.ok) {
        throw new Error(
          `Failed to create realtime session (${response.status})`
        );
      }
      const token = (await response.json()) as RealtimeSessionToken;
      if (!token.client_secret || !token.url) {
        throw new Error(
          "Realtime session response is missing required fields."
        );
      }

      if (token.highlight_instructions && token.highlight_instructions.length) {
        setHighlightInstructions(token.highlight_instructions);
      }

      const pc = new RTCPeerConnection();
      peerConnectionRef.current = pc;

      pc.ontrack = (event) => {
        const [remoteStream] = event.streams;
        if (audioRef.current && remoteStream) {
          audioRef.current.srcObject = remoteStream;
        }
      };

      pc.onconnectionstatechange = () => {
        if (!isMountedRef.current) {
          return;
        }
        if (pc.connectionState === "connected") {
          setStatus("Connected – start speaking with the assistant.");
        }
        if (
          pc.connectionState === "failed" ||
          pc.connectionState === "disconnected"
        ) {
          resetConnection(
            "Connection lost. Try starting the conversation again."
          );
        }
      };

      const dataChannel = pc.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener("message", handleServerMessage);
      dataChannel.addEventListener("open", () => {
        if (!isMountedRef.current) {
          return;
        }
        setIsActive(true);
        setStatus("Assistant joined – you can speak or send text prompts.");
        dataChannel.send(JSON.stringify({ type: "response.create" }));
      });
      dataChannel.addEventListener("close", () => {
        if (isMountedRef.current) {
          resetConnection();
        }
      });

      const localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      localStreamRef.current = localStream;
      localStream.getTracks().forEach((track) => {
        pc.addTrack(track, localStream);
      });

      await pc.setLocalDescription(await pc.createOffer());
      await waitForIceGathering(pc);

      const sdpResponse = await fetch(token.url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.client_secret}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime=v1",
        },
        body: pc.localDescription?.sdp ?? "",
      });

      if (!sdpResponse.ok) {
        throw new Error(`Realtime handshake failed (${sdpResponse.status})`);
      }

      const answer = await sdpResponse.text();
      await pc.setRemoteDescription({ type: "answer", sdp: answer });

      setStatus("Awaiting assistant audio…");
    } catch (err) {
      console.error("Unable to start realtime conversation", err);
      if (err instanceof Error) {
        setError(err.message);
        resetConnection("Unable to establish realtime session.");
      } else {
        setError("Unknown error while connecting to realtime session.");
        resetConnection();
      }
    }
  }, [
    handleServerMessage,
    isActive,
    isConnecting,
    onShareVisionFrame,
    resetConnection,
    setHighlightInstructions,
  ]);

  const stopConversation = useCallback(() => {
    if (!isConnecting && !isActive) {
      return;
    }
    resetConnection();
  }, [isActive, isConnecting, resetConnection]);

  const sendTextMessage = useCallback(() => {
    const channel = dataChannelRef.current;
    const text = inputValue.trim();
    if (!channel || !text) {
      return;
    }

    const entryId = `user_${Date.now()}`;
    setTranscript((prev) => [...prev, { id: entryId, role: "user", text }]);
    channel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text }],
        },
      })
    );
    channel.send(JSON.stringify({ type: "response.create" }));
    setInputValue("");
  }, [inputValue]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      resetConnection();
    };
  }, [resetConnection]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const styleId = "gpt-realtime-highlight-style";
    if (document.getElementById(styleId)) {
      return undefined;
    }

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
.realtime-highlight-outline {
  position: relative;
  outline: 3px solid rgba(16, 185, 129, 0.85);
  outline-offset: 6px;
  border-radius: 14px;
  box-shadow: 0 0 0 10px rgba(16, 185, 129, 0.18);
  transition: outline 0.2s ease, box-shadow 0.2s ease;
}
.realtime-highlight-outline::before {
  content: attr(data-gpt-highlight-index);
  position: absolute;
  top: -1.75rem;
  left: 0;
  background: rgba(16, 185, 129, 0.95);
  color: #0f172a;
  font-weight: 700;
  font-size: 0.7rem;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  box-shadow: 0 10px 25px rgba(16, 185, 129, 0.35);
}
.realtime-highlight-outline[data-gpt-highlight-reason]::after {
  content: attr(data-gpt-highlight-reason);
  position: absolute;
  top: -1.75rem;
  left: calc(1.85rem);
  background: rgba(15, 23, 42, 0.92);
  color: #a7f3d0;
  font-size: 0.65rem;
  font-weight: 500;
  letter-spacing: 0.02em;
  padding: 0.2rem 0.7rem;
  border-radius: 9999px;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.45);
  white-space: nowrap;
  pointer-events: none;
}
`;
    document.head.appendChild(style);

    return () => {
      if (style.parentNode) {
        style.parentNode.removeChild(style);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const className = "realtime-highlight-outline";
    const applied: HTMLElement[] = [];
    const cleanupCallbacks: Array<() => void> = [];

    highlightInstructions.forEach((instruction, index) => {
      if (!instruction) {
        return;
      }

      const element =
        instruction.selector && typeof instruction.selector === "string"
          ? document.querySelector<HTMLElement>(instruction.selector)
          : null;

      if (instruction.action === "highlight" && element) {
        element.classList.add(className);
        element.setAttribute("data-gpt-highlight-index", String(index + 1));
        if (instruction.reason) {
          element.setAttribute("data-gpt-highlight-reason", instruction.reason);
        } else {
          element.removeAttribute("data-gpt-highlight-reason");
        }
        applied.push(element);
      }

      if (instruction.script) {
        try {
          const executor = new Function(
            "instruction",
            "element",
            "index",
            "document",
            "window",
            String(instruction.script)
          ) as (
            instruction: HighlightInstruction,
            element: HTMLElement | null,
            index: number,
            document: Document,
            window: Window
          ) => unknown;

          const result = executor(
            instruction,
            element,
            index,
            document,
            window
          );

          if (typeof result === "function") {
            cleanupCallbacks.push(() => {
              try {
                result();
              } catch (cleanupError) {
                console.warn(
                  "Realtime highlight cleanup function threw an error",
                  cleanupError
                );
              }
            });
          }
        } catch (scriptError) {
          console.warn(
            "Realtime highlight script execution failed",
            scriptError
          );
        }
      }
    });

    return () => {
      applied.forEach((element) => {
        element.classList.remove(className);
        element.removeAttribute("data-gpt-highlight-index");
        element.removeAttribute("data-gpt-highlight-reason");
      });
      cleanupCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (err) {
          console.warn(
            "Realtime highlight cleanup callback failed",
            err
          );
        }
      });
    };
  }, [highlightInstructions]);

  // DISABLED: Automatic periodic vision frame captures
  // Uncomment the code below if you want to re-enable automatic captures
  /*
  useEffect(() => {
    if (!isActive || !onShareVisionFrame) {
      return undefined;
    }

    let isCancelled = false;
    let timeoutId: number | undefined;

    const shareLoop = async () => {
      if (isCancelled) {
        return;
      }

      console.log(`[Vision Frame] Periodic capture triggered - interval: ${visionFrameIntervalMs}ms`);
      try {
        await onShareVisionFrame();
        console.log(`[Vision Frame] Periodic capture completed successfully`);
      } catch (err) {
        console.warn("Unable to share periodic context frame", err);
      }

      if (!isCancelled) {
        timeoutId = window.setTimeout(shareLoop, visionFrameIntervalMs);
        console.log(`[Vision Frame] Next capture scheduled in ${visionFrameIntervalMs}ms`);
      }
    };

    void shareLoop();

    return () => {
      isCancelled = true;
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isActive, onShareVisionFrame, visionFrameIntervalMs]);
  */

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <Heading as="h2" size="4" className="mb-3 font-heading">
        Realtime conversation
      </Heading>
      <Text className="text-sm text-slate-500 dark:text-slate-400">
        {status}
      </Text>
      {error ? (
        <Text className="mt-2 text-sm text-rose-500">{error}</Text>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button onClick={startConversation} disabled={isConnecting || isActive}>
          {isConnecting
            ? "Connecting…"
            : isActive
              ? "Connected"
              : "Start conversation"}
        </Button>
        <Button
          variant="destructive"
          onClick={stopConversation}
          disabled={!isConnecting && !isActive}
        >
          Hang up
        </Button>
      </div>

      <div className="mt-6 space-y-3">
        <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-3 text-sm dark:border-slate-700 dark:bg-slate-950/60">
          {transcript.length === 0 ? (
            <Text className="text-sm text-slate-500 dark:text-slate-400">
              Assistant transcripts and user utterances will appear here once
              the call starts.
            </Text>
          ) : (
            <ul className="space-y-2">
              {transcript.map((entry) => (
                <li key={entry.id} className="space-y-1">
                  <Text className="block text-xs font-medium uppercase tracking-wide text-slate-400">
                    {entry.role}
                  </Text>
                  <Text className="block text-slate-700 dark:text-slate-200">
                    {entry.text}
                  </Text>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            sendTextMessage();
          }}
        >
          <input
            type="text"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
            placeholder={
              isActive
                ? "Send a text prompt to the assistant"
                : "Connect to send a prompt"
            }
            disabled={!isActive}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-slate-500 dark:focus:ring-slate-600"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!isActive || !inputValue.trim()}
          >
            Send message
          </Button>
        </form>
      </div>

      <audio ref={audioRef} autoPlay className="hidden" />
    </div>
  );
}

export default RealtimeConversationPanel;
