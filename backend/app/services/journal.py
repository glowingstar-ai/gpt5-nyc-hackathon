"""Service for guiding reflective journaling sessions."""

from __future__ import annotations

from dataclasses import dataclass
import json

import httpx


class JournalCoachError(RuntimeError):
    """Raised when the journaling assistant cannot produce guidance."""


@dataclass
class JournalGuidance:
    """Container for the AI-guided journaling outputs."""

    reflection: str
    affirmation: str
    prompts: list[str]
    breathwork: str


class JournalCoach:
    """Call the OpenAI API (GPT-5) to synthesize journaling reflections."""

    def __init__(self, api_key: str, base_url: str, model: str) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model

    async def guide(
        self,
        *,
        title: str,
        entry: str,
        mood: str | None,
        gratitude: str | None,
        intention: str | None,
        focus_area: str | None,
    ) -> JournalGuidance:
        """Return a journaling reflection drawing from the submitted entry."""

        system_prompt = (
            "You are a compassionate journaling guide. Respond using warm, "
            "poetic language that remains grounded and actionable. Always respond as "
            "a JSON object with the keys reflection (string), affirmation (string), "
            "prompts (array of 3 short strings), and breathwork (string). Keep "
            "reflections between 3-4 paragraphs and provide prompts that nudge "
            "gentle next steps."
        )

        user_blocks = [
            f"Title: {title}",
            f"Mood: {mood or 'unspecified'}",
            f"Focus Area: {focus_area or 'unspecified'}",
            f"Intention: {intention or 'unspecified'}",
            f"Gratitude: {gratitude or 'unspecified'}",
            "Entry:",
            entry,
        ]

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": "\n".join(user_blocks)},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.8,
        }

        async with httpx.AsyncClient(timeout=40.0) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/chat/completions", json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors are non-deterministic
                raise JournalCoachError("Failed to contact the journaling service") from exc

        data = response.json()
        try:
            content = data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise JournalCoachError("Unexpected response from journaling service") from exc

        try:
            parsed = json.loads(content)
        except json.JSONDecodeError as exc:
            raise JournalCoachError("Journaling service returned invalid JSON") from exc

        reflection = parsed.get("reflection")
        affirmation = parsed.get("affirmation")
        prompts = parsed.get("prompts")
        breathwork = parsed.get("breathwork")

        if not isinstance(reflection, str) or not reflection.strip():
            raise JournalCoachError("Journaling service did not return a reflection")
        if not isinstance(affirmation, str) or not affirmation.strip():
            raise JournalCoachError("Journaling service did not return an affirmation")
        if not isinstance(prompts, list) or not all(isinstance(item, str) for item in prompts):
            raise JournalCoachError("Journaling service did not return valid prompts")
        if not isinstance(breathwork, str) or not breathwork.strip():
            raise JournalCoachError("Journaling service did not return breathwork guidance")

        return JournalGuidance(
            reflection=reflection.strip(),
            affirmation=affirmation.strip(),
            prompts=[item.strip() for item in prompts if item.strip()],
            breathwork=breathwork.strip(),
        )


__all__ = ["JournalCoach", "JournalCoachError", "JournalGuidance"]

