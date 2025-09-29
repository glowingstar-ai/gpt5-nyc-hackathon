"""Services that power the multi-agent Tutor Mode experience."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Iterable

from app.schemas.tutor import (
    TutorCoachCheckpoint,
    TutorCoachResponse,
    TutorCurriculumResponse,
    TutorCurriculumSession,
    TutorManagerAgentReport,
    TutorManagerProfile,
    TutorManagerResponse,
    TutorModeRequest,
    TutorPracticeResponse,
    TutorPracticeSprint,
    TutorAssessmentQuestion,
    TutorAssessmentResponse,
)


def _ensure_list(values: Iterable[str] | None) -> list[str]:
    """Return a list with any falsey values removed."""

    if not values:
        return []
    return [value for value in values if value]


def _infer_level(student_level: str | None) -> str:
    """Generate a short descriptor for the learner's self-reported level."""

    if not student_level:
        return "curious explorer"

    lowered = student_level.lower()
    if any(keyword in lowered for keyword in {"beginner", "new", "first time"}):
        return "early-stage learner"
    if any(keyword in lowered for keyword in {"intermediate", "practiced", "some"}):
        return "growing practitioner"
    if any(keyword in lowered for keyword in {"advanced", "expert", "professional"}):
        return "seasoned builder"
    return student_level


def _profile_summary(payload: TutorModeRequest) -> str:
    """Compose a friendly learner profile summary."""

    goals = ", ".join(_ensure_list(payload.goals)) or "sharpen understanding"
    modalities = (
        ", ".join(_ensure_list(payload.preferred_modalities))
        or "whichever modality keeps energy high"
    )
    context = payload.additional_context.strip() if payload.additional_context else ""
    level = _infer_level(payload.student_level)

    parts = [f"Learner is a {level} focused on {goals} within {payload.topic}."]
    parts.append(f"Preferred modalities: {modalities}.")
    if context:
        parts.append(f"Extra context: {context}.")
    return " ".join(parts)


class TutorCurriculumAgent:
    """Generates a staged curriculum plan without calling external APIs."""

    def __init__(self, *, model: str) -> None:
        self.model = model

    def run(self, payload: TutorModeRequest) -> TutorCurriculumResponse:
        level = _infer_level(payload.student_level)
        goals = _ensure_list(payload.goals) or [
            f"Build a conceptual map of {payload.topic}",
            f"Practice applying {payload.topic} in small scenarios",
        ]
        modality_note = (
            _ensure_list(payload.preferred_modalities) or ["visual", "interactive"]
        )

        sessions: list[TutorCurriculumSession] = [
            TutorCurriculumSession(
                id="launch",
                title=f"Launchpad: discover why {payload.topic} matters",
                focus="Elicit prior knowledge and align on the learner's goals",
                duration="45 minutes",
                objectives=[
                    f"Capture what {level} learners already associate with {payload.topic}",
                    "Surface motivation, constraints, and success markers",
                ],
                learning_modality="verbal",
                core_activities=[
                    "Guided dialogue using a concept map canvas",
                    "Mini-story that situates the topic in the learner's world",
                ],
                practice_opportunity=
                    "Write a two-sentence explanation of the topic for a friend and note uncertainties.",
            ),
            TutorCurriculumSession(
                id="decode",
                title=f"Decode the core building blocks of {payload.topic}",
                focus="Introduce the minimum lovable theory and vocabulary",
                duration="60 minutes",
                objectives=[
                    f"Explain the headline components that make up {payload.topic}",
                    "Model how the pieces interact with a simplified diagram",
                ],
                learning_modality="visual",
                core_activities=[
                    "Layered diagram walk-through with annotations",
                    "Think-aloud comparison between a strong and weak example",
                ],
                practice_opportunity=
                    "Match each component to a description and justify the pairing verbally.",
            ),
            TutorCurriculumSession(
                id="build",
                title=f"Build and experiment with {payload.topic}",
                focus="Move from theory into guided application",
                duration="75 minutes",
                objectives=[
                    "Translate concepts into a simple hands-on task",
                    "Surface misconceptions quickly with feedback loops",
                ],
                learning_modality="interactive",
                core_activities=[
                    "Live-coding or sandbox exploration with check-point rubrics",
                    "Peer review or rubber-duck debugging to articulate reasoning",
                ],
                practice_opportunity=
                    "Ship a micro-project aligned with one learning goal and record a quick retrospective.",
            ),
            TutorCurriculumSession(
                id="stretch",
                title=f"Stretch and transfer {payload.topic} mastery",
                focus="Drive metacognition and plan continued practice",
                duration="45 minutes",
                objectives=[
                    "Reflect on growth and articulate next-level challenges",
                    "Plan how to sustain momentum with spaced practice",
                ],
                learning_modality="blended",
                core_activities=[
                    "Socratic reflection on wins, wobbles, and adjustments",
                    "Design a personal practice cadence that fits constraints",
                ],
                practice_opportunity=
                    "Outline a two-week action plan with confidence ratings for each milestone.",
            ),
        ]

        enrichment = [
            f"Bookmark a mentor-quality talk or article that makes {payload.topic} feel tangible",
            "Join a community space to swap progress updates once a week",
            f"Track one 'aha' moment per session focused on {payload.topic}",
        ]

        summary = (
            f"Sequenced {len(sessions)}-session journey emphasising {', '.join(modality_note)} "
            f"modalities so a {level} can reach goals like {goals[0].lower()}"
        )

        return TutorCurriculumResponse(
            topic=payload.topic,
            summary=summary,
            horizon="2-week sprint" if level != "seasoned builder" else "Fast-track intensive",
            sessions=sessions,
            capstone_project=(
                f"Design a capstone that applies {payload.topic} to one of the learner's goals. "
                "Deliver a short demo or write-up that captures decision points and trade-offs."
            ),
            enrichment=enrichment,
        )


