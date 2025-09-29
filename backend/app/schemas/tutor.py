"""Pydantic schemas for tutor mode manager and specialist agents."""

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


AgentId = Literal["manager", "curriculum", "workshop", "assessment"]


class TutorAgentDescriptor(BaseModel):
    """Metadata describing a specialist tutor agent the manager can delegate to."""

    id: AgentId
    name: str
    route: str = Field(..., description="API route used to activate the agent")
    description: str
    deliverables: list[str] = Field(
        default_factory=list,
        description="Concrete outputs the agent promises to return",
    )


class TutorManagerResponse(BaseModel):
    """Manager agent response introducing the full tutoring collective."""

    topic: str
    student_level: str | None
    summary: str
    kickoff_script: str
    agenda: list[str]
    agents: list[TutorAgentDescriptor]


class TutorCurriculumSection(BaseModel):
    """Single unit in a curriculum blueprint."""

    title: str
    duration: str
    focus: str
    learning_goals: list[str]
    activities: list[str]
    resources: list[str]
    assessment: str


class TutorCurriculumResponse(BaseModel):
    """Curriculum strategist output describing the macro learning journey."""

    topic: str
    level: str
    overview: str
    pacing_guide: str
    sections: list[TutorCurriculumSection]


class TutorWorkshopSegment(BaseModel):
    """Segment within an applied workshop or coaching session."""

    name: str
    duration: str
    objective: str
    flow: list[str]
    materials: list[str]
    reflection_prompts: list[str]


class TutorWorkshopResponse(BaseModel):
    """Hands-on session plan produced by the workshop designer."""

    topic: str
    scenario: str
    description: str
    segments: list[TutorWorkshopSegment]
    exit_ticket: list[str]


class TutorAssessmentQuestion(BaseModel):
    """Assessment item with an answer key for the assessment architect."""

    id: str
    type: Literal["multiple_choice", "short_answer"]
    prompt: str
    options: list[str] | None = None
    answer: str
    rationale: str


class TutorAssessmentResponse(BaseModel):
    """Quiz and scoring guidance for validating mastery."""

    topic: str
    difficulty: str
    instructions: str
    success_criteria: list[str]
    questions: list[TutorAssessmentQuestion]
