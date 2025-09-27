"""Research discovery service orchestrating query expansion, retrieval, and ranking."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from typing import Any
from xml.etree import ElementTree

import httpx

from app.schemas.research import ResearchPaperSummary


@dataclass(slots=True)
class ArxivPaper:
    """Internal representation of an arXiv entry."""

    paper_id: str
    title: str
    summary: str
    url: str
    published_at: datetime | None
    authors: list[str]

    def to_summary(self, *, score: float | None = None, reason: str | None = None) -> ResearchPaperSummary:
        """Convert the internal paper to an API schema."""

        return ResearchPaperSummary(
            paper_id=self.paper_id,
            title=self.title,
            summary=self.summary,
            url=self.url,
            published_at=self.published_at,
            authors=self.authors,
            score=score,
            reason=reason,
        )


class ResearchDiscoveryService:
    """Coordinate a lightweight RAG flow across OpenAI, arXiv, and Cohere."""

    def __init__(
        self,
        *,
        openai_api_key: str | None,
        openai_base_url: str,
        openai_model: str,
        cohere_api_key: str | None,
        cohere_base_url: str,
        cohere_model: str,
        arxiv_api_url: str,
        arxiv_max_results: int = 25,
        timeout: float = 30.0,
    ) -> None:
        self.openai_api_key = openai_api_key
        self.openai_base_url = openai_base_url.rstrip("/")
        self.openai_model = openai_model
        self.cohere_api_key = cohere_api_key
        self.cohere_base_url = cohere_base_url.rstrip("/")
        self.cohere_model = cohere_model
        self.arxiv_api_url = arxiv_api_url
        self.arxiv_max_results = arxiv_max_results
        self.timeout = timeout

    async def expand_query(self, query: str) -> list[str]:
        """Use GPT-5 to expand the user's query into related search intents."""

        if not self.openai_api_key:
            raise RuntimeError("OpenAI API key is not configured")

        prompt = (
            "You are a research assistant helping a user search arXiv. "
            "Generate 3 to 5 alternative phrasings or related keywords that "
            "would be useful when searching for papers about the following description. "
            "Return a JSON object with an 'expansions' field containing the list of strings.\n\n"
            f"Description: {query}"
        )
        body: dict[str, Any] = {
            "model": self.openai_model,
            "input": prompt,
            "response_format": {"type": "json_object"},
        }
        response = await self._post_openai(body)
        data = self._extract_json(response)
        expansions = data.get("expansions") if isinstance(data, dict) else None
        if not expansions or not isinstance(expansions, list):
            return [query]
        cleaned = [item.strip() for item in expansions if isinstance(item, str) and item.strip()]
        return cleaned or [query]

    async def retrieve_papers(self, queries: list[str]) -> list[ArxivPaper]:
        """Retrieve candidate papers from the arXiv API for each expanded query."""

        seen: dict[str, ArxivPaper] = {}
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            for phrase in queries:
                params = {
                    "search_query": f"all:{phrase}",
                    "start": 0,
                    "max_results": self.arxiv_max_results,
                    "sortBy": "relevance",
                }
                response = await client.get(self.arxiv_api_url, params=params, headers={"Accept": "application/atom+xml"})
                response.raise_for_status()
                for paper in self._parse_arxiv_feed(response.text):
                    if paper.paper_id not in seen:
                        seen[paper.paper_id] = paper
        return list(seen.values())

    async def rank_papers(
        self, *, query: str, papers: list[ArxivPaper], top_k: int
    ) -> list[tuple[ArxivPaper, float]]:
        """Use Cohere re-ranking to score the candidate papers."""

        if not self.cohere_api_key:
            raise RuntimeError("Cohere API key is not configured")
        if not papers:
            return []

        documents = [
            {
                "id": paper.paper_id,
                "text": f"{paper.title}\n\n{paper.summary}",
            }
            for paper in papers
        ]
        payload = {
            "model": self.cohere_model,
            "query": query,
            "documents": documents,
            "top_n": min(top_k, len(documents)),
        }
        headers = {
            "Authorization": f"Bearer {self.cohere_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.cohere_base_url}/v1/rerank", headers=headers, json=payload
            )
        response.raise_for_status()
        data = response.json()
        results: list[tuple[ArxivPaper, float]] = []
        for item in data.get("results", []):
            try:
                index = int(item.get("index"))
            except (TypeError, ValueError):
                continue
            if index < 0 or index >= len(papers):
                continue
            score_raw = item.get("relevance_score")
            try:
                score = float(score_raw)
            except (TypeError, ValueError):
                score = 0.0
            results.append((papers[index], score))
        results.sort(key=lambda pair: pair[1], reverse=True)
        return results[:top_k]

    async def explain_relevance(self, *, query: str, paper: ArxivPaper) -> str:
        """Ask GPT-5 to summarise why the paper matters for the query."""

        if not self.openai_api_key:
            raise RuntimeError("OpenAI API key is not configured")

        prompt = (
            "You are assisting a researcher reviewing arXiv papers. "
            "Given the user's description and the paper metadata, explain in 2 concise "
            "sentences why this paper is relevant. Focus on concrete overlaps in methods, "
            "findings, or applications."
            "\n\nUser description:\n"
            f"{query}\n"
            "\nPaper title:\n"
            f"{paper.title}\n"
            "\nPaper summary:\n"
            f"{paper.summary}\n"
            "\nRespond with polished prose."
        )
        body: dict[str, Any] = {
            "model": self.openai_model,
            "input": prompt,
        }
        response = await self._post_openai(body)
        return self._extract_text(response)

    async def explain_many(
        self, *, query: str, papers: list[tuple[ArxivPaper, float]]
    ) -> list[tuple[ArxivPaper, float, str]]:
        """Explain relevance for each ranked paper sequentially."""

        results: list[tuple[ArxivPaper, float, str]] = []
        for paper, score in papers:
            reason = await self.explain_relevance(query=query, paper=paper)
            results.append((paper, score, reason))
        return results

    async def orchestrate(
        self,
        *,
        query: str,
        top_k: int,
    ) -> list[ResearchPaperSummary]:
        """Convenience helper to execute the full pipeline without streaming."""

        expansions = await self.expand_query(query)
        papers = await self.retrieve_papers(expansions)
        ranked = await self.rank_papers(query=query, papers=papers, top_k=top_k)
        explained = await self.explain_many(query=query, papers=ranked)
        return [paper.to_summary(score=score, reason=reason) for paper, score, reason in explained]

    async def _post_openai(self, body: dict[str, Any]) -> dict[str, Any]:
        headers = {
            "Authorization": f"Bearer {self.openai_api_key}",
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.openai_base_url}/responses", headers=headers, json=body
            )
        response.raise_for_status()
        return response.json()

    @staticmethod
    def _extract_json(response: dict[str, Any]) -> dict[str, Any]:
        """Try to extract a JSON object from the OpenAI Responses payload."""

        if not isinstance(response, dict):
            return {}
        if "output" in response:
            for item in response.get("output", []):
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "output_text" and isinstance(item.get("text"), str):
                    try:
                        return json.loads(item["text"])
                    except json.JSONDecodeError:
                        continue
                content = item.get("content")
                if isinstance(content, list):
                    for block in content:
                        if (
                            isinstance(block, dict)
                            and block.get("type") in {"output_text", "text"}
                            and isinstance(block.get("text"), str)
                        ):
                            try:
                                return json.loads(block["text"])
                            except json.JSONDecodeError:
                                continue
        for key in ("output_text", "text"):
            raw = response.get(key)
            if isinstance(raw, str):
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    continue
        return {}

    @staticmethod
    def _extract_text(response: dict[str, Any]) -> str:
        """Extract plain text from a Responses API payload."""

        if not isinstance(response, dict):
            return ""
        if "output" in response:
            for item in response.get("output", []):
                if not isinstance(item, dict):
                    continue
                if item.get("type") == "output_text" and isinstance(item.get("text"), str):
                    return item["text"].strip()
                content = item.get("content")
                if isinstance(content, list):
                    for block in content:
                        if (
                            isinstance(block, dict)
                            and block.get("type") in {"output_text", "text"}
                            and isinstance(block.get("text"), str)
                        ):
                            return block["text"].strip()
        for key in ("output_text", "text", "response"):
            raw = response.get(key)
            if isinstance(raw, str):
                return raw.strip()
        return ""

    @staticmethod
    def _parse_arxiv_feed(payload: str) -> list[ArxivPaper]:
        """Parse an Atom XML feed returned by arXiv."""

        ns = {"atom": "http://www.w3.org/2005/Atom"}
        try:
            root = ElementTree.fromstring(payload)
        except ElementTree.ParseError:
            return []
        papers: list[ArxivPaper] = []
        for entry in root.findall("atom:entry", ns):
            paper_id = ResearchDiscoveryService._text(entry.find("atom:id", ns))
            title = ResearchDiscoveryService._clean_text(
                ResearchDiscoveryService._text(entry.find("atom:title", ns))
            )
            summary = ResearchDiscoveryService._clean_text(
                ResearchDiscoveryService._text(entry.find("atom:summary", ns))
            )
            link = ""
            for link_node in entry.findall("atom:link", ns):
                if link_node.get("rel") == "alternate" and link_node.get("href"):
                    link = link_node.get("href")
                    break
            published_raw = ResearchDiscoveryService._text(entry.find("atom:published", ns))
            published_at = None
            if published_raw:
                try:
                    published_at = datetime.fromisoformat(published_raw.replace("Z", "+00:00"))
                except ValueError:
                    published_at = None
            authors = [
                ResearchDiscoveryService._clean_text(ResearchDiscoveryService._text(author.find("atom:name", ns)))
                for author in entry.findall("atom:author", ns)
            ]
            if not paper_id:
                continue
            papers.append(
                ArxivPaper(
                    paper_id=paper_id,
                    title=title,
                    summary=summary,
                    url=link or paper_id,
                    published_at=published_at,
                    authors=[author for author in authors if author],
                )
            )
        return papers

    @staticmethod
    def _text(node: ElementTree.Element | None) -> str:
        return (node.text or "").strip() if node is not None else ""

    @staticmethod
    def _clean_text(value: str) -> str:
        return " ".join(value.split())

