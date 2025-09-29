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
    beginner_flag_logic: str = Field(
        default="Classify the learner as a beginner when answers show limited prior knowledge.",
        description="How the tutor converts qualitative signals into the beginner boolean flag",
    )
    follow_up_questions: list[str] = Field(
        default_factory=list,
        description="Additional probes asked when the learner is not a beginner",
    )
    max_follow_up_iterations: int = Field(
        default=3,
        description="Maximum number of iterations before moving on",
    )
    escalation_strategy: str = Field(
        default="Summarise what you learned and explain how you will adapt the plan before continuing.",
        description="What the tutor does if understanding remains unclear after follow ups",
    )


class TutorConceptBreakdown(BaseModel):
    """Step 1 – structured concepts and reasoning."""

    concept: str
    llm_reasoning: str
    subtopics: list[str]
    real_world_connections: list[str]
    prerequisites: list[str] = Field(
        default_factory=list,
        description="Concepts that must be mastered before this one",
    )
    mastery_checks: list[str] = Field(
        default_factory=list,
        description="Observable indicators that the learner is ready to advance",
    )
    remediation_plan: str = Field(
        default="Offer a quick formative quiz and revisit the prerequisite concept with a new example.",
        description="Action taken when mastery checks are not met",
    )
    advancement_cue: str = Field(
        default="Acknowledge success and transition to the next concept with an applied challenge.",
        description="How to celebrate/transition after a pass",
    )


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


class TutorConversationManager(BaseModel):
    """High-level directives for the GPT-5 manager orchestrating the session."""

    agent_role: str
    topic_extraction_prompt: str
    level_assessment_summary: str
    containment_strategy: str


class TutorStageQuiz(BaseModel):
    """Quiz blueprint attached to a learning stage."""

    prompt: str
    answer_key: str | None = None
    remediation: str


class TutorLearningStage(BaseModel):
    """Learning stage that enforces pass/fail progression rules."""

    name: str
    focus: str
    objectives: list[str]
    prerequisites: list[str]
    pass_criteria: list[str]
    quiz: TutorStageQuiz
    on_success: str
    on_failure: str


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
    conversation_manager: TutorConversationManager
    learning_stages: list[TutorLearningStage]


class TutorAgentRoute(BaseModel):
    """Metadata describing an individual tutor agent endpoint."""

    id: Literal["manager", "curriculum", "modalities", "assessment", "coach"]
    name: str
    description: str
    endpoint: str
    capabilities: list[str]


class TutorManagerAgentResponse(BaseModel):
    """Response payload for the tutor manager agent."""

    model: str
    generated_at: datetime
    topic: str
    learner_profile: str
    objectives: list[str]
    manager: TutorConversationManager
    understanding: TutorUnderstandingPlan
    completion: TutorCompletionPlan
    agents: list[TutorAgentRoute]


class TutorCurriculumAgentResponse(BaseModel):
    """Response payload for the curriculum strategist agent."""

    model: str
    generated_at: datetime
    topic: str
    concept_breakdown: list[TutorConceptBreakdown]
    learning_stages: list[TutorLearningStage]


class TutorModalitiesAgentResponse(BaseModel):
    """Response payload for the modality researcher agent."""

    model: str
    generated_at: datetime
    topic: str
    teaching_modalities: list[TutorTeachingModality]


class TutorStageQuizSummary(BaseModel):
    """High-level summary of quizzes attached to each learning stage."""

    stage_name: str
    pass_criteria: list[str]
    on_success: str
    on_failure: str
    quiz: TutorStageQuiz


class TutorAssessmentAgentResponse(BaseModel):
    """Response payload for the assessment architect agent."""

    model: str
    generated_at: datetime
    topic: str
    assessment: TutorAssessmentPlan
    stage_quizzes: list[TutorStageQuizSummary]


class TutorCoachAgentResponse(BaseModel):
    """Response payload for the progress coach agent."""

    model: str
    generated_at: datetime
    topic: str
    objectives: list[str]
    understanding: TutorUnderstandingPlan
    completion: TutorCompletionPlan
