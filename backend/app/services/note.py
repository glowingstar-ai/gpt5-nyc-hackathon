"""Services for note processing and annotation."""

from __future__ import annotations

from dataclasses import dataclass

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

    async def annotate(
        self,
        *,
        title: str,
        content: str,
        audio_url: str | None,
    ) -> AnnotationResult:
        """Request an annotation summary for the provided note."""

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        system_lines = [
            "You are an expert research assistant that organizes meeting notes.",
            "Provide a concise annotated summary, key action items, and follow-up questions.",
        ]
        if audio_url:
            system_lines.append(
                "An audio recording of the conversation is available at the following URL for additional context:"
            )
            system_lines.append(audio_url)

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": "\n".join(system_lines)},
                {
                    "role": "user",
                    "content": f"Title: {title}\n\n{content}",
                },
            ],
        }

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


__all__ = ["AnnotationResult", "NoteAnnotator", "NoteAnnotationError"]

