"""Pydantic models for the multi-agent Tutor Mode feature."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

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


class TutorCurriculumSession(BaseModel):
    """Single learning block inside the curriculum agent's output."""

    id: str
    title: str
    focus: str
    duration: str
    objectives: list[str]
    learning_modality: Literal[
        "visual",
        "verbal",
        "interactive",
        "experiential",
        "reading",
        "blended",
    ]
    core_activities: list[str]
    practice_opportunity: str


class TutorCurriculumResponse(BaseModel):
    """Structured curriculum plan from the curriculum agent."""

    topic: str
    summary: str
    horizon: str
    sessions: list[TutorCurriculumSession]
    capstone_project: str
    enrichment: list[str]


class TutorAssessmentQuestion(BaseModel):
    """Assessment item created by the assessment agent."""

    id: str
    prompt: str
    kind: Literal["multiple_choice", "short_answer"]
    options: list[str] | None = None
    answer: str
    rationale: str


class TutorAssessmentResponse(BaseModel):
    """Quiz and answer key returned by the assessment agent."""

    title: str
    description: str
    duration: str
    grading_notes: list[str]
    questions: list[TutorAssessmentQuestion]


class TutorPracticeSprint(BaseModel):
    """Practice sprint recommendation from the practice agent."""

    name: str
    cadence: str
    focus: str
    checkpoints: list[str]


class TutorPracticeResponse(BaseModel):
    """Hands-on practice and project guidance."""

    topic: str
    warmups: list[str]
    sprints: list[TutorPracticeSprint]
    accountability: list[str]


class TutorCoachCheckpoint(BaseModel):
    """Moments where the coach agent checks learner understanding."""

    milestone: str
    prompt: str
    success_signal: str
    support_plan: str


class TutorCoachResponse(BaseModel):
    """Progress coaching plan for keeping the learner on track."""

    onboarding_message: str
    check_ins: list[TutorCoachCheckpoint]
    celebration_rituals: list[str]
    escalation_paths: list[str]


class TutorManagerProfile(BaseModel):
    """Metadata about the tutor manager agent coordinating the others."""

    name: str
    mission: str
    rationale: str
    priorities: list[str]
    next_steps: list[str]


class TutorManagerAgentReport(BaseModel):
    """Describes a dispatched agent and the payload it produced."""

    id: Literal["curriculum", "assessment", "practice", "coach"]
    name: str
    route: str
    status: Literal["completed", "skipped", "failed"]
    summary: str
    payload: dict[str, Any] = Field(default_factory=dict)


class TutorManagerResponse(BaseModel):
    """Response returned when the manager agent orchestrates other agents."""

    model: str
    generated_at: datetime
    topic: str
    learner_profile: str
    manager: TutorManagerProfile
    agents: list[TutorManagerAgentReport]
