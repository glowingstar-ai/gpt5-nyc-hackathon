# MediaPipe Face Landmarker Migration

## Context
- The frontend previously imported `@tensorflow-models/face-landmarks-detection`, which in turn requires `@tensorflow/tfjs-core`. The dependency chain caused the build failure shown in the provided screenshot because the TensorFlow JS core package was not installed during the Next.js compilation.
- The user requested a solution that does not rely on TensorFlow-based models and asked for a better alternative model after researching options.

## Decision
- Switched the facial landmark detection stack to the MediaPipe Tasks Face Landmarker (`@mediapipe/tasks-vision`). The task API wraps the same high-quality face mesh model but ships as a pure WebAssembly bundle, removing the TensorFlow runtime dependency entirely.
- Pinned the WASM bundle (`@mediapipe/tasks-vision@0.10.4`) and referenced the official hosted `.task` model from Google Storage to ensure deterministic loading in production builds.
- Reworked the video-processing loop to consume normalized landmarks from the new API and convert them into pixel coordinates before calculating smile, brow raise, and other custom metrics.

## Rationale
- MediaPipe Tasks is the recommended successor to the legacy TensorFlow.js integration, according to the Google AI/MediaPipe documentation, and it avoids the large TensorFlow payload. It is also optimized for real-time, on-device inference in browsers.
- By pinning explicit CDN URLs for the WASM runtime and model asset, the application can download the artifacts without bundling them, keeping the Next.js build lightweight.
- Updating the measurement logic to use normalized landmarks keeps the existing UI logic intact while ensuring numerical stability (e.g., treating the very first frame’s head movement as zero to avoid spikes).

## Follow-up
- The development container cannot currently download the npm package (`@mediapipe/tasks-vision`) because of a 403 from the npm registry. Once network access is restored, run `npm install` in `frontend/` to materialize the dependency in `node_modules` before building locally.
