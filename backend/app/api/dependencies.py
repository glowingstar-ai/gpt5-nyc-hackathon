from functools import lru_cache

from app.core.config import Settings, get_settings as _get_settings
from app.services.emotion import EmotionAnalyzer


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
