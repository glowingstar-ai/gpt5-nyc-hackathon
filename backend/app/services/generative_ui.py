"""Generative UI service powered by GPT-5."""

from __future__ import annotations

from dataclasses import dataclass
import json
from typing import Iterable

import httpx


class GenerativeUIServiceError(RuntimeError):
    """Raised when the generative UI service cannot produce a response."""


@dataclass
class ThemeSuggestion:
    """Structured theme suggestion returned by the model."""

    primary_color: str | None = None
    background_color: str | None = None
    accent_color: str | None = None
    text_color: str | None = None


@dataclass
class GenerativeUIResult:
    """Assistant reply bundled with optional theme tokens."""

    message: str
    theme: ThemeSuggestion | None


class GenerativeUIService:
    """Facade over the OpenAI chat completions endpoint for UI generation."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def generate(
        self,
        *,
        messages: Iterable[dict[str, str]],
        current_theme: ThemeSuggestion | None = None,
    ) -> GenerativeUIResult:
        """Send the conversational state to GPT-5 and parse its structured reply."""

        if not self._api_key:
            raise GenerativeUIServiceError("OpenAI API key is not configured")

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        system_prompt = """
You are Glowingstar's generative design co-pilot. Help the user iterate on live UI themes.
Respond with concise coaching language and include updated color tokens when appropriate.
Provide JSON with keys `assistant_message` and optional `theme` describing CSS-friendly hex values.
""".strip()

        history = list(messages)
        payload_messages: list[dict[str, str]] = [
            {"role": "system", "content": system_prompt}
        ] + history

        theme_context = None
        if current_theme:
            theme_context = {
                "primary_color": current_theme.primary_color,
                "background_color": current_theme.background_color,
                "accent_color": current_theme.accent_color,
                "text_color": current_theme.text_color,
            }

        if theme_context:
            payload_messages.append(
                {
                    "role": "system",
                    "content": "Current theme tokens: "
                    + json.dumps(theme_context, separators=(",", ":")),
                }
            )

        payload = {
            "model": self._model,
            "messages": payload_messages,
            "response_format": {"type": "json_object"},
            "temperature": 0.4,
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/chat/completions", json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network dependent
                raise GenerativeUIServiceError("Failed to contact the generative UI model") from exc

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise GenerativeUIServiceError("Unexpected response from generative UI model") from exc

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise GenerativeUIServiceError("Model response was not valid JSON") from exc

        assistant_message = str(parsed.get("assistant_message") or parsed.get("message") or "").strip()
        if not assistant_message:
            raise GenerativeUIServiceError("Model response did not include assistant_message")

        theme_data = parsed.get("theme")
        theme: ThemeSuggestion | None = None
        if isinstance(theme_data, dict):
            theme = ThemeSuggestion(
                primary_color=theme_data.get("primary_color"),
                background_color=theme_data.get("background_color"),
                accent_color=theme_data.get("accent_color"),
                text_color=theme_data.get("text_color"),
            )

        return GenerativeUIResult(message=assistant_message, theme=theme)


__all__ = [
    "GenerativeUIService",
    "GenerativeUIServiceError",
    "GenerativeUIResult",
    "ThemeSuggestion",
]
