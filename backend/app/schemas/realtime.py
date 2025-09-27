"""Pydantic models for realtime session management and vision frames."""

from __future__ import annotations

from datetime import datetime

from typing import Literal

from pydantic import BaseModel, Field


class RealtimeSessionToken(BaseModel):
    """Response payload returned to clients requesting a realtime session."""

    session_id: str | None = Field(default=None, description="Identifier returned by OpenAI")
    client_secret: str = Field(description="Ephemeral client secret for WebRTC handshakes")
    expires_at: datetime = Field(description="Expiry timestamp for the client secret")
    model: str = Field(description="Realtime model configured for the session")
    url: str = Field(description="Endpoint used to exchange SDP offers with OpenAI")
    voice: str | None = Field(default=None, description="Voice configured for audio output")


class VisionFrameRequest(BaseModel):
    """Incoming image frame captured from the frontend camera feed."""

    image_base64: str = Field(description="Base64-encoded JPEG frame without data URL prefix")
    captured_at: datetime | None = Field(
        default=None, description="Client timestamp when the frame was captured"
    )
    source: Literal["camera", "ui"] = Field(
        default="camera",
        description="Originating surface for the submitted frame (camera or UI screenshot)",
    )


class VisionFrameResponse(BaseModel):
    """Acknowledgement payload returned after receiving a frame."""

    status: str = Field(description="Processing status for the submitted frame")
    bytes: int = Field(description="Number of decoded image bytes received")
    captured_at: datetime | None = Field(
        default=None, description="Echo of the client-supplied capture timestamp"
    )
    received_at: datetime = Field(
        description="Server timestamp when the frame was processed"
    )
    source: Literal["camera", "ui"] = Field(
        description="Originating surface for the submitted frame (camera or UI screenshot)",
    )

