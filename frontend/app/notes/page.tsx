"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import WorkspaceBanner from "@/components/workspace-banner";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type NoteResponse = {
  note_id: string;
  title: string;
  content: string;
  audio_url?: string | null;
  annotation: string;
  created_at: string;
};

type RecordingState = "idle" | "recording" | "processing";

type NoteStreamEvent =
  | { type: "status"; stage: string; message: string }
  | { type: "transcript"; stage: string; text: string }
  | { type: "annotation_delta"; stage: string; delta: string }
  | { type: "reasoning_delta"; stage: string; delta: string }
  | {
      type: "note_saved";
      stage: string;
      note: NoteResponse;
      transcript?: string | null;
    }
  | { type: "complete"; stage: string; message: string }
  | { type: "error"; stage: string; message: string };

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

export default function NotesPage(): JSX.Element {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [annotation, setAnnotation] = useState<string | null>(null);
  const [reasoning, setReasoning] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);
  const [statusMessages, setStatusMessages] = useState<string[]>([]);
  const [noteMetadata, setNoteMetadata] = useState<NoteResponse | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const isReadyToSubmit = useMemo(() => {
    return (
      title.trim().length > 0 && content.trim().length > 0 && !isSubmitting
    );
  }, [title, content, isSubmitting]);

  const startRecording = useCallback(async () => {
    if (recordingState === "recording") return;
    setError(null);

    try {
      if (audioPreviewUrl) {
        URL.revokeObjectURL(audioPreviewUrl);
        setAudioPreviewUrl(null);
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecordingState("processing");
        const blob = new Blob(chunksRef.current, {
          type: mediaRecorder.mimeType,
        });
        chunksRef.current = [];
        setAudioMimeType(mediaRecorder.mimeType);
        const base64 = await blobToBase64(blob);
        setAudioBase64(base64);
        const previewUrl = URL.createObjectURL(blob);
        setAudioPreviewUrl(previewUrl);
        setRecordingState("idle");
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setRecordingState("recording");
    } catch (err) {
      console.error(err);
      setError(
        "Unable to access the microphone. Please grant permission and try again."
      );
      setRecordingState("idle");
    }
  }, [audioPreviewUrl, recordingState]);

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== "recording") return;
    recorder.stop();
    recorder.stream.getTracks().forEach((track) => track.stop());
    mediaRecorderRef.current = null;
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!isReadyToSubmit) return;
      setIsSubmitting(true);
      setError(null);
      setAnnotation(null);
      setTranscript(null);
      setStatusMessages([]);
      setNoteMetadata(null);

      try {
        const payload: Record<string, unknown> = {
          title: title.trim(),
          content: content.trim(),
        };
        if (audioBase64) {
          payload["audio_base64"] = audioBase64;
        }
        if (audioMimeType) {
          payload["audio_mime_type"] = audioMimeType;
        }

        const response = await fetch(`${API_BASE}/notes/annotate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.body) {
          throw new Error(
            "Streaming is not supported by the backend response."
          );
        }

        if (!response.ok) {
          const message = await response.text().catch(() => null);
          throw new Error(
            message || `Failed to save note (${response.status})`
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let shouldAbort = false;

        setAnnotation("");
        setReasoning("");

        while (!shouldAbort) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex !== -1) {
            const chunk = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (chunk) {
              try {
                const event = JSON.parse(chunk) as NoteStreamEvent;
                if (event.type === "status") {
                  setStatusMessages((prev) => [...prev, event.message]);
                } else if (event.type === "transcript") {
                  setTranscript(event.text);
                } else if (event.type === "reasoning_delta") {
                  setReasoning((prev) => (prev ?? "") + event.delta);
                } else if (event.type === "annotation_delta") {
                  setAnnotation((prev) => (prev ?? "") + event.delta);
                } else if (event.type === "note_saved") {
                  setNoteMetadata(event.note);
                  if (event.transcript) {
                    setTranscript(event.transcript);
                  }
                  setAnnotation(event.note.annotation);
                  setStatusMessages((prev) => [...prev, "Annotation saved"]);
                } else if (event.type === "complete") {
                  setStatusMessages((prev) => [...prev, event.message]);
                } else if (event.type === "error") {
                  setError(event.message);
                  shouldAbort = true;
                  break;
                }
              } catch (parseError) {
                console.error(
                  "Failed to parse stream chunk",
                  parseError,
                  chunk
                );
              }
            }
            newlineIndex = buffer.indexOf("\n");
          }
        }

        if (!shouldAbort) {
          const trailing = buffer.trim();
          if (trailing) {
            try {
              const event = JSON.parse(trailing) as NoteStreamEvent;
              if (event.type === "note_saved") {
                setNoteMetadata(event.note);
                setAnnotation(event.note.annotation);
                if (event.transcript) {
                  setTranscript(event.transcript);
                }
                setStatusMessages((prev) => [...prev, "Annotation saved"]);
              } else if (event.type === "complete") {
                setStatusMessages((prev) => [...prev, event.message]);
              } else if (event.type === "error") {
                setError(event.message);
              }
            } catch (parseError) {
              console.error(
                "Failed to parse trailing stream chunk",
                parseError,
                trailing
              );
            }
          }
        } else {
          try {
            await reader.cancel();
          } catch (cancelError) {
            console.error("Failed to cancel reader after error", cancelError);
          }
        }
      } catch (err) {
        console.error(err);
        setError(
          err instanceof Error
            ? err.message
            : "An unexpected error occurred while saving the note."
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [audioBase64, audioMimeType, content, isReadyToSubmit, title]
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <WorkspaceBanner title="AI Notes Workspace" current="Notes" />

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-semibold">Capture your thoughts</h2>
          <p className="mt-1 text-sm text-slate-400">
            Draft your notes and let GPT-5 polish them into well-structured,
            professional content.
          </p>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="title"
              >
                Note title
              </label>
              <input
                id="title"
                name="title"
                type="text"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Product sync with design team"
              />
            </div>

            <div className="space-y-2">
              <label
                className="text-sm font-medium text-slate-200"
                htmlFor="content"
              >
                Notes
              </label>
              <textarea
                id="content"
                name="content"
                required
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={6}
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/50"
                placeholder="Capture decisions, blockers, and follow-ups..."
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-slate-200">
                    Voice memo
                  </h3>
                  <p className="text-xs text-slate-400">
                    Start a quick recording to give GPT-5 richer context.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={recordingState === "recording"}
                    onClick={startRecording}
                  >
                    Start recording
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={recordingState !== "recording"}
                    onClick={stopRecording}
                  >
                    Stop
                  </Button>
                </div>
              </div>

              <div className="rounded-md border border-dashed border-slate-700 bg-slate-950/50 p-4 text-sm">
                {recordingState === "recording" && (
                  <p className="text-amber-400">
                    Recording in progress... speak freely!
                  </p>
                )}
                {recordingState === "processing" && (
                  <p className="text-indigo-400">Processing audio…</p>
                )}
                {recordingState === "idle" && !audioPreviewUrl && (
                  <p className="text-slate-400">No audio attached yet.</p>
                )}
                {audioPreviewUrl && (
                  <div className="space-y-2">
                    <audio controls src={audioPreviewUrl} className="w-full" />
                    <p className="text-xs text-slate-500">
                      Audio will be stored securely in your configured AWS S3
                      bucket.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {error && <span className="text-rose-400">{error}</span>}
                {!error && statusMessages.length > 0 && (
                  <span className="text-indigo-300">
                    {statusMessages[statusMessages.length - 1]}
                  </span>
                )}
                {!error && !isSubmitting && noteMetadata && (
                  <span className="ml-3 text-emerald-400">Notes polished!</span>
                )}
              </div>
              <Button type="submit" disabled={!isReadyToSubmit}>
                {isSubmitting ? "Polishing notes…" : "Save & polish notes"}
              </Button>
            </div>
          </form>
        </section>

        {transcript && (
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-semibold">GPT-5 transcript</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">
              {transcript}
            </p>
          </section>
        )}

        {reasoning && (
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-semibold">GPT-5 Reasoning</h2>
            <div className="mt-3 rounded border border-slate-700 bg-slate-800/50 p-4">
              <p className="whitespace-pre-line text-sm leading-6 text-slate-300">
                {reasoning}
              </p>
            </div>
          </section>
        )}

        {noteMetadata && (
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-semibold">Polished Notes</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">
              {noteMetadata.content}
            </p>
            {noteMetadata.annotation && (
              <details className="mt-6">
                <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300">
                  View Original Notes
                </summary>
                <div className="mt-3 rounded border border-slate-700 bg-slate-800/50 p-4">
                  <p className="whitespace-pre-line text-sm leading-6 text-slate-300">
                    {noteMetadata.annotation}
                  </p>
                </div>
              </details>
            )}
            {noteMetadata.note_id && (
              <p className="mt-4 text-xs text-slate-500">
                Saved note ID:{" "}
                <span className="font-mono text-slate-300">
                  {noteMetadata.note_id}
                </span>
              </p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
