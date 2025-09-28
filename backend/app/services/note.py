"""Services for note processing and annotation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import AsyncGenerator

import httpx


class NoteAnnotationError(RuntimeError):
    """Raised when the annotation service fails."""


@dataclass
class AnnotationResult:
    """Holds the annotation returned by the language model."""

    content: str


class NoteAnnotator:
    """Call the OpenAI API (GPT-5) to annotate user notes."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    def _build_payload(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
        transcript: str | None,
    ) -> dict[str, object]:
        """Create the payload used for both standard and streamed requests."""

        system_lines = [
            "You are an expert research assistant that organizes meeting notes.",
            "Provide a concise annotated summary, key action items, and follow-up questions.",
        ]
        if transcript:
            system_lines.append("Use the provided voice memo transcript to enrich the summary.")
        elif audio_url:
            system_lines.append(
                "An audio recording of the conversation is available at the following URL for additional context:"
            )
            system_lines.append(audio_url)

        user_sections = [f"Title: {title}", "", content]
        if transcript:
            user_sections.extend(
                ["", "Voice memo transcript:", transcript]
            )

        return {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "\n".join(system_lines)},
                {
                    "role": "user",
                    "content": "\n".join(user_sections),
                },
            ],
        }

    async def annotate(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
        transcript: str | None = None,
    ) -> AnnotationResult:
        """Request an annotation summary for the provided note."""

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(
            title=title,
            content=content,
            audio_url=audio_url,
            transcript=transcript,
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/chat/completions", json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors not deterministic
                raise NoteAnnotationError("Failed to contact the annotation service") from exc

        data = response.json()
        try:
            message = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise NoteAnnotationError("Unexpected response from annotation service") from exc

        return AnnotationResult(content=message)

    async def stream_annotation(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
        transcript: str | None,
    ) -> AsyncGenerator[str, None]:
        """Yield annotation deltas as the model streams them back."""

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = self._build_payload(
            title=title,
            content=content,
            audio_url=audio_url,
            transcript=transcript,
        )
        payload["stream"] = True

        async with httpx.AsyncClient(timeout=None) as client:
            try:
                async with client.stream(
                    "POST",
                    f"{self._base_url}/chat/completions",
                    headers=headers,
                    json=payload,
                ) as response:
                    response.raise_for_status()

                    async for line in response.aiter_lines():
                        if not line:
                            continue
                        chunk = line
                        if chunk.startswith("data:"):
                            chunk = chunk[5:].strip()
                        else:
                            chunk = chunk.strip()
                        if not chunk:
                            continue
                        if chunk == "[DONE]":
                            break

                        try:
                            data = json.loads(chunk)
                            delta = data["choices"][0]["delta"].get("content")
                        except (json.JSONDecodeError, KeyError, IndexError, TypeError) as exc:
                            raise NoteAnnotationError(
                                "Unexpected response from annotation service"
                            ) from exc

                        if delta:
                            yield delta
            except httpx.HTTPError as exc:  # pragma: no cover - network errors not deterministic
                raise NoteAnnotationError("Failed to contact the annotation service") from exc


__all__ = ["AnnotationResult", "NoteAnnotator", "NoteAnnotationError"]

