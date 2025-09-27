"""Pydantic models for the journaling experience."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class JournalEntryRequest(BaseModel):
    """Payload submitted from the journaling client."""

    title: str = Field(..., min_length=1, max_length=120)
    entry: str = Field(..., min_length=1, max_length=6000)
    mood: str | None = Field(default=None, max_length=48)
    gratitude: str | None = Field(default=None, max_length=240)
    intention: str | None = Field(default=None, max_length=240)
    focus_area: str | None = Field(default=None, max_length=120)


class JournalEntryResponse(BaseModel):
    """Structured response returned after the AI reflection."""

    journal_id: str
    created_at: datetime
    title: str
    entry: str
    mood: str | None
    gratitude: str | None
    intention: str | None
    focus_area: str | None
    ai_reflection: str
    affirmation: str
    suggested_prompts: list[str]
    breathing_exercise: str


__all__ = [
    "JournalEntryRequest",
    "JournalEntryResponse",
]

