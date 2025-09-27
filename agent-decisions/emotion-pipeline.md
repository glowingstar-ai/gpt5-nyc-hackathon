# Multi-modal Emotion Analysis Design Decisions

## Emotion taxonomy selection

- **Chosen taxonomy:** Plutchik's primary emotions (joy, trust, fear, surprise, sadness, disgust, anger, anticipation) plus a neutral state.
- **Rationale:**
  - Plutchik's wheel is widely referenced across speech, facial expression, and textual affect research, which makes it easier to align heuristic signals from heterogeneous modalities.
  - The taxonomy balances granularity and interpretability—eight discrete emotions cover common affective states without overwhelming end users in a live dashboard.
  - Each emotion pair has an intuitive opposite (e.g., joy–sadness), which simplifies fusion logic because modal cues can be mapped using mirrored heuristics.
  - Existing datasets for speech prosody, sentiment lexicons, and facial action units often annotate according to Plutchik categories, so future upgrades to learned models can use the same schema.

## Backend architecture

- Introduced an `EmotionAnalyzer` service that orchestrates per-modality analyzers (`TextEmotionAnalyzer`, `VoiceEmotionAnalyzer`, and `VideoEmotionAnalyzer`).
- Created lightweight heuristics for each modality:
  - **Text:** keyword lexicon and simple sentiment markers to bias probabilities.
  - **Voice:** thresholds over energy, pitch, tempo, and jitter to approximate arousal/valence cues.
  - **Video:** normalized facial landmark features (smile ratio, eyebrow raise, eye openness, head movement).
- Implemented a fusion layer that re-weights available modalities (default 0.4 text / 0.3 voice / 0.3 video) and normalizes to a probability distribution.
- Added FastAPI endpoint `POST /api/v1/emotion/analyze` returning dominant emotion, confidence, aggregated probabilities, modality-specific breakdown, and the weights that participated.

## Frontend architecture

- Replaced the landing page with a live "emotion console" that:
  - Requests camera and microphone access and streams the media locally.
  - Extracts audio features (RMS energy, estimated pitch via autocorrelation, zero-crossing tempo, jitter) in real time using the Web Audio API.
  - Loads MediaPipe FaceMesh through `@tensorflow-models/face-landmarks-detection` to compute facial feature ratios for smile intensity, eyebrow raise, eye openness, and head movement.
  - Allows users to supply text transcripts via a textarea that is bundled with each inference window.
  - Sends aggregated features to the backend every three seconds and visualizes the fused probabilities and per-modality contributions.
- Included responsive UI cards so users can inspect raw signal metrics alongside the predicted taxonomy scores.

## Data flow summary

1. **Capture layer (frontend):** Acquire webcam/audio streams, compute normalized feature vectors, and collect optional text transcript.
2. **Transport:** Batch the latest features into a JSON payload and call the FastAPI endpoint on a rolling interval.
3. **Service layer (backend):** Each modality analyzer produces a probability distribution across the Plutchik emotions; missing modalities are ignored.
4. **Fusion:** Weighted averages yield the overall distribution. The dominant emotion and confidence are surfaced back to the client.
5. **Presentation:** The UI updates live charts for aggregated predictions and modality-specific contributions, allowing quick diagnosis of which signals drove the decision.

## Future enhancements

- Swap heuristic analyzers with learned models (e.g., fine-tuned transformers for text, spectral CNNs for audio) without changing the API contract.
- Introduce calibration routines so users can personalize baseline thresholds (e.g., average pitch) for more accurate detections.
- Persist session timelines to visualize emotion trends and support historical analytics.
