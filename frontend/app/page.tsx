"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Theme, Heading, Text } from "@radix-ui/themes";
import "@radix-ui/themes/styles.css";

import { Button } from "@/components/ui/button";
import RealtimeConversationPanel from "@/components/realtime-conversation";

type EmotionProbabilities = Record<string, number>;

type EmotionAnalysisResponse = {
  taxonomy: string;
  dominant_emotion: string;
  confidence: number;
  aggregated: EmotionProbabilities;
  modality_breakdown: {
    text?: EmotionProbabilities | null;
    voice?: EmotionProbabilities | null;
    video?: EmotionProbabilities | null;
  };
  modality_weights: Record<string, number>;
};

type VoiceSnapshot = {
  energy: number;
  pitch: number;
  tempo: number;
  jitter: number;
  confidence: number;
};

type VideoSnapshot = {
  smile: number;
  browRaise: number;
  eyeOpenness: number;
  headMovement: number;
  engagement: number;
};

type FaceLandmarkPoint = { x: number; y: number; z?: number };

type FaceLandmarkerResult = {
  faceLandmarks: Array<Array<FaceLandmarkPoint>>;
};

type FaceLandmarker = {
  detectForVideo: (
    video: HTMLVideoElement,
    timestampMs: number
  ) => FaceLandmarkerResult | undefined;
  close: () => void;
};

type VisionFileset = unknown;

type TasksVisionModule = {
  FaceLandmarker: {
    createFromOptions: (
      filesetResolver: VisionFileset,
      options: {
        baseOptions: { modelAssetPath: string };
        runningMode: "IMAGE" | "VIDEO";
        numFaces?: number;
      }
    ) => Promise<FaceLandmarker>;
  };
  FilesetResolver: {
    forVisionTasks: (wasmPath: string) => Promise<VisionFileset>;
  };
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

const EMOTION_ORDER = [
  "joy",
  "trust",
  "fear",
  "surprise",
  "sadness",
  "disgust",
  "anger",
  "anticipation",
  "neutral"
];

const EMOTION_COLORS: Record<string, string> = {
  joy: "bg-amber-400",
  trust: "bg-emerald-400",
  fear: "bg-cyan-500",
  surprise: "bg-indigo-400",
  sadness: "bg-blue-500",
  disgust: "bg-lime-500",
  anger: "bg-rose-500",
  anticipation: "bg-orange-400",
  neutral: "bg-slate-400"
};

const MEDIAPIPE_WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.4/wasm";
const MEDIAPIPE_FACE_MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

const clamp = (value: number, min = 0, max = 1) => Math.min(Math.max(value, min), max);

const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
  const SIZE = buffer.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);
  let bestOffset = -1;
  let bestCorrelation = 0;
  let rms = 0;
  for (let i = 0; i < SIZE; i += 1) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);
  if (rms < 0.01) return 0;

  let lastCorrelation = 1;
  for (let offset = 1; offset < MAX_SAMPLES; offset += 1) {
    let correlation = 0;
    for (let i = 0; i < MAX_SAMPLES; i += 1) {
      correlation += Math.abs(buffer[i] - buffer[i + offset]);
    }
    correlation = 1 - correlation / MAX_SAMPLES;
    if (correlation > 0.9 && correlation > lastCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
    } else if (correlation < lastCorrelation) {
      break;
    }
    lastCorrelation = correlation;
  }

  if (bestOffset === -1) {
    return 0;
  }

  return sampleRate / bestOffset;
};

const formatPercent = (value: number) => `${Math.round(value * 100)}%`;

const formatNumber = (value: number, decimals = 2) => value.toFixed(decimals);