class TutorAssessmentAgent:
    """Creates a formative quiz with answer keys."""

    def __init__(self, *, model: str) -> None:
        self.model = model

    def run(self, payload: TutorModeRequest) -> TutorAssessmentResponse:
        topic = payload.topic
        level = _infer_level(payload.student_level)

        questions: list[TutorAssessmentQuestion] = [
            TutorAssessmentQuestion(
                id="q1",
                prompt=f"Which statement best captures the primary purpose of {topic}?",
                kind="multiple_choice",
                options=[
                    f"It provides a framework to reason about {topic} scenarios",
                    f"It is mainly historical trivia unrelated to {topic}",
                    "It replaces foundational skills with automation",
                    "It focuses exclusively on memorising terminology",
                ],
                answer=f"It provides a framework to reason about {topic} scenarios",
                rationale="Learners demonstrate conceptual understanding when they can state why the topic exists.",
            ),
            TutorAssessmentQuestion(
                id="q2",
                prompt=f"List one real-world situation where {topic} becomes especially useful.",
                kind="short_answer",
                answer=f"Any scenario that aligns with the learner's goals while leveraging {topic} for impact",
                rationale="Short answer checks transfer—any thoughtful example tied to their context earns credit.",
            ),
            TutorAssessmentQuestion(
                id="q3",
                prompt=f"Which option describes a healthy troubleshooting move when practising {topic}?",
                kind="multiple_choice",
                options=[
                    "Ignore feedback signals and push through",
                    "Pause to inspect inputs/assumptions before continuing",
                    "Restart the project from scratch every time",
                    "Rely solely on pre-written solutions",
                ],
                answer="Pause to inspect inputs/assumptions before continuing",
                rationale="Metacognitive troubleshooting is a key mastery indicator for resilient learners.",
            ),
            TutorAssessmentQuestion(
                id="q4",
                prompt=f"Name one metric or signal that would show you are improving with {topic}.",
                kind="short_answer",
                answer="Any measurable improvement aligned with their goals (accuracy, speed, confidence, learner-defined value)",
                rationale="Invites personalisation—credit is awarded for thoughtful, relevant metrics.",
            ),
            TutorAssessmentQuestion(
                id="q5",
                prompt="When stuck, which escalation path keeps learning momentum healthy?",
                kind="multiple_choice",
                options=[
                    "Stay silent to avoid judgement",
                    "Ask for targeted feedback while sharing attempts so far",
                    "Abandon the learning sprint entirely",
                    "Copy answers from a solution bank",
                ],
                answer="Ask for targeted feedback while sharing attempts so far",
                rationale="Shows willingness to collaborate and builds coaching loops into the plan.",
            ),
        ]

        grading_notes = [
            f"Look for answers that connect {topic} to the learner's stated goals.",
            "Reward explicit reasoning and evidence of iteration.",
            "Encourage reflection where responses surface misconceptions to revisit during coaching.",
        ]

        description = (
            f"A quick diagnostic for a {level} to check comprehension, application, and coaching readiness."
        )

        return TutorAssessmentResponse(
            title=f"{topic} mastery pulse",
            description=description,
            duration="Approx. 15 minutes",
            grading_notes=grading_notes,
            questions=questions,
        )


