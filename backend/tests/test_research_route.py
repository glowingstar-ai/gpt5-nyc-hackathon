from fastapi.testclient import TestClient

from app.api.dependencies import get_research_service
from app.main import app
from app.services.research import (
    ResearchResult,
    ResearchResultsEvent,
    ResearchStepEvent,
)


class StubResearchService:
    async def stream_search(self, query: str, max_results: int):
        yield ResearchStepEvent(
            type="step",
            step_id="expand",
            status="started",
            message="Expanding query",
            payload={"expansions": ["test expansion"]},
        )
        yield ResearchStepEvent(
            type="step",
            step_id="expand",
            status="completed",
            message="Expansion complete",
            payload={"expansions": ["test expansion"]},
        )
        yield ResearchResultsEvent(
            type="results",
            results=[
                ResearchResult(
                    paper_id="1234.56789",
                    title="Example Paper",
                    summary="Summary",
                    url="https://arxiv.org/abs/1234.56789",
                    published="2024-01-01",
                    relevance=0.95,
                    justification="Because it matches your query.",
                )
            ],
        )


def test_research_route_streams_events():
    original = app.dependency_overrides.get(get_research_service)
    app.dependency_overrides[get_research_service] = lambda: StubResearchService()

    try:
        with TestClient(app) as client:
            with client.stream(
                "POST",
                "/api/v1/research/discover",
                json={"query": "test", "max_results": 1},
            ) as response:
                body = "".join(response.iter_text())

        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        assert "expanding query" in body.lower()
        assert "example paper" in body.lower()
    finally:
        if original is not None:
            app.dependency_overrides[get_research_service] = original
        else:
            app.dependency_overrides.pop(get_research_service, None)
