from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings as _get_settings
from app.services.auth import Auth0Client
from app.services.emotion import EmotionAnalyzer
from app.services.journal import JournalCoach
from app.services.note import NoteAnnotator
from app.services.payment import StripePaymentService
from app.services.realtime import RealtimeSessionClient
from app.services.research import ResearchDiscoveryService
from app.services.storage import S3AudioStorage, StorageServiceError
from app.services.tutor import TutorModeService
from app.services.vision import VisionAnalyzer
from app.services.context_storage import get_context_storage


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


def get_journal_coach() -> JournalCoach:
    """Return a configured journaling coach client."""

    settings = _get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Journaling service is not configured")

    return JournalCoach(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model=settings.openai_annotation_model,
    )


@lru_cache
def _get_research_service() -> ResearchDiscoveryService:
    settings = _get_settings()
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key is not configured for research discovery")
    if not settings.cohere_api_key:
        raise ValueError("Cohere API key is not configured for research discovery")

    return ResearchDiscoveryService(
        openai_api_key=settings.openai_api_key,
        openai_base_url=settings.openai_api_base_url,
        openai_model=settings.openai_research_model,
        cohere_api_key=settings.cohere_api_key,
        cohere_base_url=settings.cohere_api_base_url,
        cohere_model=settings.cohere_rerank_model,
        arxiv_api_url=settings.arxiv_api_base_url,
        arxiv_max_results=settings.arxiv_max_results,
    )


def get_research_service() -> ResearchDiscoveryService:
    """FastAPI dependency that provides the research discovery orchestrator."""

    try:
        return _get_research_service()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


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


@lru_cache
def _get_auth_client() -> Auth0Client:
    settings = _get_settings()
    if not settings.auth0_domain or not settings.auth0_client_id:
        raise ValueError("Auth0 is not configured")

    return Auth0Client(
        domain=settings.auth0_domain,
        client_id=settings.auth0_client_id,
        client_secret=settings.auth0_client_secret,
        audience=settings.auth0_audience,
    )


def get_auth_client() -> Auth0Client:
    """Return an Auth0 client instance if the integration is configured."""

    try:
        return _get_auth_client()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@lru_cache
def _get_payment_service() -> StripePaymentService:
    settings = _get_settings()
    if not settings.stripe_secret_key:
        raise ValueError("Stripe secret key is not configured")

    return StripePaymentService(
        api_key=settings.stripe_secret_key,
        default_price_id=settings.stripe_default_price_id,
        mode=settings.stripe_mode,
    )


def get_payment_service() -> StripePaymentService:
    """Return a configured Stripe payment service instance."""

    try:
        return _get_payment_service()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@lru_cache
def _get_vision_analyzer() -> VisionAnalyzer:
    """Return a singleton vision analyzer instance."""
    
    settings = _get_settings()
    if not settings.openai_api_key:
        raise ValueError("OpenAI API key is not configured for vision analysis")
    
    return VisionAnalyzer(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model="gpt-4o",
    )


def get_vision_analyzer() -> VisionAnalyzer:
    """FastAPI dependency that provides the vision analyzer."""
    
    try:
        return _get_vision_analyzer()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
