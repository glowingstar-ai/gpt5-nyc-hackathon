from fastapi.testclient import TestClient

from app.main import app


def _payload() -> dict[str, object]:
    return {
        "topic": "Neural Networks",
        "student_level": "Beginner programmer transitioning into ML",
        "goals": ["Understand core building blocks", "Implement a simple network"],
        "preferred_modalities": ["visual", "interactive"],
        "additional_context": "Wants to build a side project in 4 weeks",
    }


def test_tutor_manager_routes_agents() -> None:
    """The manager route should describe every specialist agent."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/mode", json=_payload())

    assert response.status_code == 200
    data = response.json()

    assert data["topic"] == "Neural Networks"
    assert data["summary"]
    assert data["agenda"], "Expected manager agenda to be populated"

    agent_ids = {agent["id"] for agent in data["agents"]}
    assert {"curriculum", "workshop", "assessment"}.issubset(agent_ids)


def test_curriculum_agent_returns_sections() -> None:
    """Curriculum strategist should provide a multi-stage roadmap."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/curriculum", json=_payload())

    assert response.status_code == 200
    data = response.json()

    assert data["overview"], "Overview should explain the roadmap"
    sections = data["sections"]
    assert isinstance(sections, list) and len(sections) >= 3
    for section in sections:
        assert section["learning_goals"], "Each section needs learning goals"
        assert section["activities"], "Each section needs activities"
        assert section["assessment"], "Each section needs a mastery check"


def test_workshop_agent_outlines_segments() -> None:
    """Workshop designer should structure a live session."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/workshop", json=_payload())

    assert response.status_code == 200
    data = response.json()

    segments = data["segments"]
    assert isinstance(segments, list) and len(segments) >= 3
    for segment in segments:
        assert segment["flow"], "Segments should describe the facilitation flow"
        assert segment["reflection_prompts"], "Segments should include reflection prompts"


def test_assessment_agent_provides_answer_keys() -> None:
    """Assessment architect should return answer keys for every question."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/assessment", json=_payload())

    assert response.status_code == 200
    data = response.json()

    questions = data["questions"]
    assert isinstance(questions, list) and questions
    for question in questions:
        assert question["answer"], "Every question needs an answer or rubric"
        assert question["rationale"], "Each answer should explain the reasoning"
