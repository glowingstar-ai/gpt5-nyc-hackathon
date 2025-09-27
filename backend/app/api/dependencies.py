from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings as _get_settings
from app.services.emotion import EmotionAnalyzer
from app.services.realtime import RealtimeSessionClient


def get_settings() -> Settings:
    """Dependency wrapper for injecting cached settings into routes."""

    return _get_settings()


@lru_cache
def _get_emotion_analyzer() -> EmotionAnalyzer:
    """Return a singleton instance of the emotion analyzer."""

    return EmotionAnalyzer()


def get_emotion_analyzer() -> EmotionAnalyzer:
    """FastAPI dependency that reuses the analyzer instance."""

    return _get_emotion_analyzer()


def get_realtime_client() -> RealtimeSessionClient:
    """Return a configured realtime session client or raise if missing secrets."""

    settings = _get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Realtime API is not configured")

    return RealtimeSessionClient(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model=settings.openai_realtime_model,
        voice=settings.openai_realtime_voice,
        instructions=settings.openai_realtime_instructions,
    )
