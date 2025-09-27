"""Tests for the journaling API."""

from __future__ import annotations

from typing import Any, Dict

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_journal_coach
from app.main import app
from app.services.journal import JournalCoachError, JournalGuidance


class DummyJournalCoach:
    """Capture invocations to the journaling service."""

    def __init__(self) -> None:
        self.calls: list[Dict[str, Any]] = []

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
        self.calls.append(
            {
                "title": title,
                "entry": entry,
                "mood": mood,
                "gratitude": gratitude,
                "intention": intention,
                "focus_area": focus_area,
            }
        )
        return JournalGuidance(
            reflection="Your heart sounds steadier after naming the tension.",
            affirmation="I can expand slowly and still be safe.",
            prompts=[
                "Where is my body asking for softness?",
                "Which boundary needs reinforcement?",
                "What support would feel nourishing tonight?",
            ],
            breathwork="Inhale for four counts, hold for four, exhale for six, repeat for five rounds.",
        )


class FailingJournalCoach(DummyJournalCoach):
    """Stub that raises an error to simulate service failures."""

    async def guide(self, **kwargs: Any) -> JournalGuidance:  # type: ignore[override]
        raise JournalCoachError("Journaling service unavailable")


@pytest.fixture()
def overrides() -> DummyJournalCoach:
    coach = DummyJournalCoach()
    app.dependency_overrides[get_journal_coach] = lambda: coach
    try:
        yield coach
    finally:
        app.dependency_overrides.pop(get_journal_coach, None)


@pytest.fixture()
def client(overrides: DummyJournalCoach) -> TestClient:  # noqa: PT004
    with TestClient(app) as test_client:
        yield test_client


def test_create_journal_entry_success(
    client: TestClient, overrides: DummyJournalCoach
) -> None:
    response = client.post(
        "/api/v1/journals",
        json={
            "title": "Evening reset",
            "entry": "Today felt heavy, but I made space for a walk at dusk.",
            "mood": "Tender",
            "gratitude": "The sky turning copper.",
            "intention": "Invite softness",
            "focus_area": "Emotional regulation",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Evening reset"
    assert payload["mood"] == "Tender"
    assert payload["ai_reflection"].startswith("Your heart sounds steadier")
    assert payload["affirmation"] == "I can expand slowly and still be safe."
    assert len(payload["suggested_prompts"]) == 3
    assert payload["breathing_exercise"].startswith("Inhale for four counts")

    assert overrides.calls == [
        {
            "title": "Evening reset",
            "entry": "Today felt heavy, but I made space for a walk at dusk.",
            "mood": "Tender",
            "gratitude": "The sky turning copper.",
            "intention": "Invite softness",
            "focus_area": "Emotional regulation",
        }
    ]


def test_create_journal_entry_handles_service_error() -> None:
    app.dependency_overrides[get_journal_coach] = lambda: FailingJournalCoach()
    try:
        with TestClient(app) as client:
            response = client.post(
                "/api/v1/journals",
                json={
                    "title": "Morning check-in",
                    "entry": "A wave of anxiety crept in after reading emails.",
                },
            )
    finally:
        app.dependency_overrides.pop(get_journal_coach, None)

    assert response.status_code == 502
    assert response.json()["detail"] == "Journaling service unavailable"

