# Realtime assistant integration decisions

## Overview

The new realtime conversation feature enables the frontend to establish a WebRTC
session directly with OpenAI's Realtime API while keeping sensitive API keys on
the backend. It also streams periodic video frames to the backend so the server
has awareness of the user's environment.

## Backend

- Added a `RealtimeSessionClient` that wraps the `/realtime/sessions` endpoint
  and returns a simplified `RealtimeSession` object containing the ephemeral
  client secret and metadata required for the WebRTC handshake.
- Introduced new configuration settings for the OpenAI API key, base URL, model,
  voice, and optional instructions. The realtime route returns HTTP 503 when the
  key is absent to make configuration issues obvious.
- Exposed two new API routes:
  - `POST /api/v1/realtime/session` to mint ephemeral tokens for the client.
  - `POST /api/v1/vision/frame` to accept JPEG frames encoded as base64 and
    acknowledge receipt (decoded size, timestamps) without persisting the data.
- Added tests covering both new endpoints, including dependency overrides for
  deterministic realtime responses and validation of error handling for invalid
  image payloads.

## Frontend

- Created `RealtimeConversationPanel` to manage the WebRTC connection lifecycle,
  including microphone capture, SDP exchange, remote audio playback, and
  handling of realtime server events streamed over a data channel.
- Added transcript rendering so partial and completed assistant responses are
  surfaced visually, along with the ability to send text prompts alongside
  spoken input.
- Integrated the panel into the dashboard's right column and introduced a new
  `captureAndSendFrame` loop that snaps a JPEG from the existing `<video>` feed
  every two seconds while a capture session is active.
- The frame uploader reuses the existing media stream, uses a shared offscreen
  canvas to minimize allocations, and gracefully ignores transient failures.

## Trade-offs

- Frames are acknowledged but not stored server-side. Persisting them or
  forwarding to storage would require additional security considerations and was
  deferred for now.
- Transcript parsing handles the key realtime events emitted today. Additional
  event types may require refinement if OpenAI changes payload shapes.

