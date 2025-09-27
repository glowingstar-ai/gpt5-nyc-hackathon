from __future__ import annotations

import base64
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.api.dependencies import get_realtime_client
from app.main import app
from app.services.realtime import RealtimeSession


def test_realtime_session_requires_configuration() -> None:
    """Requests should fail with 503 when no OpenAI credentials are configured."""

    with TestClient(app) as client:
        response = client.post("/api/v1/realtime/session")

    assert response.status_code == 503


def test_realtime_session_success() -> None:
    """Dependency override returns a deterministic realtime session payload."""

    expires = datetime.now(timezone.utc) + timedelta(minutes=5)
    session = RealtimeSession(
        session_id="sess_test",
        client_secret="secret_123",
        expires_at=expires,
        model="gpt-realtime-test",
        voice="alloy",
        base_url="https://api.example.com/v1",
    )

    class FakeRealtimeClient:
        async def create_ephemeral_session(self) -> RealtimeSession:  # noqa: D401
            return session

    with TestClient(app) as client:
        app.dependency_overrides[get_realtime_client] = lambda: FakeRealtimeClient()
        response = client.post("/api/v1/realtime/session")
        app.dependency_overrides.pop(get_realtime_client, None)

    assert response.status_code == 200
    payload = response.json()
    assert payload["session_id"] == "sess_test"
    assert payload["client_secret"] == "secret_123"
    assert payload["model"] == "gpt-realtime-test"
    assert payload["voice"] == "alloy"
    assert payload["url"] == "https://api.example.com/v1/realtime?model=gpt-realtime-test"
    # Expires at should round-trip as ISO 8601 string
    assert datetime.fromisoformat(payload["expires_at"]) == expires


def test_vision_frame_endpoint_accepts_valid_image() -> None:
    """Base64-encoded payloads should be decoded and acknowledged."""

    encoded = base64.b64encode(b"fakejpeg").decode("ascii")
    captured_at = datetime.now(timezone.utc).isoformat()

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/vision/frame",
            json={"image_base64": encoded, "captured_at": captured_at},
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "accepted"
    assert payload["bytes"] == len(b"fakejpeg")
    returned = payload["captured_at"]
    assert isinstance(returned, str)
    assert datetime.fromisoformat(returned.replace("Z", "+00:00")) == datetime.fromisoformat(
        captured_at
    )
    assert "received_at" in payload


def test_vision_frame_endpoint_rejects_invalid_payload() -> None:
    """Invalid base64 payloads should return a 400 response."""

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/vision/frame",
            json={"image_base64": "not-base64!!!", "captured_at": None},
        )

    assert response.status_code == 400
