"""Schemas for the research discovery endpoint."""

from datetime import datetime

from pydantic import BaseModel, Field


class ResearchSearchRequest(BaseModel):
    """Payload accepted by the research discovery route."""

    query: str = Field(..., min_length=3, description="Free-form description of the desired paper")
    top_k: int | None = Field(
        default=5,
        ge=1,
        le=10,
        description="Maximum number of ranked results to return",
    )


class ResearchPaperSummary(BaseModel):
    """Basic information about an arXiv paper."""

    paper_id: str = Field(..., description="Canonical arXiv identifier")
    title: str
    summary: str
    url: str
    published_at: datetime | None = Field(default=None, description="Publication timestamp")
    authors: list[str] = Field(default_factory=list)
    score: float | None = Field(default=None, description="Relevance score from re-ranking")
    reason: str | None = Field(
        default=None,
        description="Why the paper is relevant to the search query",
    )