class TutorPracticeAgent:
    """Outlines hands-on practice sprints and routines."""

    def __init__(self, *, model: str) -> None:
        self.model = model

    def run(self, payload: TutorModeRequest) -> TutorPracticeResponse:
        topic = payload.topic
        goals = _ensure_list(payload.goals) or [f"Apply {topic} confidently"]

        sprints = [
            TutorPracticeSprint(
                name="Foundations warm-up",
                cadence="Daily 10-minute reps",
                focus=f"Micro-drills that reinforce the essential moves inside {topic}",
                checkpoints=[
                    "Log one insight per rep in a learning journal",
                    "Share a quick loom or screenshot recap twice a week",
                ],
            ),
            TutorPracticeSprint(
                name="Guided project lap",
                cadence="3 sessions across the week",
                focus=f"Ship a tiny project that reflects goal: {goals[0]}",
                checkpoints=[
                    "Define success criteria before starting",
                    "Schedule midpoint feedback with a peer or mentor",
                    "Publish a short retrospective noting wins and wobbles",
                ],
            ),
            TutorPracticeSprint(
                name="Stretch and transfer",
                cadence="Weekly challenge",
                focus="Explore an unfamiliar dataset, audience, or constraint to prevent plateauing",
                checkpoints=[
                    "Document what changed from the original plan and why",
                    "Flag one question to research further and add to backlog",
                ],
            ),
        ]

        warmups = [
            f"2-minute breath or movement reset before tackling {topic} work",
            "Review yesterday's learning highlight and today's focus",
            "Preview potential blockers and jot down one mitigation tactic",
        ]

        accountability = [
            "Publish progress snapshots at a consistent cadence",
            "Pair up with an accountability buddy for weekly syncs",
            "Use colour-coded tags (win, wobble, next) to make reflection lightweight",
        ]

        return TutorPracticeResponse(
            topic=topic,
            warmups=warmups,
            sprints=sprints,
            accountability=accountability,
        )


class TutorCoachAgent:
    """Provides coaching checkpoints and escalation strategies."""

    def __init__(self, *, model: str) -> None:
        self.model = model

    def run(self, payload: TutorModeRequest) -> TutorCoachResponse:
        topic = payload.topic
        level = _infer_level(payload.student_level)

        check_ins = [
            TutorCoachCheckpoint(
                milestone="Kick-off",
                prompt="Share your motivation and what a win looks like for you this week.",
                success_signal="Learner articulates a concrete outcome and energy level",
                support_plan="Mirror back their goals and co-create success metrics tied to the curriculum roadmap.",
            ),
            TutorCoachCheckpoint(
                milestone="After first build session",
                prompt=f"Walk me through the choices you made while practising {topic}. What felt smooth?",
                success_signal="Learner references key concepts and evaluates their own process",
                support_plan="Celebrate progress, then use assessment insights to shape the next sprint.",
            ),
            TutorCoachCheckpoint(
                milestone="Pre-capstone",
                prompt="What evidence shows you're ready for the capstone? Anything still fuzzy?",
                success_signal="Learner surfaces proof of understanding and identifies gaps",
                support_plan="If gaps remain, route back to targeted warmups or pair programming time.",
            ),
            TutorCoachCheckpoint(
                milestone="Celebration",
                prompt="Name the skill you're most proud of and the next experiment you'll run.",
                success_signal="Learner highlights growth and sets a forward-looking commitment",
                support_plan="Document the celebration, share recognition, and lock in their next accountability moment.",
            ),
        ]

        onboarding_message = (
            f"Welcome! I'm your coaching partner focused on helping a {level} stay confident with {topic}."
        )

        celebration_rituals = [
            "Capture a 60-second gratitude note to your future self after each milestone",
            "Post a visual snapshot of progress in the learning channel",
        ]

        escalation_paths = [
            "Trigger a mentor or peer review when two consecutive check-ins flag confusion",
            "Schedule a live pairing session if blockers persist beyond 48 hours",
            "Switch modalities (e.g., from reading to interactive) when energy drops",
        ]

        return TutorCoachResponse(
            onboarding_message=onboarding_message,
            check_ins=check_ins,
            celebration_rituals=celebration_rituals,
            escalation_paths=escalation_paths,
        )


