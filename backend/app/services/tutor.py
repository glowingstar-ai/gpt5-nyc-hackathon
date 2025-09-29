"""Tutor mode orchestration powered by deterministic agent blueprints."""

from __future__ import annotations

from dataclasses import dataclass
from textwrap import dedent

from app.schemas.tutor import (
    AgentId,
    TutorAgentDescriptor,
    TutorAssessmentQuestion,
    TutorAssessmentResponse,
    TutorCurriculumResponse,
    TutorCurriculumSection,
    TutorManagerResponse,
    TutorModeRequest,
    TutorWorkshopResponse,
    TutorWorkshopSegment,
)


@dataclass(frozen=True)
class _AgentDefinition:
    id: AgentId
    name: str
    description: str
    deliverables: tuple[str, ...]
    route: str


class TutorAgentService:
    """Generate responses for the manager and specialist tutor agents."""

    def __init__(self, *, model: str = "gpt-5") -> None:
        self.model = model

    def manager_plan(self, payload: TutorModeRequest) -> TutorManagerResponse:
        """Return a manager briefing that routes the learner to specialist agents."""

        level = payload.student_level or "curious explorer"
        goals = payload.goals or [
            f"Develop confidence with {payload.topic}",
            "Practice applying the concept in context",
        ]
        kickoff_script = dedent(
            f"""
            Hi there! I'm the GPT-5 tutor manager running on {self.model}. We'll align on what you already
            know about {payload.topic}, calibrate the difficulty to your needs, then fan out tasks to our
            curriculum, workshop, and assessment specialists. I'll keep you updated as each agent reports back.
            """
        ).strip()

        agenda = [
            f"Clarify your goals: {', '.join(goals[:2])}",
            "Co-design a curriculum spine with the strategist",
            "Prototype a hands-on workshop so you can immediately practise",
            "Publish a mastery check with transparent answer keys",
        ]

        agents = [
            _AgentDefinition(
                id="manager",
                name="GPT-5 Manager",
                description="Keeps the tutoring mission aligned and narrates hand-offs.",
                deliverables=(
                    "Summarise learner goals and context",
                    "Recommend the right specialist order",
                    "Hold the learner accountable to next steps",
                ),
                route="/tutor/mode",
            ),
            _AgentDefinition(
                id="curriculum",
                name="Curriculum Strategist",
                description="Maps the staged learning journey with prerequisites and checkpoints.",
                deliverables=(
                    "Three-stage roadmap with estimated pacing",
                    "Activities tailored to preferred modalities",
                    "Embedded formative checks for each unit",
                ),
                route="/tutor/curriculum",
            ),
            _AgentDefinition(
                id="workshop",
                name="Workshop Designer",
                description="Builds a collaborative session for immediate application.",
                deliverables=(
                    "Warm-up to surface prior knowledge",
                    "Guided practice with coaching cues",
                    "Reflection prompts that consolidate learning",
                ),
                route="/tutor/workshop",
            ),
            _AgentDefinition(
                id="assessment",
                name="Assessment Architect",
                description="Crafts a quiz plus answer keys to confirm mastery.",
                deliverables=(
                    "Mix of multiple-choice and short-answer items",
                    "Rationales explaining what excellence looks like",
                    "Success criteria for next learning steps",
                ),
                route="/tutor/assessment",
            ),
        ]

        agent_descriptors = [
            TutorAgentDescriptor(
                id=agent.id,
                name=agent.name,
                description=agent.description,
                deliverables=list(agent.deliverables),
                route=agent.route,
            )
            for agent in agents
        ]

        summary = (
            f"Coordinating the GPT-5 tutor collective to help you master {payload.topic}. We'll adjust to "
            f"a {level} profile and keep the plan centred on {goals[0].lower()}."
        )

        return TutorManagerResponse(
            topic=payload.topic,
            student_level=payload.student_level,
            summary=summary,
            kickoff_script=kickoff_script,
            agenda=agenda,
            agents=agent_descriptors,
        )

    def curriculum_plan(self, payload: TutorModeRequest) -> TutorCurriculumResponse:
        """Produce a curriculum blueprint tailored to the topic and learner context."""

        level = payload.student_level or "Adaptive for mixed experience levels"
        goals = payload.goals or [f"Understand the foundations of {payload.topic}"]
        modalities = payload.preferred_modalities or ["visual", "interactive", "verbal"]

        sections = [
            TutorCurriculumSection(
                title="Stage 1 · Foundations",
                duration="45 minutes",
                focus=f"Establish core vocabulary and mental models for {payload.topic}",
                learning_goals=[
                    f"Explain why {payload.topic} matters using everyday language",
                    "Surface prior knowledge and analogies",
                ],
                activities=[
                    "Concept mapping exercise with the manager agent",
                    f"Guided explainer that highlights the big ideas behind {payload.topic}",
                ],
                resources=[
                    "Lightweight primer article",
                    f"Annotated diagram that visualises {payload.topic}",
                ],
                assessment="Quick verbal check for accurate definitions and confidence rating",
            ),
            TutorCurriculumSection(
                title="Stage 2 · Applied practice",
                duration="60 minutes",
                focus=f"Solve scaffolded problems using {payload.topic} in context",
                learning_goals=[
                    goals[0],
                    "Identify common pitfalls and how to debug them",
                ],
                activities=[
                    f"Hands-on workshop activity aligned with {modalities[0]} modality",
                    "Pair walkthrough with reflective questioning",
                ],
                resources=[
                    "Interactive notebook or sandbox",
                    "Step-by-step checklist for the procedure",
                ],
                assessment="Mini project with peer explanation and automated checks",
            ),
            TutorCurriculumSection(
                title="Stage 3 · Transfer and extension",
                duration="40 minutes",
                focus="Stretch the learner with open-ended challenges and future pathways",
                learning_goals=[
                    "Design a personal challenge extending the concept",
                    "Outline next study steps using insights from the assessment",
                ],
                activities=[
                    "Socratic dialogue exploring what-if scenarios",
                    "Learner-led recap shared with a peer or mentor",
                ],
                resources=[
                    "Curated advanced reading list",
                    "Template for planning ongoing practice",
                ],
                assessment="Reflection journal plus a self-designed quiz question",
            ),
        ]

        overview = (
            f"This roadmap guides a learner from foundations to confident application of {payload.topic}. "
            "Each stage ends with a visible mastery signal so the manager can adapt pacing."
        )
        pacing_guide = (
            "Schedule three focused sessions over the next week, allowing reflection time between stages. "
            "Reuse activities that resonate most with the learner's preferred modalities."
        )

        return TutorCurriculumResponse(
            topic=payload.topic,
            level=level,
            overview=overview,
            pacing_guide=pacing_guide,
            sections=sections,
        )

    def workshop_plan(self, payload: TutorModeRequest) -> TutorWorkshopResponse:
        """Design a collaborative session the learner can run immediately."""

        scenario = payload.additional_context or (
            f"Practice applying {payload.topic} to a real-world scenario the learner cares about"
        )
        segments = [
            TutorWorkshopSegment(
                name="Warm-up and alignment",
                duration="10 minutes",
                objective="Activate prior knowledge and set success metrics",
                flow=[
                    "Quick pulse check on confidence using emojis or a scale",
                    f"Learner shares a recent challenge involving {payload.topic}",
                    "Manager captures highlights on a shared canvas",
                ],
                materials=["Virtual whiteboard", "Icebreaker poll"],
                reflection_prompts=[
                    "What feels familiar about today's focus?",
                    "Which goal matters most for this session?",
                ],
            ),
            TutorWorkshopSegment(
                name="Guided practice",
                duration="35 minutes",
                objective="Work through a challenge with live coaching cues",
                flow=[
                    "Workshop designer presents a scenario tied to the learner's context",
                    "Learner tackles the challenge step-by-step with think-aloud narration",
                    "Coach offers hints or pattern breaks when the learner stalls",
                ],
                materials=[
                    "Sandbox or notebook",
                    "Hint bank with escalating nudges",
                    "Timer to structure focus sprints",
                ],
                reflection_prompts=[
                    "Which step felt the trickiest and why?",
                    "What cues helped you regain momentum?",
                ],
            ),
            TutorWorkshopSegment(
                name="Reflection and next sprint",
                duration="15 minutes",
                objective="Consolidate takeaways and plan autonomous practice",
                flow=[
                    "Learner summarises the strategy in their own words",
                    "Identify a mini-project to attempt before the next session",
                    "Celebrate wins and capture remaining questions for the manager",
                ],
                materials=[
                    "Celebration GIF or emoji board",
                    "Template for tracking next actions",
                ],
                reflection_prompts=[
                    "What will you experiment with next?",
                    "How will you notice progress between sessions?",
                ],
            ),
        ]

        description = (
            "A facilitator-ready session outline that blends coaching, practice, and reflection. It pairs "
            "naturally with the curriculum roadmap so the learner experiences immediate application."
        )

        exit_ticket = [
            f"Summarise the key insight about {payload.topic} in one sentence.",
            "Capture one action you'll take in the next 24 hours to reinforce learning.",
            "List a question you want the manager to bring to the next session.",
        ]

        return TutorWorkshopResponse(
            topic=payload.topic,
            scenario=scenario,
            description=description,
            segments=segments,
            exit_ticket=exit_ticket,
        )

    def assessment_plan(self, payload: TutorModeRequest) -> TutorAssessmentResponse:
        """Generate a formative quiz with answer keys and rationales."""

        topic_slug = payload.topic.lower().replace(" ", "-")
        difficulty = payload.student_level or "Adaptive"
        instructions = (
            "Complete the short quiz below. Discuss your reasoning with the manager after each item so we "
            "can adjust the next learning sprint."
        )

        questions = [
            TutorAssessmentQuestion(
                id=f"{topic_slug}-mcq-1",
                type="multiple_choice",
                prompt=f"Which option best describes the primary purpose of {payload.topic}?",
                options=[
                    "A. Provide surface-level trivia without practical use",
                    "B. Solve real problems by combining data, structure, and feedback",
                    "C. Replace human judgment entirely",
                    "D. Serve only as academic theory with no applications",
                ],
                answer="B",
                rationale="Effective mastery highlights how the concept drives practical outcomes and avoids misconceptions.",
            ),
            TutorAssessmentQuestion(
                id=f"{topic_slug}-mcq-2",
                type="multiple_choice",
                prompt=f"When applying {payload.topic}, which strategy keeps mistakes from compounding?",
                options=[
                    "A. Skip reflection and push to the final answer",
                    "B. Pause to check assumptions against known patterns",
                    "C. Avoid feedback to stay confident",
                    "D. Memorise every possible scenario",
                ],
                answer="B",
                rationale="Calibrating against patterns reveals misunderstandings early and encourages iterative learning.",
            ),
            TutorAssessmentQuestion(
                id=f"{topic_slug}-short-1",
                type="short_answer",
                prompt=f"Describe a real situation from your context where {payload.topic} could create value.",
                options=None,
                answer="Answers should mention a concrete scenario, the desired outcome, and why the concept fits.",
                rationale="We look for transfer: connecting the concept to the learner's world with clear reasoning.",
            ),
        ]

        success_criteria = [
            "Explains the concept's purpose without common misconceptions",
            "Applies a reflective strategy while problem solving",
            "Connects the topic to a lived scenario with clear value",
        ]

        return TutorAssessmentResponse(
            topic=payload.topic,
            difficulty=difficulty,
            instructions=instructions,
            success_criteria=success_criteria,
            questions=questions,
        )
