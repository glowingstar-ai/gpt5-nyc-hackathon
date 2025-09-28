"""Audio transcription helpers."""

from __future__ import annotations

from dataclasses import dataclass

import httpx


class AudioTranscriptionError(RuntimeError):
    """Raised when the transcription service fails."""


@dataclass
class TranscriptionResult:
    """Return payload for an audio transcription request."""

    text: str


class AudioTranscriber:
    """Thin wrapper around the OpenAI transcription endpoint."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def transcribe(
        self,
        payload: bytes,
        content_type: str | None,
    ) -> TranscriptionResult:
        """Transcribe the provided audio bytes into text."""

        headers = {"Authorization": f"Bearer {self._api_key}"}
        form = {"model": (None, self._model)}

        mime = content_type or "audio/webm"
        files = {"file": ("recording.webm", payload, mime)}

        async with httpx.AsyncClient(timeout=60.0) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/audio/transcriptions",
                    headers=headers,
                    data=form,
                    files=files,
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors not deterministic
                raise AudioTranscriptionError("Failed to contact the transcription service") from exc

        data = response.json()
        try:
            text = data["text"].strip()
        except (KeyError, TypeError) as exc:
            raise AudioTranscriptionError("Unexpected response from transcription service") from exc

        return TranscriptionResult(text=text)


__all__ = ["AudioTranscriber", "AudioTranscriptionError", "TranscriptionResult"]

