"""Tutor mode orchestration powered by GPT-5 (with graceful fallbacks)."""

from __future__ import annotations

from datetime import datetime, timezone
from textwrap import dedent
from typing import Any

import httpx

from app.schemas.tutor import (
    TutorAssessmentItem,
    TutorAssessmentPlan,
    TutorCompletionPlan,
    TutorConceptBreakdown,
    TutorModeRequest,
    TutorModeResponse,
    TutorTeachingModality,
    TutorUnderstandingPlan,
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

    async def _call_openai(self, payload: TutorModeRequest) -> dict[str, Any]:
        """Invoke the OpenAI Responses API requesting a JSON plan."""

        prompt = dedent(
            f"""
            You are BabyAGI operating in tutor mode and powered by {self.model}. The
            student profile is described below. Produce a tutoring game plan as JSON
            following the `tutor_plan` schema.

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
                "signals_to_watch": string array
              }},
              "concept_breakdown": array of {{
                "concept": string,
                "llm_reasoning": string,
                "subtopics": string array,
                "real_world_connections": string array
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
              }}
            }}

            Ensure the plan emphasises human-in-the-loop checkpoints.
            """
        ).strip()

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body: dict[str, Any] = {
            "model": self.model,
            "input": prompt,
            "response_format": {"type": "json_object"},
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
        )