export default function EmotionConsole(): JSX.Element {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioRafRef = useRef<number>();
  const videoRafRef = useRef<number>();
  const pollIntervalRef = useRef<number>();
  const photoIntervalRef = useRef<number>();
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameUploadInFlightRef = useRef(false);
  const detectorRef = useRef<FaceLandmarker | null>(null);
  const voiceFeaturesRef = useRef({
    energy: 0,
    pitch: 0,
    tempo: 0,
    jitter: 0,
    confidence: 0,
    lastPitch: 0,
    updatedAt: 0
  });
  const videoFeaturesRef = useRef({
    smile: 0,
    browRaise: 0,
    eyeOpenness: 0,
    headMovement: 0,
    engagement: 0,
    updatedAt: 0,
    lastNoseX: 0,
    lastNoseY: 0
  });
  const isRunningRef = useRef(false);
  const textRef = useRef("");
  const lastAudioSnapshotRef = useRef(0);
  const lastVideoSnapshotRef = useRef(0);

  const [isRunning, setIsRunning] = useState(false);
  const [status, setStatus] = useState<string>("Idle – start a capture session to analyze emotion signals.");
  const [error, setError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [voiceSnapshot, setVoiceSnapshot] = useState<VoiceSnapshot | null>(null);
  const [videoSnapshot, setVideoSnapshot] = useState<VideoSnapshot | null>(null);
  const [analysis, setAnalysis] = useState<EmotionAnalysisResponse | null>(null);

  useEffect(() => {
    textRef.current = textInput;
  }, [textInput]);

  useEffect(() => {
    isRunningRef.current = isRunning;
  }, [isRunning]);

  const cleanup = useCallback(async () => {
    window.clearInterval(pollIntervalRef.current);
    window.clearInterval(photoIntervalRef.current);
    cancelAnimationFrame(audioRafRef.current ?? 0);
    cancelAnimationFrame(videoRafRef.current ?? 0);
    pollIntervalRef.current = undefined;
    photoIntervalRef.current = undefined;
    audioRafRef.current = undefined;
    videoRafRef.current = undefined;
    captureCanvasRef.current = null;
    frameUploadInFlightRef.current = false;

    if (detectorRef.current) {
      try {
        detectorRef.current.close();
      } catch (err) {
        console.error("Failed to release face landmarker", err);
      }
      detectorRef.current = null;
    }

    const analyser = analyserRef.current;
    analyserRef.current = null;
    if (analyser) {
      analyser.disconnect();
    }

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext) {
      await audioContext.close();
    }

    const stream = mediaStreamRef.current;
    mediaStreamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());

    setVoiceSnapshot(null);
    setVideoSnapshot(null);
  }, []);

  useEffect(() => {
    return () => {
      cleanup().catch(() => undefined);
    };
  }, [cleanup]);

  const processAudio = useCallback(() => {
    const analyser = analyserRef.current;
    const audioContext = audioContextRef.current;
    if (!analyser || !audioContext || !isRunningRef.current) {
      return;
    }

    const bufferLength = analyser.fftSize;
    const timeDomain = new Float32Array(bufferLength);
    analyser.getFloatTimeDomainData(timeDomain);

    let sumSquares = 0;
    let zeroCrossings = 0;
    let previousSample = timeDomain[0];
    for (let i = 0; i < bufferLength; i += 1) {
      const sample = timeDomain[i];
      sumSquares += sample * sample;
      if ((sample >= 0 && previousSample < 0) || (sample < 0 && previousSample >= 0)) {
        zeroCrossings += 1;
      }
      previousSample = sample;
    }

    const energy = Math.sqrt(sumSquares / bufferLength);
    const pitch = autoCorrelate(timeDomain, audioContext.sampleRate);
    const durationSeconds = bufferLength / audioContext.sampleRate;
    const zeroCrossRate = zeroCrossings / Math.max(durationSeconds, 1e-6);
    const tempo = clamp(zeroCrossRate / 250, 0, 6);

    const lastPitch = voiceFeaturesRef.current.lastPitch;
    const jitter = pitch > 0 && lastPitch > 0 ? clamp(Math.abs(pitch - lastPitch) / Math.max(pitch, lastPitch), 0, 1) : 0;
    const confidence = clamp(energy * 3, 0, 1);

    voiceFeaturesRef.current = {
      energy,
      pitch,
      tempo,
      jitter,
      confidence,
      lastPitch: pitch || lastPitch,
      updatedAt: Date.now()
    };

    const now = performance.now();
    if (now - lastAudioSnapshotRef.current > 250) {
      lastAudioSnapshotRef.current = now;
      setVoiceSnapshot({ energy, pitch, tempo, jitter, confidence });
    }

    audioRafRef.current = requestAnimationFrame(processAudio);
  }, []);

  const processVideo = useCallback(async () => {
    if (!detectorRef.current || !isRunningRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      videoRafRef.current = requestAnimationFrame(() => {
        processVideo().catch(() => undefined);
      });
      return;
    }

    try {
      const detector = detectorRef.current;
      if (!detector) {
        return;
      }

      const result = detector.detectForVideo(video, performance.now());
      const landmarks = result?.faceLandmarks?.[0];

      if (landmarks && landmarks.length > 0) {
        const width = video.videoWidth || video.clientWidth || 0;
        const height = video.videoHeight || video.clientHeight || 0;

        const getPoint = (index: number) => {
          const point = landmarks[index];
          return {
            x: point.x * width,
            y: point.y * height
          };
        };

        const distance = (aIndex: number, bIndex: number) => {
          const a = getPoint(aIndex);
          const b = getPoint(bIndex);
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          return Math.sqrt(dx * dx + dy * dy);
        };

        const faceWidth = distance(33, 263);
        const mouthWidth = distance(61, 291);
        const smile = clamp((mouthWidth / Math.max(faceWidth, 1e-3) - 0.32) * 5);
        const eyeLeft = distance(159, 145);
        const eyeRight = distance(386, 374);
        const eyeOpenness = clamp(((eyeLeft + eyeRight) / 2 / Math.max(faceWidth, 1e-3) - 0.025) * 18);
        const browLeft = distance(70, 159);
        const browRight = distance(300, 386);
        const browRaise = clamp(((browLeft + browRight) / 2 / Math.max(faceWidth, 1e-3) - 0.05) * 12);

        const nose = getPoint(1);
        const lastNoseX = videoFeaturesRef.current.lastNoseX;
        const lastNoseY = videoFeaturesRef.current.lastNoseY;
        const movement =
          lastNoseX === 0 && lastNoseY === 0
            ? 0
            : Math.sqrt((nose.x - lastNoseX) ** 2 + (nose.y - lastNoseY) ** 2);
        const headMovement = clamp(movement * 60);

        const engagement = clamp((smile + browRaise + eyeOpenness + headMovement) / 4);

        videoFeaturesRef.current = {
          smile,
          browRaise,
          eyeOpenness,
          headMovement,
          engagement,
          updatedAt: Date.now(),
          lastNoseX: nose.x,
          lastNoseY: nose.y
        };

        const now = performance.now();
        if (now - lastVideoSnapshotRef.current > 250) {
          lastVideoSnapshotRef.current = now;
          setVideoSnapshot({ smile, browRaise, eyeOpenness, headMovement, engagement });
        }
      }
    } catch (err) {
      console.error("Video processing error", err);
    }

    videoRafRef.current = requestAnimationFrame(() => {
      processVideo().catch(() => undefined);
    });
  }, []);

  const initializeDetector = useCallback(async () => {
    if (detectorRef.current) {
      return detectorRef.current;
    }

    const [{ FaceLandmarker, FilesetResolver }] = await Promise.all([
      import("@mediapipe/tasks-vision") as Promise<TasksVisionModule>
    ]);

    const filesetResolver = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM_BASE);

    const detector = await FaceLandmarker.createFromOptions(filesetResolver, {
      baseOptions: {
        modelAssetPath: MEDIAPIPE_FACE_MODEL_URL
      },
      runningMode: "VIDEO",
      numFaces: 1
    });

    detectorRef.current = detector;
    return detector;
  }, []);

  const captureAndSendFrame = useCallback(async () => {
    if (!isRunningRef.current || frameUploadInFlightRef.current) {
      return;
    }

    const video = videoRef.current;
    if (!video || video.readyState < 2) {
      return;
    }

    const width = video.videoWidth || video.clientWidth;
    const height = video.videoHeight || video.clientHeight;
    if (!width || !height) {
      return;
    }

    const canvas = captureCanvasRef.current ?? document.createElement("canvas");
    if (!captureCanvasRef.current) {
      captureCanvasRef.current = canvas;
    }

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) {
      return;
    }

    context.drawImage(video, 0, 0, width, height);

    const dataUrl = canvas.toDataURL("image/jpeg", 0.75);
    const base64 = dataUrl.split(",")[1];
    if (!base64) {
      return;
    }

    frameUploadInFlightRef.current = true;
    try {
      await fetch(`${API_BASE}/vision/frame`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_base64: base64,
          captured_at: new Date().toISOString(),
        }),
      });
    } catch (err) {
      console.error("Failed to upload camera frame", err);
    } finally {
      frameUploadInFlightRef.current = false;
    }
  }, []);

  const sendAnalysis = useCallback(async () => {
    if (!isRunningRef.current) {
      return;
    }

    const now = Date.now();
    const voiceFeatures = voiceFeaturesRef.current;
    const videoFeatures = videoFeaturesRef.current;

    const payload: Record<string, unknown> = {
      text: textRef.current.trim() ? textRef.current.trim() : null,
      metadata: { window_ms: 3000, generated_at: new Date(now).toISOString() }
    };

    if (now - voiceFeatures.updatedAt < 1500) {
      payload.voice = {
        energy: voiceFeatures.energy,
        pitch: voiceFeatures.pitch,
        tempo: voiceFeatures.tempo,
        jitter: voiceFeatures.jitter,
        confidence: voiceFeatures.confidence
      };
    }

    if (now - videoFeatures.updatedAt < 1500) {
      payload.video = {
        smile: videoFeatures.smile,
        brow_raise: videoFeatures.browRaise,
        eye_openness: videoFeatures.eyeOpenness,
        head_movement: videoFeatures.headMovement,
        engagement: videoFeatures.engagement
      };
    }

    if (!payload.text && !payload.voice && !payload.video) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/emotion/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const data = (await response.json()) as EmotionAnalysisResponse;
      setAnalysis(data);
      setStatus(
        `Dominant emotion: ${capitalize(data.dominant_emotion)} (${formatPercent(data.confidence)})`
      );
      setError(null);
    } catch (err) {
      console.error("Emotion analysis request failed", err);
      setError("Unable to reach the backend emotion service.");
    }
  }, []);

  const startSession = useCallback(async () => {
    if (isRunningRef.current) {
      return;
    }

    try {
      setStatus("Requesting camera and microphone access…");
      setError(null);

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: { facingMode: "user" } });
      mediaStreamRef.current = stream;

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
      }

      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      voiceFeaturesRef.current = {
        energy: 0,
        pitch: 0,
        tempo: 0,
        jitter: 0,
        confidence: 0,
        lastPitch: 0,
        updatedAt: Date.now()
      };

      videoFeaturesRef.current = {
        smile: 0,
        browRaise: 0,
        eyeOpenness: 0,
        headMovement: 0,
        engagement: 0,
        updatedAt: Date.now(),
        lastNoseX: 0,
        lastNoseY: 0
      };

      await initializeDetector();

      setIsRunning(true);
      isRunningRef.current = true;
      setStatus("Collecting real-time signals…");
      processAudio();
      processVideo().catch(() => undefined);

      photoIntervalRef.current = window.setInterval(() => {
        captureAndSendFrame().catch(() => undefined);
      }, 2000);

      await captureAndSendFrame();
      pollIntervalRef.current = window.setInterval(() => {
        sendAnalysis().catch(() => undefined);
      }, 3000);

      await sendAnalysis();
    } catch (err) {
      console.error("Unable to start session", err);
      setStatus("Unable to access required devices. Please ensure permissions are granted.");
      setError("Camera or microphone access was denied.");
      await cleanup();
      setIsRunning(false);
    }
  }, [
    captureAndSendFrame,
    cleanup,
    initializeDetector,
    processAudio,
    processVideo,
    sendAnalysis,
  ]);

  const stopSession = useCallback(async () => {
    if (!isRunningRef.current) {
      return;
    }

    setIsRunning(false);
    isRunningRef.current = false;
    setStatus("Session paused. Start again to resume live analysis.");
    await cleanup();
  }, [cleanup]);

  const breakdownCards = useMemo(() => {
    if (!analysis) return null;

    const entries: Array<{ modality: string; scores: EmotionProbabilities | null | undefined }> = [
      { modality: "text", scores: analysis.modality_breakdown.text },
      { modality: "voice", scores: analysis.modality_breakdown.voice },
      { modality: "video", scores: analysis.modality_breakdown.video }
    ];

    return entries.map(({ modality, scores }) => (
      <div key={modality} className="space-y-3 rounded-xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex items-center justify-between">
          <Heading as="h3" size="4" className="capitalize">
            {modality}
          </Heading>
          <Text className="text-sm text-slate-500 dark:text-slate-400">
            weight {formatPercent(analysis.modality_weights[modality] ?? 0)}
          </Text>
        </div>
        {scores ? (
          <div className="space-y-2">
            {EMOTION_ORDER.map((emotion) => (
              <EmotionBar key={emotion} emotion={emotion} value={scores[emotion] ?? 0} />
            ))}
          </div>
        ) : (
          <Text className="text-sm text-slate-500 dark:text-slate-400">No signal captured during this window.</Text>
        )}
      </div>
    ));
  }, [analysis]);

  return (
    <Theme appearance="inherit">
      <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-10 px-6 py-12">
        <section className="space-y-4">
          <Heading as="h1" size="8" className="font-heading text-balance text-3xl md:text-4xl">
            Multi-modal emotion console
          </Heading>
          <Text as="p" size="4" className="max-w-3xl text-slate-600 dark:text-slate-300">
            Capture voice, text, and facial movement in real time to infer emotions using a Plutchik-based taxonomy.
            Start a session to stream local audio/video features to the FastAPI backend and watch the fused prediction
            update live.
          </Text>
          <div className="flex flex-wrap items-center gap-3">
            <Button onClick={startSession} disabled={isRunning}>
              {isRunning ? "Capturing…" : "Start live capture"}
            </Button>
            <Button variant="outline" onClick={stopSession} disabled={!isRunning}>
              Stop session
            </Button>
            <Text className="text-sm text-slate-500 dark:text-slate-400">{status}</Text>
          </div>
          {error ? <Text className="text-sm text-rose-500">{error}</Text> : null}
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <Heading as="h2" size="4" className="mb-3 font-heading">
                Live camera feed
              </Heading>
              <div className="relative overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} playsInline muted className="h-64 w-full rounded-xl object-cover" />
              </div>
              {videoSnapshot ? (
                <SignalList
                  title="Facial features"
                  signals={{
                    smile: videoSnapshot.smile,
                    "brow raise": videoSnapshot.browRaise,
                    "eye openness": videoSnapshot.eyeOpenness,
                    "head movement": videoSnapshot.headMovement,
                    engagement: videoSnapshot.engagement
                  }}
                />
              ) : (
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                  Enable the session to capture facial expression metrics.
                </Text>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <Heading as="h2" size="4" className="mb-3 font-heading">
                Text transcript
              </Heading>
              <textarea
                value={textInput}
                onChange={(event) => setTextInput(event.target.value)}
                className="min-h-[140px] w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 dark:border-slate-700 dark:bg-slate-950"
                placeholder="Type or paste text captured from your conversation…"
              />
              <Text className="mt-2 block text-xs text-slate-500 dark:text-slate-400">
                The full transcript is sent with each inference window to enrich the prediction.
              </Text>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <Heading as="h2" size="4" className="mb-3 font-heading">
                Voice metrics
              </Heading>
              {voiceSnapshot ? (
                <SignalList
                  title="Acoustic features"
                  signals={{
                    energy: voiceSnapshot.energy,
                    pitch: voiceSnapshot.pitch,
                    tempo: voiceSnapshot.tempo,
                    jitter: voiceSnapshot.jitter,
                    confidence: voiceSnapshot.confidence
                  }}
                  formatter={{
                    pitch: (value) => `${formatNumber(value, 0)} Hz`,
                    energy: (value) => formatNumber(value, 3),
                    tempo: (value) => `${formatNumber(value, 2)} wps`,
                    jitter: (value) => formatNumber(value, 2),
                    confidence: (value) => formatPercent(value)
                  }}
                />
              ) : (
                <Text className="text-sm text-slate-500 dark:text-slate-400">
                  Start capturing to compute RMS energy, pitch, tempo, and jitter.
                </Text>
              )}
          </div>

          {analysis ? (
            <div className="space-y-5 rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center justify-between">
                  <div>
                    <Heading as="h2" size="4" className="font-heading capitalize">
                      {analysis.dominant_emotion}
                    </Heading>
                    <Text className="text-sm text-slate-500 dark:text-slate-400">
                      Confidence {formatPercent(analysis.confidence)}
                    </Text>
                  </div>
                  <span className="rounded-full bg-slate-900/5 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:bg-slate-100/10 dark:text-slate-200">
                    Taxonomy · {analysis.taxonomy.replace("_", " ")}
                  </span>
                </div>

                <div className="space-y-2">
                  {EMOTION_ORDER.map((emotion) => (
                    <EmotionBar key={emotion} emotion={emotion} value={analysis.aggregated[emotion] ?? 0} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/20 dark:text-slate-400">
                Aggregated predictions will appear here once the backend returns the first inference window.
              </div>
            )}

            <RealtimeConversationPanel />
          </div>
        </section>

        {analysis ? <section className="grid gap-4 md:grid-cols-3">{breakdownCards}</section> : null}
      </main>
    </Theme>
  );
}

type SignalListProps = {
  title: string;
  signals: Record<string, number>;
  formatter?: Partial<Record<string, (value: number) => string>>;
};

function SignalList({ title, signals, formatter }: SignalListProps) {
  return (
    <div className="space-y-2">
      <Heading as="h3" size="3" className="font-heading text-slate-700 dark:text-slate-200">
        {title}
      </Heading>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-300">
        {Object.entries(signals).map(([key, value]) => (
          <div key={key} className="flex flex-col">
            <dt className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">{key}</dt>
            <dd className="font-medium">
              {formatter?.[key]?.(value) ?? formatNumber(value, 2)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

type EmotionBarProps = {
  emotion: string;
  value: number;
};

function EmotionBar({ emotion, value }: EmotionBarProps) {
  const percent = clamp(value);
  const colorClass = EMOTION_COLORS[emotion] ?? "bg-slate-400";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
        <span>{emotion}</span>
        <span>{formatPercent(percent)}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800">
        <div className={`${colorClass} h-2 rounded-full`} style={{ width: `${percent * 100}%` }} />
      </div>
    </div>
  );
}

const capitalize = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);
