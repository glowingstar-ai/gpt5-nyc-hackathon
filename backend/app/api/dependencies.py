from functools import lru_cache

from fastapi import HTTPException

from app.core.config import Settings, get_settings as _get_settings
from app.services.auth import Auth0Client, Auth0ConfigurationError
from app.services.emotion import EmotionAnalyzer
from app.services.payments import StripePaymentProcessor, StripeConfigurationError
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


@lru_cache
def _get_auth_client() -> Auth0Client:
    settings = _get_settings()
    try:
        return Auth0Client(
            domain=settings.auth0_domain or "",
            client_id=settings.auth0_client_id or "",
            client_secret=settings.auth0_client_secret or "",
            audience=settings.auth0_audience,
            default_redirect_uri=settings.auth0_default_redirect_uri,
        )
    except Auth0ConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def get_auth_client() -> Auth0Client:
    """Return a configured Auth0 client or raise if misconfigured."""

    client = _get_auth_client()
    if not client:
        raise HTTPException(status_code=503, detail="Authentication service unavailable")
    return client


@lru_cache
def _get_payment_processor() -> StripePaymentProcessor:
    settings = _get_settings()
    try:
        return StripePaymentProcessor(
            api_key=settings.stripe_api_key or "",
            default_price_id=settings.stripe_default_price_id,
            default_success_url=settings.stripe_success_url,
            default_cancel_url=settings.stripe_cancel_url,
        )
    except StripeConfigurationError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


def get_payment_processor() -> StripePaymentProcessor:
    """Return a configured Stripe payment processor or raise if misconfigured."""

    processor = _get_payment_processor()
    if not processor:
        raise HTTPException(status_code=503, detail="Payment service unavailable")
    return processor
