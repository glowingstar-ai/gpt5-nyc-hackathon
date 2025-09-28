"""Pydantic models for realtime session management and vision frames."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class HighlightInstruction(BaseModel):
    """Instruction for the client to highlight a DOM element."""

    selector: str = Field(description="CSS selector targeting the DOM node")
    action: Literal["highlight"] = Field(
        default="highlight", description="Type of UI affordance to perform"
    )
    reason: str | None = Field(
        default=None, description="Why the element should be highlighted"
    )


class RealtimeSessionToken(BaseModel):
    """Response payload returned to clients requesting a realtime session."""

    session_id: str | None = Field(default=None, description="Identifier returned by OpenAI")
    client_secret: str = Field(description="Ephemeral client secret for WebRTC handshakes")
    expires_at: datetime = Field(description="Expiry timestamp for the client secret")
    model: str = Field(description="Realtime model configured for the session")
    url: str = Field(description="Endpoint used to exchange SDP offers with OpenAI")
    voice: str | None = Field(default=None, description="Voice configured for audio output")
    latest_frame_base64: str | None = Field(
        default=None,
        description="Most recent raw frame captured from the client, encoded as base64 JPEG",
    )
    dom_summary: str | None = Field(
        default=None,
        description="High level summary of the most recent DOM snapshot analyzed by the assistant",
    )
    dom_snapshot: str | None = Field(
        default=None,
        description="Raw DOM digest provided by the client for the latest vision frame",
    )
    highlight_instructions: list[HighlightInstruction] | None = Field(
        default=None,
        description="Structured highlight suggestions derived from the analyzed context",
    )


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
    dom_snapshot: str | None = Field(
        default=None,
        description="Serialized DOM digest captured alongside the frame (JSON string)",
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
    description: str | None = Field(
        default=None, description="Structured description extracted from the frame"
    )
    dom_summary: str | None = Field(
        default=None,
        description="Summary of the DOM provided with the frame, if available",
    )
    highlight_instructions: list[HighlightInstruction] | None = Field(
        default=None,
        description="Highlight suggestions generated from the latest analysis",
    )

