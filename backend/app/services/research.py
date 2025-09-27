"""Research discovery service that performs RAG over an ArXiv corpus."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import AsyncIterator, Literal
import json
import math

import httpx


class ResearchServiceError(RuntimeError):
    """Raised when the research discovery pipeline fails."""


@dataclass(slots=True)
class ArxivPaper:
    """Metadata for a single ArXiv paper."""

    paper_id: str
    title: str
    summary: str
    url: str
    published: str

    def to_document(self) -> str:
        """Return a formatted document string for scoring and LLM prompts."""

        return f"{self.title}\n{self.summary}"


@dataclass(slots=True)
class CandidateMatch:
    """A retrieval candidate with heuristic and rerank scores."""

    paper: ArxivPaper
    retrieval_score: float
    rerank_score: float | None = None


@dataclass(slots=True)
class ResearchResult:
    """A final research recommendation returned to the client."""

    paper_id: str
    title: str
    summary: str
    url: str
    published: str
    relevance: float
    justification: str


@dataclass(slots=True)
class ResearchStepEvent:
    """Represents progress for a pipeline step."""

    type: Literal["step"]
    step_id: str
    status: Literal["started", "completed", "failed"]
    message: str
    payload: dict | None = None


@dataclass(slots=True)
class ResearchResultsEvent:
    """Carries the final ranked results."""

    type: Literal["results"]
    results: list[ResearchResult]


ResearchEvent = ResearchStepEvent | ResearchResultsEvent


class ResearchDiscoveryService:
    """Run a retrieval-augmented search workflow over a local ArXiv index."""

    def __init__(
        self,
        *,
        api_key: str,
        base_url: str,
        model: str,
        cohere_api_key: str,
        cohere_model: str,
        index_path: str | Path,
        max_context_chars: int = 1200,
    ) -> None:
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._model = model
        self._cohere_api_key = cohere_api_key
        self._cohere_model = cohere_model
        self._index_path = Path(index_path)
        self._max_context_chars = max_context_chars
        self._papers = self._load_index(self._index_path)

    async def stream_search(
        self, query: str, *, max_results: int = 3
    ) -> AsyncIterator[ResearchEvent]:
        """Stream pipeline events as the research workflow runs."""

        if not query.strip():
            raise ResearchServiceError("Query must not be empty")

        yield ResearchStepEvent(
            type="step",
            step_id="expand",
            status="started",
            message="Expanding the research query with GPT-5",
        )
        expansions = await self._expand_query(query)
        yield ResearchStepEvent(
            type="step",
            step_id="expand",
            status="completed",
            message="Generated expanded search intents",
            payload={"expansions": expansions},
        )

        yield ResearchStepEvent(
            type="step",
            step_id="retrieve",
            status="started",
            message="Retrieving relevant ArXiv passages",
        )
        candidates = self._retrieve_candidates(query, expansions, limit=max_results * 4)
        yield ResearchStepEvent(
            type="step",
            step_id="retrieve",
            status="completed",
            message=f"Retrieved {len(candidates)} candidate papers",
            payload={
                "candidates": [
                    {
                        "paper_id": match.paper.paper_id,
                        "title": match.paper.title,
                        "score": match.retrieval_score,
                    }
                    for match in candidates
                ]
            },
        )

        yield ResearchStepEvent(
            type="step",
            step_id="rank",
            status="started",
            message="Reranking candidates with Cohere",
        )
        ranked = await self._rerank_candidates(query, candidates)
        yield ResearchStepEvent(
            type="step",
            step_id="rank",
            status="completed",
            message="Ranked candidates with semantic similarity",
            payload={
                "ranking": [
                    {
                        "paper_id": match.paper.paper_id,
                        "score": match.rerank_score,
                    }
                    for match in ranked
                ]
            },
        )

        yield ResearchStepEvent(
            type="step",
            step_id="explain",
            status="started",
            message="Using GPT-5 to explain relevance",
        )
        final_results: list[ResearchResult] = []
        for match in ranked[:max_results]:
            justification = await self._explain_relevance(query, match.paper)
            final_results.append(
                ResearchResult(
                    paper_id=match.paper.paper_id,
                    title=match.paper.title,
                    summary=match.paper.summary,
                    url=match.paper.url,
                    published=match.paper.published,
                    relevance=match.rerank_score or 0.0,
                    justification=justification,
                )
            )
        yield ResearchStepEvent(
            type="step",
            step_id="explain",
            status="completed",
            message="Prepared relevance explanations",
        )

        yield ResearchResultsEvent(type="results", results=final_results)

    def _load_index(self, path: Path) -> list[ArxivPaper]:
        if not path.exists():
            raise ResearchServiceError(
                f"ArXiv index not found at {path}. Provide ARXIV_INDEX_PATH env variable."
            )

        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError as exc:  # pragma: no cover - invalid data
            raise ResearchServiceError("ArXiv index file is not valid JSON") from exc

        papers: list[ArxivPaper] = []
        for item in data:
            try:
                papers.append(
                    ArxivPaper(
                        paper_id=item["paper_id"],
                        title=item["title"],
                        summary=item["summary"],
                        url=item["url"],
                        published=item.get("published", ""),
                    )
                )
            except KeyError as exc:  # pragma: no cover - invalid data
                raise ResearchServiceError(
                    "ArXiv index entry is missing required fields"
                ) from exc
        if not papers:
            raise ResearchServiceError("ArXiv index is empty")
        return papers

    async def _expand_query(self, query: str) -> list[str]:
        system_prompt = (
            "You are a research librarian assisting with academic literature searches. "
            "Expand the user's query into three diverse search intents that include synonyms, "
            "related methods, and adjacent application areas. Return each intent on a new line."
        )
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "Original query:\n" + query.strip() + "\n\nExpanded search intents:"
                    ),
                },
            ],
            "temperature": 0.2,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/chat/completions", json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors
                raise ResearchServiceError("Failed to expand query with GPT-5") from exc
        data = response.json()
        try:
            content: str = data["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as exc:
            raise ResearchServiceError("Unexpected response from GPT-5 query expansion") from exc

        lines = [line.strip("- ") for line in content.splitlines() if line.strip()]
        expansions = [line for line in lines if line]
        if not expansions:
            expansions = [query.strip()]
        return expansions[:5]

    def _retrieve_candidates(
        self, query: str, expansions: list[str], *, limit: int
    ) -> list[CandidateMatch]:
        tokens_sets = [self._tokenize(query)] + [self._tokenize(item) for item in expansions]

        candidates: list[CandidateMatch] = []
        for paper in self._papers:
            doc_tokens = self._tokenize(paper.to_document())
            score = 0.0
            for q_tokens in tokens_sets:
                if not q_tokens:
                    continue
                overlap = len(doc_tokens & q_tokens)
                score += overlap / math.sqrt(len(doc_tokens) * len(q_tokens)) if doc_tokens else 0.0
            if score > 0:
                candidates.append(CandidateMatch(paper=paper, retrieval_score=score))

        candidates.sort(key=lambda match: match.retrieval_score, reverse=True)
        return candidates[:limit]

    async def _rerank_candidates(
        self, query: str, candidates: list[CandidateMatch]
    ) -> list[CandidateMatch]:
        if not candidates:
            return []

        payload = {
            "model": self._cohere_model,
            "query": query,
            "documents": [
                {
                    "id": match.paper.paper_id,
                    "text": self._clip_document(match.paper.to_document()),
                    "metadata": {
                        "title": match.paper.title,
                        "url": match.paper.url,
                    },
                }
                for match in candidates
            ],
        }
        headers = {
            "Authorization": f"Bearer {self._cohere_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    "https://api.cohere.com/v1/rerank", json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors
                raise ResearchServiceError("Failed to rerank candidates with Cohere") from exc

        data = response.json()
        try:
            results = data["results"]
        except (KeyError, TypeError) as exc:
            raise ResearchServiceError("Unexpected response from Cohere rerank API") from exc

        scores: dict[int, float] = {}
        for entry in results:
            try:
                index = entry["index"]
                score = float(entry.get("relevance_score", 0.0))
            except (TypeError, KeyError, ValueError) as exc:
                raise ResearchServiceError(
                    "Cohere rerank response contained invalid entries"
                ) from exc
            scores[index] = score

        for idx, match in enumerate(candidates):
            match.rerank_score = scores.get(idx, 0.0)

        candidates.sort(key=lambda match: match.rerank_score or 0.0, reverse=True)
        return candidates

    async def _explain_relevance(self, query: str, paper: ArxivPaper) -> str:
        system_prompt = (
            "You are a research assistant. Explain in two sentences why the following ArXiv paper "
            "is relevant to the user's query. Reference specific concepts from the summary."
        )
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": (
                        "User query: "
                        + query.strip()
                        + "\n\nPaper title: "
                        + paper.title
                        + "\nSummary: "
                        + paper.summary
                    ),
                },
            ],
            "temperature": 0.4,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.post(
                    f"{self._base_url}/chat/completions", json=payload, headers=headers
                )
                response.raise_for_status()
            except httpx.HTTPError as exc:  # pragma: no cover - network errors
                raise ResearchServiceError("Failed to explain relevance with GPT-5") from exc
        data = response.json()
        try:
            return data["choices"][0]["message"]["content"].strip()
        except (KeyError, IndexError, TypeError) as exc:
            raise ResearchServiceError("Unexpected response from GPT-5 relevance explainer") from exc

    def _clip_document(self, document: str) -> str:
        if len(document) <= self._max_context_chars:
            return document
        return document[: self._max_context_chars] + "…"

    def _tokenize(self, text: str) -> set[str]:
        cleaned = "".join(ch.lower() if ch.isalnum() else " " for ch in text)
        return {token for token in cleaned.split() if token}


__all__ = [
    "ArxivPaper",
    "CandidateMatch",
    "ResearchDiscoveryService",
    "ResearchEvent",
    "ResearchResult",
    "ResearchResultsEvent",
    "ResearchServiceError",
    "ResearchStepEvent",
]
