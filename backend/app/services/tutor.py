"""Tutor mode orchestration powered by GPT-5 (with graceful fallbacks)."""

from __future__ import annotations

from datetime import datetime, timezone
from textwrap import dedent
from typing import Any

import httpx

from app.schemas.tutor import (
    TutorAgentHook,
    TutorAssessmentItem,
    TutorAssessmentPlan,
    TutorAssessmentResponse,
    TutorCoachResponse,
    TutorCompletionPlan,
    TutorConceptBreakdown,
    TutorCurriculumResponse,
    TutorLearningStage,
    TutorManagerResponse,
    TutorModeRequest,
    TutorModeResponse,
    TutorModalitiesResponse,
    TutorStageQuiz,
    TutorStageQuizSummary,
    TutorTeachingModality,
    TutorUnderstandingPlan,
    TutorConversationManager,
)


class TutorModeService:
    """Generate an agentic tutoring plan using GPT-5 or an offline heuristic."""

    def __init__(
        self,
        *,
        api_key: str | None,
        base_url: str,
        model: str,
        timeout: float = 30.0,
    ) -> None:
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.timeout = timeout

    async def generate_plan(self, payload: TutorModeRequest) -> TutorModeResponse:
        """Return a structured tutor plan, attempting GPT-5 first."""

        if not self.api_key:
            return self._offline_plan(payload)

        try:
            response_json = await self._call_openai(payload)
            return self._from_openai(payload, response_json)
        except Exception:
            return self._offline_plan(payload)

    async def manager_overview(
        self, payload: TutorModeRequest
    ) -> TutorManagerResponse:
        """Return the manager agent's overview and hook metadata."""

        plan = await self.generate_plan(payload)
        agent_hooks = [
            TutorAgentHook(
                id="curriculum",
                name="Curriculum Strategist",
                description="Designs staged learning journeys and prerequisite checks.",
                endpoint="/tutor/curriculum",
            ),
            TutorAgentHook(
                id="modalities",
                name="Modality Researcher",
                description="Curates multi-modal resources aligned to objectives.",
                endpoint="/tutor/modalities",
            ),
            TutorAgentHook(
                id="assessment",
                name="Assessment Architect",
                description="Builds mastery checks, quizzes, and answer keys.",
                endpoint="/tutor/assessment",
            ),
            TutorAgentHook(
                id="coach",
                name="Progress Coach",
                description="Monitors understanding signals and plans wrap-ups.",
                endpoint="/tutor/coach",
            ),
        ]

        return TutorManagerResponse(
            model=plan.model,
            generated_at=plan.generated_at,
            topic=plan.topic,
            learner_profile=plan.learner_profile,
            objectives=plan.objectives,
            conversation_manager=plan.conversation_manager,
            agent_hooks=agent_hooks,
        )

    async def curriculum_plan(
        self, payload: TutorModeRequest
    ) -> TutorCurriculumResponse:
        """Return staged curriculum guidance for the curriculum agent."""

        plan = await self.generate_plan(payload)
        return TutorCurriculumResponse(
            model=plan.model,
            generated_at=plan.generated_at,
            topic=plan.topic,
            concept_breakdown=plan.concept_breakdown,
            learning_stages=plan.learning_stages,
        )

    async def modalities_plan(
        self, payload: TutorModeRequest
    ) -> TutorModalitiesResponse:
        """Return modality recommendations for the modality agent."""

        plan = await self.generate_plan(payload)
        return TutorModalitiesResponse(
            model=plan.model,
            generated_at=plan.generated_at,
            topic=plan.topic,
            objectives=plan.objectives,
            teaching_modalities=plan.teaching_modalities,
        )

    async def assessment_plan(
        self, payload: TutorModeRequest
    ) -> TutorAssessmentResponse:
        """Return assessment artefacts for the assessment agent."""

        plan = await self.generate_plan(payload)
        stage_quizzes = [
            TutorStageQuizSummary(stage=stage.name, quiz=stage.quiz)
            for stage in plan.learning_stages
        ]
        return TutorAssessmentResponse(
            model=plan.model,
            generated_at=plan.generated_at,
            topic=plan.topic,
            assessment=plan.assessment,
            stage_quizzes=stage_quizzes,
        )

    async def coach_plan(self, payload: TutorModeRequest) -> TutorCoachResponse:
        """Return coaching guidance for monitoring progress."""

        plan = await self.generate_plan(payload)
        return TutorCoachResponse(
            model=plan.model,
            generated_at=plan.generated_at,
            topic=plan.topic,
            understanding=plan.understanding,
            completion=plan.completion,
        )

    async def _call_openai(self, payload: TutorModeRequest) -> dict[str, Any]:
        """Invoke the OpenAI Responses API requesting a JSON plan."""

        prompt = dedent(
            f"""
            You are BabyAGI operating in tutor mode and powered by {self.model}. Act as the GPT-5
            manager orchestrating sub-agents inside a single chat conversation. Use the student
            profile below to create a JSON-only tutoring plan that extracts the topic, diagnoses
            level with a beginner flag, routes through staged concepts, and loops in quizzes when
            a learner needs remediation.

            Student profile:
            - Topic: {payload.topic}
            - Student level: {payload.student_level or 'unspecified'}
            - Goals: {', '.join(payload.goals or ['not provided'])}
            - Preferred modalities: {', '.join(payload.preferred_modalities or ['not provided'])}
            - Additional context: {payload.additional_context or 'none'}

            The JSON schema (tutor_plan) must contain:
            {{
              "model": string,
              "learner_profile": string,
              "objectives": string array,
              "understanding": {{
                "approach": string,
                "diagnostic_questions": string array,
                "signals_to_watch": string array,
                "beginner_flag_logic": string,
                "follow_up_questions": string array,
                "max_follow_up_iterations": integer,
                "escalation_strategy": string
              }},
              "concept_breakdown": array of {{
                "concept": string,
                "llm_reasoning": string,
                "subtopics": string array,
                "real_world_connections": string array,
                "prerequisites": string array,
                "mastery_checks": string array,
                "remediation_plan": string,
                "advancement_cue": string
              }},
              "teaching_modalities": array of {{
                "modality": string,
                "description": string,
                "resources": string array
              }},
              "assessment": {{
                "title": string,
                "format": string,
                "human_in_the_loop_notes": string,
                "items": array of {{
                  "prompt": string,
                  "kind": string,
                  "options": string array or null,
                  "answer_key": string or null
                }}
              }},
              "completion": {{
                "mastery_indicators": string array,
                "wrap_up_plan": string,
                "follow_up_suggestions": string array
              }},
              "conversation_manager": {{
                "agent_role": string,
                "topic_extraction_prompt": string,
                "level_assessment_summary": string,
                "containment_strategy": string
              }},
              "learning_stages": array of {{
                "name": string,
                "focus": string,
                "objectives": string array,
                "prerequisites": string array,
                "pass_criteria": string array,
                "quiz": {{
                  "prompt": string,
                  "answer_key": string or null,
                  "remediation": string
                }},
                "on_success": string,
                "on_failure": string
              }}
            }}

            Explicitly detail how the manager keeps the dialogue inside the chat, confirms the
            topic, and asks up to three follow-up questions when the beginner flag is False before
            escalating. Ensure each learning stage clearly states how to progress only after passing
            a quiz or mastery check, and how to remediate otherwise.
            """
        ).strip()

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {
            "model": self.model,
            "input": prompt,
            "text": {
                "format": {
                    "type": "json_object"
                }
            },
        }

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/responses", headers=headers, json=body
            )
        response.raise_for_status()

        data = response.json()
        # The Responses API returns JSON content in various spots; prefer direct JSON.
        if isinstance(data, dict) and "output" in data:
            for item in data.get("output", []):
                if item.get("type") == "output_text":
                    return httpx.Response(200, text=item.get("text", "{}"), request=response.request).json()
        if isinstance(data, dict) and "output_text" in data:
            return httpx.Response(200, text=data.get("output_text", "{}"), request=response.request).json()
        if isinstance(data, dict) and "response" in data:
            return data["response"]
        return data

    def _from_openai(
        self, payload: TutorModeRequest, response_json: dict[str, Any]
    ) -> TutorModeResponse:
        """Convert OpenAI JSON into the API's typed response."""

        # Defensive parsing: fall back to offline plan if required keys are missing.
        required_keys = {
            "learner_profile",
            "objectives",
            "understanding",
            "concept_breakdown",
            "teaching_modalities",
            "assessment",
            "completion",
            "conversation_manager",
            "learning_stages",
        }
        if not required_keys.issubset(response_json):
            return self._offline_plan(payload)

        understanding = TutorUnderstandingPlan(**response_json["understanding"])
        concepts = [
            TutorConceptBreakdown(**concept)
            for concept in response_json.get("concept_breakdown", [])
        ]
        modalities = [
            TutorTeachingModality(**modality)
            for modality in response_json.get("teaching_modalities", [])
        ]
        assessment_payload = response_json.get("assessment", {})
        items = [
            TutorAssessmentItem(**item)
            for item in assessment_payload.get("items", [])
        ]
        assessment = TutorAssessmentPlan(**assessment_payload, items=items)
        completion = TutorCompletionPlan(**response_json.get("completion", {}))
        conversation_manager = TutorConversationManager(
            **response_json.get("conversation_manager", {})
        )
        stages = []
        for stage_payload in response_json.get("learning_stages", []):
            quiz_payload = stage_payload.get("quiz", {})
            quiz = TutorStageQuiz(**quiz_payload)
            stages.append(
                TutorLearningStage(
                    name=stage_payload.get("name", "Stage"),
                    focus=stage_payload.get("focus", ""),
                    objectives=stage_payload.get("objectives", []),
                    prerequisites=stage_payload.get("prerequisites", []),
                    pass_criteria=stage_payload.get("pass_criteria", []),
                    quiz=quiz,
                    on_success=stage_payload.get("on_success", ""),
                    on_failure=stage_payload.get("on_failure", ""),
                )
            )

        return TutorModeResponse(
            model=response_json.get("model", self.model),
            generated_at=datetime.now(timezone.utc),
            topic=payload.topic,
            learner_profile=response_json["learner_profile"],
            objectives=response_json.get("objectives", []),
            understanding=understanding,
            concept_breakdown=concepts,
            teaching_modalities=modalities,
            assessment=assessment,
            completion=completion,
            conversation_manager=conversation_manager,
            learning_stages=stages,
        )

    def _offline_plan(self, payload: TutorModeRequest) -> TutorModeResponse:
        """Provide a deterministic plan when GPT-5 cannot be reached."""

        learner_profile = payload.student_level or "Curious learner"
        objectives = payload.goals or [
            f"Build foundational understanding of {payload.topic}",
            "Practice applying the concept in context",
        ]
        understanding = TutorUnderstandingPlan(
            approach="Start with a conversational diagnostic to gauge prior knowledge",
            diagnostic_questions=[
                f"How would you describe {payload.topic} in your own words?",
                "Which parts feel confusing or intimidating right now?",
            ],
            signals_to_watch=[
                "Confidence when answering why/how questions",
                "Ability to connect the topic to prior knowledge",
            ],
            beginner_flag_logic="Mark beginner=True when the learner struggles to define foundational vocabulary or relies on guesses.",
            follow_up_questions=[
                f"Can you share an example of using {payload.topic}?",
                "What related concepts have you studied before?",
                "Where do you feel the biggest gap is right now?",
            ],
            max_follow_up_iterations=3,
            escalation_strategy="After three probes, summarise what is known, state the provisional beginner flag, and explain the tailored path.",
        )
        concept_breakdown = [
            TutorConceptBreakdown(
                concept=payload.topic,
                llm_reasoning="Decompose the topic into digestible layers, building from fundamentals to nuanced applications.",
                subtopics=[
                    f"Core principles of {payload.topic}",
                    "Key vocabulary and definitions",
                    "Common pitfalls and misconceptions",
                ],
                real_world_connections=[
                    f"Everyday scenarios where {payload.topic} shows up",
                    "Analogies drawn from the learner's interests",
                ],
                prerequisites=["Baseline terminology", "Related prior knowledge from diagnostic"],
                mastery_checks=[
                    "Learner can outline the main steps without prompting",
                    "Learner correctly answers a why/how follow-up",
                ],
                remediation_plan="Deliver a targeted quiz, revisit prerequisite vocabulary, and co-create a new example before retrying.",
                advancement_cue="Celebrate with positive feedback and segue into the next subtopic via an applied challenge.",
            )
        ]
        modalities = [
            TutorTeachingModality(
                modality="visual",
                description="Use diagrams or flowcharts to map the relationships between subtopics.",
                resources=["Whiteboard sketches", "Infographic summarising the big picture"],
            ),
            TutorTeachingModality(
                modality="interactive",
                description="Guide the learner through a short BabyAGI-style task list they complete with you.",
                resources=["Collaborative document", "Step-by-step practice prompts"],
            ),
            TutorTeachingModality(
                modality="verbal",
                description="Offer a narrative explanation that stitches the ideas together with stories.",
                resources=["Mini lecture outline", "Real-time Q&A"],
            ),
        ]
        assessment_items = [
            TutorAssessmentItem(
                prompt=f"Explain {payload.topic} to a friend using a real-world analogy.",
                kind="reflection",
            ),
            TutorAssessmentItem(
                prompt=f"Apply {payload.topic} to solve a quick scenario provided by the mentor.",
                kind="practical",
                answer_key="Look for a structured approach and correct reasoning steps.",
            ),
        ]
        assessment = TutorAssessmentPlan(
            title=f"{payload.topic} comprehension check",
            format="Conversational debrief with quick formative quiz",
            human_in_the_loop_notes="Mentor reviews answers, probes for depth, and adapts follow-up tasks",
            items=assessment_items,
        )
        completion = TutorCompletionPlan(
            mastery_indicators=[
                "Learner explains the concept clearly and accurately",
                "Learner demonstrates transfer through a novel example",
                "Learner identifies next steps or questions without prompting",
            ],
            wrap_up_plan="Summarise key insights together and document agreed action items in the shared workspace.",
            follow_up_suggestions=[
                "Schedule a follow-up micro-assessment in 48 hours",
                "Provide curated resources aligned with preferred modalities",
            ],
        )
        conversation_manager = TutorConversationManager(
            agent_role="You are the GPT-5 manager coordinating tutor sub-agents inside this chat.",
            topic_extraction_prompt=(
                f"Let's double-check: are we focusing on {payload.topic}? If not, ask the learner to clarify the exact topic."
            ),
            level_assessment_summary=(
                "Set beginner_flag based on diagnostic signals. If False, ask follow-up questions sequentially (up to three) before committing."
            ),
            containment_strategy="Keep every clarification, assessment, and plan update inside this chat thread and narrate any agent hand-offs explicitly.",
        )
        learning_stages = [
            TutorLearningStage(
                name="Stage 1",
                focus="Foundational vocabulary and framing",
                objectives=[
                    f"Define the essential terms associated with {payload.topic}",
                    "Relate the concept to the learner's prior knowledge",
                ],
                prerequisites=["Beginner flag evaluated", "Diagnostic summary shared"],
                pass_criteria=[
                    "Learner restates the topic accurately",
                    "Learner identifies at least one real-world application",
                ],
                quiz=TutorStageQuiz(
                    prompt=f"Provide a simple scenario and ask the learner to identify how {payload.topic} applies.",
                    answer_key="Look for alignment with the key vocabulary and accurate mapping to the scenario.",
                    remediation="If incorrect, revisit the vocabulary with a new example and retry the quiz.",
                ),
                on_success="Acknowledge mastery and transition to applied practice.",
                on_failure="Loop back to the remediation plan, then re-issue the quiz before advancing.",
            ),
            TutorLearningStage(
                name="Stage 2",
                focus="Applied practice",
                objectives=[
                    "Guide the learner through a multi-step problem",
                    "Highlight decision points where misconceptions appear",
                ],
                prerequisites=["Stage 1 passed"],
                pass_criteria=[
                    "Learner solves the practice scenario with minimal scaffolding",
                    "Learner explains the reasoning behind each step",
                ],
                quiz=TutorStageQuiz(
                    prompt="Present a novel practice task and request a think-aloud solution.",
                    answer_key="Solution should include the major steps and rational justification.",
                    remediation="Break the task into micro-steps, model the first one, then have the learner continue.",
                ),
                on_success="Offer a celebratory recap and outline how the next stage will extend the concept.",
                on_failure="Return to the misconception, model a corrected approach, and retry the quiz with a similar prompt.",
            ),
            TutorLearningStage(
                name="Stage 3",
                focus="Extension and transfer",
                objectives=[
                    "Challenge the learner with an open-ended question",
                    "Encourage them to plan future practice or projects",
                ],
                prerequisites=["Stage 2 passed"],
                pass_criteria=[
                    "Learner proposes a creative application or extension",
                    "Learner self-identifies next steps or lingering questions",
                ],
                quiz=TutorStageQuiz(
                    prompt="Ask the learner to design a mini-quiz for someone else on this topic.",
                    answer_key="Should include accurate questions and expected answers that reflect deep understanding.",
                    remediation="Collaboratively draft one quiz question together, then let the learner complete the set.",
                ),
                on_success="Wrap up with the completion plan and encourage autonomy.",
                on_failure="Diagnose gaps, revisit relevant prior stages, and co-create the quiz before another attempt.",
            ),
        ]

        return TutorModeResponse(
            model=self.model,
            generated_at=datetime.now(timezone.utc),
            topic=payload.topic,
            learner_profile=learner_profile,
            objectives=objectives,
            understanding=understanding,
            concept_breakdown=concept_breakdown,
            teaching_modalities=modalities,
            assessment=assessment,
            completion=completion,
            conversation_manager=conversation_manager,
            learning_stages=learning_stages,
        )
