import json
from pathlib import Path
from typing import Any

import httpx
import pytest

from app.services.research import (
    ResearchDiscoveryService,
    ResearchResultsEvent,
    ResearchStepEvent,
)


class FakeResponse:
    def __init__(self, payload: dict[str, Any]) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:  # pragma: no cover - no-op
        return None

    def json(self) -> dict[str, Any]:
        return self._payload


class FakeAsyncClient:
    def __init__(self, *args: Any, **kwargs: Any) -> None:  # pragma: no cover - fixture use
        self._args = args
        self._kwargs = kwargs

    async def __aenter__(self) -> "FakeAsyncClient":
        return self

    async def __aexit__(self, *args: Any) -> None:  # pragma: no cover - fixture use
        return None

    async def post(self, url: str, json: dict[str, Any], headers: dict[str, str]):
        if url.endswith("/chat/completions"):
            user_message = json["messages"][1]["content"]
            if "Expanded search intents" in user_message:
                payload = {
                    "choices": [
                        {
                            "message": {
                                "content": "quantum advantage benchmarking\nnoise-aware algorithms\nerror-mitigated variational solvers",
                            }
                        }
                    ]
                }
            else:
                title_line = user_message.split("Paper title: ")[-1].split("\n")[0]
                payload = {
                    "choices": [
                        {
                            "message": {
                                "content": f"{title_line} is relevant because it advances quantum advantage research.",
                            }
                        }
                    ]
                }
            return FakeResponse(payload)
        if "cohere.com" in url:
            documents = json["documents"]
            payload = {
                "results": [
                    {"index": idx, "relevance_score": 1.0 - idx * 0.1}
                    for idx, _ in enumerate(documents)
                ]
            }
            return FakeResponse(payload)
        raise AssertionError(f"Unexpected URL {url}")


def test_stream_search_produces_ranked_results(monkeypatch, tmp_path):
    import asyncio

    index_path = tmp_path / "arxiv.json"
    index_path.write_text(
        json.dumps(
            [
                {
                    "paper_id": "2007.09876",
                    "title": "Quantum Advantage in Noisy Intermediate-Scale Quantum Devices",
                    "summary": "Survey of algorithms demonstrating quantum advantage with mitigation techniques.",
                    "url": "https://arxiv.org/abs/2007.09876",
                    "published": "2020-07-20",
                },
                {
                    "paper_id": "2301.00001",
                    "title": "Scaling Instruction-Following with Large Language Models",
                    "summary": "Alignment strategies for large models.",
                    "url": "https://arxiv.org/abs/2301.00001",
                    "published": "2023-01-01",
                },
            ]
        )
    )

    monkeypatch.setattr(httpx, "AsyncClient", FakeAsyncClient)

    service = ResearchDiscoveryService(
        api_key="test-key",
        base_url="https://api.openai.com/v1",
        model="gpt-5.0",
        cohere_api_key="cohere-key",
        cohere_model="rerank-test",
        index_path=index_path,
    )

    async def _collect() -> list[object]:
        events: list[object] = []
        async for event in service.stream_search("quantum advantage techniques", max_results=1):
            events.append(event)
        return events

    events = asyncio.run(_collect())

    assert isinstance(events[0], ResearchStepEvent)
    assert events[0].step_id == "expand"
    assert isinstance(events[-1], ResearchResultsEvent)
    final_event = events[-1]
    assert len(final_event.results) == 1
    top_result = final_event.results[0]
    assert top_result.paper_id == "2007.09876"
    assert "quantum advantage" in top_result.justification.lower()
