from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings as _get_settings
from app.services.emotion import EmotionAnalyzer
from app.services.note import NoteAnnotator
from app.services.realtime import RealtimeSessionClient
from app.services.storage import S3AudioStorage, StorageServiceError
from app.services.tutor import TutorModeService


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


@lru_cache
def _get_audio_storage() -> S3AudioStorage:
    settings = _get_settings()
    return S3AudioStorage(settings)


def get_audio_storage() -> S3AudioStorage:
    """Return the configured audio storage backend."""

    try:
        return _get_audio_storage()
    except StorageServiceError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def get_note_annotator() -> NoteAnnotator:
    """Return a configured note annotation client."""

    settings = _get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Annotation service is not configured")

    return NoteAnnotator(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model=settings.openai_annotation_model,
    )


@lru_cache
def _get_tutor_service() -> TutorModeService:
    """Return a singleton tutor mode service configured from settings."""

    settings = _get_settings()
    return TutorModeService(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model="gpt-5",
    )


def get_tutor_service() -> TutorModeService:
    """FastAPI dependency wrapper around the tutor service singleton."""

    return _get_tutor_service()
