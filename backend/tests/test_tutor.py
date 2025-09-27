from fastapi.testclient import TestClient

from app.main import app


def test_tutor_mode_offline_plan_structure() -> None:
    """Tutor mode returns a rich plan even without an OpenAI API key."""

    payload = {
        "topic": "Neural Networks",
        "student_level": "Beginner programmer transitioning into ML",
        "goals": ["Understand core building blocks", "Implement a simple network"],
        "preferred_modalities": ["visual", "interactive"],
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/mode", json=payload)

    assert response.status_code == 200
    data = response.json()

    assert data["model"] == "gpt-5"
    assert data["topic"] == payload["topic"]
    assert data["learner_profile"]
    assert data["objectives"]

    understanding = data["understanding"]
    assert understanding["diagnostic_questions"], "Expected diagnostic questions in plan"

    concepts = data["concept_breakdown"]
    assert isinstance(concepts, list) and len(concepts) >= 1
    assert concepts[0]["llm_reasoning"]

    modalities = data["teaching_modalities"]
    assert {modality["modality"] for modality in modalities} >= {"visual", "interactive", "verbal"}

    assessment = data["assessment"]
    assert assessment["human_in_the_loop_notes"]
    assert any(item["kind"] == "practical" for item in assessment["items"])

    completion = data["completion"]
    assert completion["mastery_indicators"]
    assert completion["follow_up_suggestions"]
