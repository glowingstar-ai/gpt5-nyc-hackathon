"""Tests for the note taking API workflow."""

from __future__ import annotations

import base64
from typing import Any, Dict, Tuple

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import get_audio_storage, get_note_annotator
from app.main import app
from app.services.note import AnnotationResult
from app.services.storage import AudioUploadResult


class DummyStorage:
    """In-memory stub that captures upload invocations."""

    def __init__(self) -> None:
        self.calls: list[Dict[str, Any]] = []

    def upload_audio(self, payload: bytes, content_type: str | None = None) -> AudioUploadResult:
        self.calls.append({"payload": payload, "content_type": content_type})
        return AudioUploadResult(url="https://example.com/audio.webm", key="audio-key")


class DummyAnnotator:
    """Stubbed annotator that records requests and returns static content."""

    def __init__(self) -> None:
        self.calls: list[Dict[str, Any]] = []

    async def annotate(self, *, title: str, content: str, audio_url: str | None) -> AnnotationResult:
        self.calls.append({"title": title, "content": content, "audio_url": audio_url})
        return AnnotationResult(content="Summary: capture action items")


@pytest.fixture()
def overrides() -> Tuple[DummyStorage, DummyAnnotator]:
    storage = DummyStorage()
    annotator = DummyAnnotator()
    app.dependency_overrides[get_audio_storage] = lambda: storage
    app.dependency_overrides[get_note_annotator] = lambda: annotator
    try:
        yield storage, annotator
    finally:
        app.dependency_overrides.pop(get_audio_storage, None)
        app.dependency_overrides.pop(get_note_annotator, None)


@pytest.fixture()
def client(overrides: Tuple[DummyStorage, DummyAnnotator]) -> TestClient:
    with TestClient(app) as test_client:
        yield test_client


def test_create_note_without_audio(client: TestClient, overrides: Tuple[DummyStorage, DummyAnnotator]) -> None:
    storage, annotator = overrides

    response = client.post(
        "/api/v1/notes",
        json={"title": "Daily sync", "content": "Talked through roadmap and blockers."},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["title"] == "Daily sync"
    assert payload["annotation"] == "Summary: capture action items"
    assert payload["audio_url"] is None

    assert storage.calls == []
    assert annotator.calls == [
        {"title": "Daily sync", "content": "Talked through roadmap and blockers.", "audio_url": None}
    ]


def test_create_note_with_audio(client: TestClient, overrides: Tuple[DummyStorage, DummyAnnotator]) -> None:
    storage, annotator = overrides
    audio_payload = b"audio-binary"
    audio_base64 = base64.b64encode(audio_payload).decode("utf-8")

    response = client.post(
        "/api/v1/notes",
        json={
            "title": "Design review",
            "content": "Captured feedback for the new onboarding flow.",
            "audio_base64": audio_base64,
            "audio_mime_type": "audio/webm",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["audio_url"] == "https://example.com/audio.webm"
    assert storage.calls == [
        {"payload": audio_payload, "content_type": "audio/webm"}
    ]
    assert annotator.calls == [
        {
            "title": "Design review",
            "content": "Captured feedback for the new onboarding flow.",
            "audio_url": "https://example.com/audio.webm",
        }
    ]


def test_create_note_rejects_invalid_audio(client: TestClient) -> None:
    response = client.post(
        "/api/v1/notes",
        json={
            "title": "Bug triage",
            "content": "Discussed open issues.",
            "audio_base64": "not-valid-base64",
        },
    )

    assert response.status_code == 400

