"""Integration helpers for the OpenAI Realtime API via the Agent SDK."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from openai import AsyncOpenAI
from openai._types import NOT_GIVEN


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
        self._client = AsyncOpenAI(
            api_key=self.api_key,
            base_url=self.base_url,
            timeout=timeout,
        )

    async def create_ephemeral_session(
        self, *, instructions: str | None = None
    ) -> RealtimeSession:
        """Request a short-lived client token for the Realtime API."""

        payload: dict[str, Any] = {"model": self.model}
        payload["voice"] = self.voice if self.voice else NOT_GIVEN
        instructions_override = (
            instructions if instructions is not None else self.instructions
        )
        payload["instructions"] = (
            instructions_override if instructions_override is not None else NOT_GIVEN
        )

        try:
            sdk_session = await self._client.realtime.sessions.create(**payload)
        except Exception as exc:  # pragma: no cover - network/SDK failure handled upstream
            raise RealtimeSessionError(
                "Failed to create realtime session via Agent SDK"
            ) from exc

        data: dict[str, Any]
        if hasattr(sdk_session, "model_dump"):
            data = sdk_session.model_dump()
        elif hasattr(sdk_session, "dict"):
            data = sdk_session.dict()  # type: ignore[assignment]
        else:
            data = dict(sdk_session)  # type: ignore[arg-type]

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

