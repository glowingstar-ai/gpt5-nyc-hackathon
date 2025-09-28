"""Pydantic models for the generative UI endpoints."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class ThemeTokens(BaseModel):
    """Serializable representation of theme colors."""

    primary_color: str | None = Field(
        default=None, description="Primary brand color in CSS-compatible format"
    )
    background_color: str | None = Field(
        default=None, description="Background surface color"
    )
    accent_color: str | None = Field(
        default=None, description="Accent or highlight color"
    )
    text_color: str | None = Field(
        default=None, description="Default text color"
    )


class GenerativeUIMessage(BaseModel):
    """Single chat message exchanged with the assistant."""

    role: Literal["user", "assistant", "system"]
    content: str


class GenerativeUIRequest(BaseModel):
    """Inbound request containing conversation state."""

    messages: list[GenerativeUIMessage] = Field(
        default_factory=list, description="Conversation history in display order"
    )
    current_theme: ThemeTokens | None = Field(
        default=None,
        description="Current theme tokens so the model can build on existing styles",
    )


class GenerativeUIResponse(BaseModel):
    """Assistant reply with optional theme updates."""

    message: str = Field(description="Human-readable assistant reply")
    suggested_theme: ThemeTokens | None = Field(
        default=None,
        description="Updated theme tokens suggested by GPT-5",
    )


__all__ = [
    "GenerativeUIMessage",
    "GenerativeUIRequest",
    "GenerativeUIResponse",
    "ThemeTokens",
]
