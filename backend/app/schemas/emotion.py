"""Pydantic schemas for emotion analysis endpoints."""

from __future__ import annotations

from typing import Any, Dict, Mapping

from pydantic import BaseModel, Field


class VoiceSignal(BaseModel):
    """Acoustic features extracted from a voice stream."""

    energy: float = Field(ge=0, description="Root-mean-square energy level of the audio segment.")
    pitch: float = Field(ge=0, description="Dominant fundamental frequency in Hertz.")
    tempo: float = Field(
        ge=0,
        description="Approximate syllable rate (words per second derived from zero-crossing heuristics).",
    )
    jitter: float = Field(
        ge=0,
        description="Short-term pitch stability estimate (0-1, higher means less stable).",
    )
    confidence: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Optional indicator of how reliable the acoustic features are.",
    )


class VideoSignal(BaseModel):
    """Lightweight facial expression features extracted on-device."""

    smile: float = Field(ge=0, le=1, description="Normalized smile intensity.")
    brow_raise: float = Field(ge=0, le=1, description="Degree of eyebrow elevation.")
    eye_openness: float = Field(ge=0, le=1, description="Average openness of both eyes.")
    head_movement: float = Field(ge=0, le=1, description="Magnitude of recent head movement.")
    engagement: float | None = Field(
        default=None,
        ge=0,
        le=1,
        description="Optional heuristic describing how attentive the participant is.",
    )


class EmotionAnalysisRequest(BaseModel):
    """Payload combining text, voice, and video observations."""

    text: str | None = Field(default=None, description="Text transcript for the analyzed window.")
    voice: VoiceSignal | None = Field(default=None, description="Aggregated acoustic measurements.")
    video: VideoSignal | None = Field(default=None, description="Facial expression measurements.")
    metadata: Dict[str, Any] | None = Field(default=None, description="Arbitrary client metadata.")


class ModalityBreakdown(BaseModel):
    """Probability distributions per modality."""

    text: Mapping[str, float] | None = None
    voice: Mapping[str, float] | None = None
    video: Mapping[str, float] | None = None


class EmotionAnalysisResponse(BaseModel):
    """Unified emotion estimate returned to clients."""

    taxonomy: str
    dominant_emotion: str
    confidence: float = Field(ge=0, le=1)
    aggregated: Mapping[str, float]
    modality_breakdown: ModalityBreakdown
    modality_weights: Mapping[str, float]

