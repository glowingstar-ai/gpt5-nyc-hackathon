from fastapi.testclient import TestClient

from app.main import app


PAYLOAD = {
    "topic": "Neural Networks",
    "student_level": "Beginner programmer transitioning into ML",
    "goals": ["Understand core building blocks", "Implement a simple network"],
    "preferred_modalities": ["visual", "interactive"],
}


def test_tutor_manager_dispatches_agents() -> None:
    """Tutor mode manager should return a roster of agent outputs."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/mode", json=PAYLOAD)

    assert response.status_code == 200
    data = response.json()

    assert data["model"] == "gpt-5"
    assert data["topic"] == PAYLOAD["topic"]
    assert "GPT-5 Tutor Manager" in data["manager"]["name"]
    assert len(data["manager"]["priorities"]) >= 3

    agent_ids = {agent["id"] for agent in data["agents"]}
    assert agent_ids == {"curriculum", "assessment", "practice", "coach"}

    for agent in data["agents"]:
        assert agent["status"] == "completed"
        assert agent["payload"], f"Expected payload for agent {agent['id']}"


def test_curriculum_agent_sessions_are_structured() -> None:
    """Curriculum agent should return multiple staged sessions."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/curriculum", json=PAYLOAD)

    assert response.status_code == 200
    data = response.json()

    assert data["topic"] == PAYLOAD["topic"]
    assert data["summary"]
    assert len(data["sessions"]) >= 3
    assert data["sessions"][0]["objectives"]


def test_assessment_agent_includes_answer_key() -> None:
    """Assessment agent provides graded questions with answers."""

    with TestClient(app) as client:
        response = client.post("/api/v1/tutor/assessment", json=PAYLOAD)

    assert response.status_code == 200
    data = response.json()

    assert data["title"].lower().startswith(PAYLOAD["topic"].split()[0].lower())
    assert data["questions"], "Expected assessment questions"
    assert all(question["answer"] for question in data["questions"])


def test_practice_and_coach_agents_have_guidance() -> None:
    """Practice and coaching agents offer actionable steps."""

    with TestClient(app) as client:
        practice_response = client.post("/api/v1/tutor/practice", json=PAYLOAD)
        coach_response = client.post("/api/v1/tutor/coach", json=PAYLOAD)

    assert practice_response.status_code == 200
    practice = practice_response.json()
    assert practice["warmups"]
    assert practice["sprints"]

    assert coach_response.status_code == 200
    coach = coach_response.json()
    assert coach["onboarding_message"]
    assert len(coach["check_ins"]) >= 3
