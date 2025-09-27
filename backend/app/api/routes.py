from fastapi import APIRouter, Depends

from app.api.dependencies import get_emotion_analyzer, get_settings
from app.core.config import Settings
from app.schemas.emotion import EmotionAnalysisRequest, EmotionAnalysisResponse
from app.schemas.health import HealthResponse
from app.services.emotion import EmotionAnalyzer

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return basic service health information."""

    return HealthResponse(
        status="ok",
        service=settings.project_name,
        environment=settings.environment,
    )


@router.post("/emotion/analyze", response_model=EmotionAnalysisResponse, tags=["emotion"])
async def analyze_emotion(
    payload: EmotionAnalysisRequest,
    analyzer: EmotionAnalyzer = Depends(get_emotion_analyzer),
) -> EmotionAnalysisResponse:
    """Analyze multi-modal signals and return an emotion profile."""

    return analyzer.analyze(payload)