class TutorModeService:
    """Manager agent that orchestrates individual tutor agents."""

    def __init__(
        self,
        *,
        model: str,
        curriculum_agent: TutorCurriculumAgent,
        assessment_agent: TutorAssessmentAgent,
        practice_agent: TutorPracticeAgent,
        coach_agent: TutorCoachAgent,
    ) -> None:
        self.model = model
        self.curriculum_agent = curriculum_agent
        self.assessment_agent = assessment_agent
        self.practice_agent = practice_agent
        self.coach_agent = coach_agent

    async def generate_plan(self, payload: TutorModeRequest) -> TutorManagerResponse:
        """Dispatch all agents and compile the manager's response."""

        curriculum = self.curriculum_agent.run(payload)
        assessment = self.assessment_agent.run(payload)
        practice = self.practice_agent.run(payload)
        coach = self.coach_agent.run(payload)

        manager_profile = self._build_manager_profile(
            payload=payload,
            curriculum=curriculum,
            assessment=assessment,
            practice=practice,
            coach=coach,
        )

        return TutorManagerResponse(
            model=self.model,
            generated_at=datetime.now(timezone.utc),
            topic=payload.topic,
            learner_profile=_profile_summary(payload),
            manager=manager_profile,
            agents=[
                TutorManagerAgentReport(
                    id="curriculum",
                    name="Curriculum Strategist",
                    route="/api/v1/tutor/curriculum",
                    status="completed",
                    summary=curriculum.summary,
                    payload=curriculum.model_dump(),
                ),
                TutorManagerAgentReport(
                    id="assessment",
                    name="Assessment Architect",
                    route="/api/v1/tutor/assessment",
                    status="completed",
                    summary=assessment.description,
                    payload=assessment.model_dump(),
                ),
                TutorManagerAgentReport(
                    id="practice",
                    name="Practice Producer",
                    route="/api/v1/tutor/practice",
                    status="completed",
                    summary=f"Outlined {len(practice.sprints)} sprints with accountability rituals",
                    payload=practice.model_dump(),
                ),
                TutorManagerAgentReport(
                    id="coach",
                    name="Progress Coach",
                    route="/api/v1/tutor/coach",
                    status="completed",
                    summary="Sequenced coaching touch-points and escalation paths",
                    payload=coach.model_dump(),
                ),
            ],
        )

    def _build_manager_profile(
        self,
        *,
        payload: TutorModeRequest,
        curriculum: TutorCurriculumResponse,
        assessment: TutorAssessmentResponse,
        practice: TutorPracticeResponse,
        coach: TutorCoachResponse,
    ) -> TutorManagerProfile:
        """Craft the manager agent's rationale and directives."""

        goals = _ensure_list(payload.goals) or [f"Progress in {payload.topic}"]
        priorities = [
            f"Deliver curriculum that moves the learner toward: {goals[0]}",
            "Keep practice loops lightweight but visible to mentors",
            "Surface coaching signals early so we can adjust the plan",
        ]

        rationale = (
            "Curriculum, assessment, practice, and coaching operate as a loop. "
            "The manager routes requests to specialists to keep focus tight while sharing context."
        )

        next_steps = [
            f"Review the curriculum summary: {curriculum.summary}",
            f"Send the learner the quiz '{assessment.title}' for a quick pulse",
            "Schedule the first accountability check-in from the practice plan",
            "Adopt the celebration ritual that resonates most with the learner",
        ]

        mission = (
            f"Coordinate GPT-5 agents so the learner experiences a cohesive {payload.topic} journey."
        )

        return TutorManagerProfile(
            name="GPT-5 Tutor Manager",
            mission=mission,
            rationale=rationale,
            priorities=priorities,
            next_steps=next_steps,
        )
