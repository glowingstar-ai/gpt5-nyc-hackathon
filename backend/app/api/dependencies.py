from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings as _get_settings
from app.services.auth import Auth0Client
from app.services.emotion import EmotionAnalyzer
from app.services.generative_ui import GenerativeUIService
from app.services.journal import JournalCoach
from app.services.note import NoteAnnotator
from app.services.transcription import AudioTranscriber
from app.services.payment import StripePaymentService
from app.services.realtime import RealtimeSessionClient
from app.services.research import ResearchDiscoveryService
from app.services.storage import S3AudioStorage, StorageServiceError
from app.services.tutor import (
    TutorAssessmentAgent,
    TutorCoachAgent,
    TutorCurriculumAgent,
    TutorModeService,
    TutorPracticeAgent,
)
from app.services.context_storage import get_context_storage
from app.services.vision import VisionAnalyzer


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
def _get_vision_analyzer() -> VisionAnalyzer:
    """Return a singleton vision analyzer configured for GPT-5."""

    settings = _get_settings()
    if not settings.openai_api_key:
        raise ValueError("Vision analysis is not configured")

    return VisionAnalyzer(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model=settings.openai_vision_model,
    )


def get_vision_analyzer() -> VisionAnalyzer:
    """FastAPI dependency for the vision analyzer."""

    try:
        return _get_vision_analyzer()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


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


@lru_cache
def _get_audio_transcriber() -> AudioTranscriber:
    settings = _get_settings()
    if not settings.openai_api_key:
        raise ValueError("Transcription service is not configured")

    return AudioTranscriber(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model=settings.openai_transcription_model,
    )


def get_audio_transcriber() -> AudioTranscriber:
    """Return the configured OpenAI audio transcription client."""

    try:
        return _get_audio_transcriber()
    except ValueError as exc:
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


def get_generative_ui_service() -> GenerativeUIService:
    """Provide the GPT-5 powered generative UI assistant."""

    settings = _get_settings()
    if not settings.openai_api_key:
        raise HTTPException(status_code=503, detail="Generative UI service is not configured")

    return GenerativeUIService(
        api_key=settings.openai_api_key,
        base_url=settings.openai_api_base_url,
        model=settings.openai_generative_ui_model,
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
def _get_curriculum_agent() -> TutorCurriculumAgent:
    settings = _get_settings()
    return TutorCurriculumAgent(model=settings.openai_generative_ui_model or "gpt-5")


def get_curriculum_agent() -> TutorCurriculumAgent:
    """Expose the curriculum agent for dependency injection."""

    return _get_curriculum_agent()


@lru_cache
def _get_assessment_agent() -> TutorAssessmentAgent:
    settings = _get_settings()
    return TutorAssessmentAgent(model=settings.openai_generative_ui_model or "gpt-5")


def get_assessment_agent() -> TutorAssessmentAgent:
    """Expose the assessment agent for dependency injection."""

    return _get_assessment_agent()


@lru_cache
def _get_practice_agent() -> TutorPracticeAgent:
    settings = _get_settings()
    return TutorPracticeAgent(model=settings.openai_generative_ui_model or "gpt-5")


def get_practice_agent() -> TutorPracticeAgent:
    """Expose the practice agent for dependency injection."""

    return _get_practice_agent()


@lru_cache
def _get_coach_agent() -> TutorCoachAgent:
    settings = _get_settings()
    return TutorCoachAgent(model=settings.openai_generative_ui_model or "gpt-5")


def get_coach_agent() -> TutorCoachAgent:
    """Expose the coaching agent for dependency injection."""

    return _get_coach_agent()


@lru_cache
def _get_tutor_service() -> TutorModeService:
    """Return a singleton tutor manager assembled from sub-agents."""

    settings = _get_settings()
    return TutorModeService(
        model=settings.openai_generative_ui_model or "gpt-5",
        curriculum_agent=_get_curriculum_agent(),
        assessment_agent=_get_assessment_agent(),
        practice_agent=_get_practice_agent(),
        coach_agent=_get_coach_agent(),
    )


def get_tutor_service() -> TutorModeService:
    """FastAPI dependency wrapper around the tutor manager singleton."""

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


