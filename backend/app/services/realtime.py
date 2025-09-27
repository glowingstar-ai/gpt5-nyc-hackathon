"""Integration helpers for the OpenAI Realtime API."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx


class RealtimeSessionError(RuntimeError):
    """Raised when the OpenAI Realtime API returns an unexpected response."""


@dataclass(slots=True)
class RealtimeSession:
    """Structured response containing session metadata for clients."""

    session_id: str | None
    client_secret: str
    expires_at: datetime
    model: str
    voice: str | None
    base_url: str

    @property
    def handshake_url(self) -> str:
        """Return the URL used to exchange SDP offers/answers."""

        return f"{self.base_url.rstrip('/')}/realtime?model={self.model}"


class RealtimeSessionClient:
    """Thin wrapper around the OpenAI Realtime session creation endpoint."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        voice: str | None = None,
        instructions: str | None = None,
        timeout: float = 10.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.voice = voice
        self.instructions = instructions
        self.timeout = timeout

    async def create_ephemeral_session(self) -> RealtimeSession:
        """Request a short-lived client token for the Realtime API."""

        payload: dict[str, Any] = {"model": self.model}
        if self.voice:
            payload["voice"] = self.voice
        if self.instructions:
            payload["instructions"] = self.instructions

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "OpenAI-Beta": "realtime=v1",
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/realtime/sessions", headers=headers, json=payload
            )

        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as exc:  # pragma: no cover - re-raise with context
            raise RealtimeSessionError("Failed to create realtime session") from exc

        data = response.json()
        client_secret = data.get("client_secret", {}).get("value")
        if not client_secret:
            raise RealtimeSessionError("Realtime session response missing client secret")

        expires_at_raw: Any = data.get("client_secret", {}).get("expires_at") or data.get(
            "expires_at"
        )
        expires_at = self._parse_timestamp(expires_at_raw)

        return RealtimeSession(
            session_id=data.get("id"),
            client_secret=client_secret,
            expires_at=expires_at,
            model=self.model,
            voice=self.voice,
            base_url=self.base_url,
        )

    @staticmethod
    def _parse_timestamp(raw: Any) -> datetime:
        """Convert a timestamp-like value into a timezone-aware datetime."""

        if isinstance(raw, (int, float)):
            return datetime.fromtimestamp(float(raw), tz=timezone.utc)
        if isinstance(raw, str):
            try:
                return datetime.fromisoformat(raw)
            except ValueError as exc:  # pragma: no cover - defensive branch
                raise RealtimeSessionError("Invalid expiry timestamp from realtime API") from exc

        # Fallback to a very short-lived window so the client refreshes quickly.
        return datetime.now(timezone.utc) + timedelta(minutes=1)

