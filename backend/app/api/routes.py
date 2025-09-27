from fastapi import APIRouter, Depends

from app.api.dependencies import get_settings
from app.core.config import Settings
from app.schemas.health import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return basic service health information."""

    return HealthResponse(
        status="ok",
        service=settings.project_name,
        environment=settings.environment,
    )
