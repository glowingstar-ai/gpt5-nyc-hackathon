"""Schemas for the note taking workflow."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class NoteCreateRequest(BaseModel):
    """Payload for creating a note with optional audio recording."""

    title: str = Field(..., description="Short title for the note")
    content: str = Field(..., description="Free-form note contents")
    audio_base64: Optional[str] = Field(
        default=None, description="Base64 encoded audio blob in webm or wav format"
    )
    audio_mime_type: Optional[str] = Field(
        default=None, description="MIME type of the provided audio clip"
    )


class NoteCreateResponse(BaseModel):
    """Response returned after storing the note and annotation."""

    note_id: str
    title: str
    content: str
    audio_url: Optional[str]
    annotation: str
    created_at: datetime

