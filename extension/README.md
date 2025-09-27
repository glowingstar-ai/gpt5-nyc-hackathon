# GPT5 Live Companion browser extension

This directory contains a Chrome-compatible browser extension that injects a
floating "hover" icon on any page. When the user opens the widget they can start
an end-to-end realtime conversation with the GPT5 hackathon assistant powered by
WebRTC. The extension reuses the same `/api/v1/realtime/session` endpoint exposed
by the FastAPI backend to mint ephemeral credentials.

## Features

- Floating launcher button that stays pinned to the bottom-right corner of the
  page without requiring any bundled image assets (an emoji icon is rendered
  directly in the DOM).
- Glassmorphism-styled panel with status updates, transcript rendering, and a
  text input that can be used alongside microphone audio.
- Full WebRTC handshake directly inside the content script, mirroring the logic
  in the Next.js dashboard so the assistant can stream audio responses and text
  transcripts in real time.
- Optional API base override via `chrome.storage.sync` so the extension can be
  pointed at staging or production deployments without recompilation.

## Loading the extension locally

1. Build and run the FastAPI backend so the `/api/v1/realtime/session` endpoint
   is reachable.
2. Visit `chrome://extensions`, enable **Developer mode**, and choose
   **Load unpacked**.
3. Select the `extension` directory at the root of this repository.
4. Open any webpage; the GPT5 hover icon should appear in the bottom-right.
5. Click the icon to open the panel and press **Start conversation** to connect
   with the assistant.

If your backend is running somewhere other than `http://localhost:8000`, update
the `apiBase` key via `chrome.storage.sync` (for example through the extension
debugger console) and reload the pages you want to augment.
