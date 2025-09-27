"""Pydantic models for the Tutor Mode feature."""

from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class TutorModeRequest(BaseModel):
    """Incoming payload describing the tutoring objective."""

    topic: str = Field(..., description="Subject or concept the learner wants to explore")
    student_level: str | None = Field(
        default=None,
        description="Quick description of the learner's current understanding",
    )
    goals: list[str] | None = Field(
        default=None,
        description="Learning goals or outcomes the learner cares about",
    )
    preferred_modalities: list[str] | None = Field(
        default=None,
        description="Modalities that resonate with the learner (e.g. visuals, demos)",
    )
    additional_context: str | None = Field(
        default=None,
        description="Any extra context that can help the tutor personalize the plan",
    )


class TutorUnderstandingPlan(BaseModel):
    """Step 0 – capture how the tutor will gauge the learner's level."""

    approach: str
    diagnostic_questions: list[str]
    signals_to_watch: list[str]


class TutorConceptBreakdown(BaseModel):
    """Step 1 – structured concepts and reasoning."""

    concept: str
    llm_reasoning: str
    subtopics: list[str]
    real_world_connections: list[str]


class TutorTeachingModality(BaseModel):
    """Step 2 – multi-modal explanation strategy."""

    modality: Literal["visual", "verbal", "interactive", "experiential", "reading", "other"]
    description: str
    resources: list[str]


class TutorAssessmentItem(BaseModel):
    """Single assessment artifact for Step 3."""

    prompt: str
    kind: Literal["multiple_choice", "short_answer", "reflection", "practical"]
    options: list[str] | None = None
    answer_key: str | None = None


class TutorAssessmentPlan(BaseModel):
    """Step 3 – checks for understanding with human-in-the-loop guidance."""

    title: str
    format: str
    human_in_the_loop_notes: str
    items: list[TutorAssessmentItem]


class TutorCompletionPlan(BaseModel):
    """Step 4 – how the agent knows instruction is complete."""

    mastery_indicators: list[str]
    wrap_up_plan: str
    follow_up_suggestions: list[str]


class TutorModeResponse(BaseModel):
    """Comprehensive tutor mode plan returned to clients."""

    model: str = Field(description="Model powering the plan")
    generated_at: datetime
    topic: str
    learner_profile: str
    objectives: list[str]
    understanding: TutorUnderstandingPlan
    concept_breakdown: list[TutorConceptBreakdown]
    teaching_modalities: list[TutorTeachingModality]
    assessment: TutorAssessmentPlan
    completion: TutorCompletionPlan
