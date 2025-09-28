"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PageBanner } from "@/components/page-banner";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

type NoteResponse = {
  note_id: string;
  title: string;
  content: string;
  audio_url?: string | null;
  annotation: string;
  created_at: string;
};

type RecordingState = "idle" | "recording" | "processing";

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
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [audioBase64, setAudioBase64] = useState<string | null>(null);
  const [audioMimeType, setAudioMimeType] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  const isReadyToSubmit = useMemo(() => {
    return title.trim().length > 0 && content.trim().length > 0 && !isSubmitting;
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
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
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
      setError("Unable to access the microphone. Please grant permission and try again.");
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

        const response = await fetch(`${API_BASE}/notes`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const message = await response.text();
          throw new Error(message || "Failed to save note");
        }

        const data: NoteResponse = await response.json();
        setAnnotation(data.annotation);
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
      <PageBanner title="AI Notes Workspace" currentPage="Notes" />

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
          <h2 className="text-lg font-semibold">Capture your thoughts</h2>
          <p className="mt-1 text-sm text-slate-400">
            Draft notes, add a supporting voice memo, and let GPT-5 organize the takeaways for you.
          </p>

          <form className="mt-6 space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-200" htmlFor="title">
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
              <label className="text-sm font-medium text-slate-200" htmlFor="content">
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
                  <h3 className="text-sm font-medium text-slate-200">Voice memo</h3>
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
                  <p className="text-amber-400">Recording in progress... speak freely!</p>
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
                      Audio will be stored securely in your configured AWS S3 bucket.
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {error && <span className="text-rose-400">{error}</span>}
                {!error && annotation && <span className="text-emerald-400">Annotation ready!</span>}
              </div>
              <Button type="submit" disabled={!isReadyToSubmit}>
                {isSubmitting ? "Generating annotation…" : "Save note & annotate"}
              </Button>
            </div>
          </form>
        </section>

        {annotation && (
          <section className="rounded-lg border border-slate-800 bg-slate-900/60 p-6 shadow-lg">
            <h2 className="text-lg font-semibold">GPT-5 annotation</h2>
            <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-200">
              {annotation}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

