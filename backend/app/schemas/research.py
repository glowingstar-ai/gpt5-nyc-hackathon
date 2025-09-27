"""Schemas for the research discovery API."""

from pydantic import BaseModel, Field


class ResearchQueryRequest(BaseModel):
    """Request payload for discovering relevant research papers."""

    query: str = Field(..., min_length=1, description="Description of the desired research paper")
    max_results: int = Field(
        default=3,
        ge=1,
        le=5,
        description="Maximum number of ranked papers to return",
    )


class ResearchResultPayload(BaseModel):
    """Single research result returned to the client UI."""

    paper_id: str
    title: str
    summary: str
    url: str
    published: str | None = None
    relevance: float
    justification: str


__all__ = [
    "ResearchQueryRequest",
    "ResearchResultPayload",
]
