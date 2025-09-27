import base64
import binascii
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException

from app.api.dependencies import (
    get_auth_client,
    get_emotion_analyzer,
    get_payment_processor,
    get_realtime_client,
    get_settings,
)
from app.core.config import Settings
from app.schemas.auth import (
    AuthLoginRequest,
    AuthLoginResponse,
    AuthTokenExchangeRequest,
    AuthTokenResponse,
    AuthUserInfo,
)
from app.schemas.emotion import EmotionAnalysisRequest, EmotionAnalysisResponse
from app.schemas.health import HealthResponse
from app.schemas.payments import CheckoutSessionRequest, CheckoutSessionResponse
from app.schemas.realtime import (
    RealtimeSessionToken,
    VisionFrameRequest,
    VisionFrameResponse,
)
from app.services.auth import Auth0Client, Auth0Error
from app.services.emotion import EmotionAnalyzer
from app.services.payments import StripePaymentError, StripePaymentProcessor
from app.services.realtime import RealtimeSessionClient, RealtimeSessionError

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


@router.post("/auth/login", response_model=AuthLoginResponse, tags=["auth"])
async def start_login(
    payload: AuthLoginRequest,
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthLoginResponse:
    """Generate an Auth0 authorization URL for the hosted login page."""

    try:
        url = auth_client.build_authorization_url(
            redirect_uri=payload.redirect_uri,
            state=payload.state,
            prompt=payload.prompt,
            screen_hint=payload.screen_hint,
            scope=payload.scope,
        )
    except Auth0Error as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AuthLoginResponse(authorization_url=url)


@router.post("/auth/callback", response_model=AuthTokenResponse, tags=["auth"])
async def complete_login(
    payload: AuthTokenExchangeRequest,
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthTokenResponse:
    """Exchange an Auth0 authorization code for tokens."""

    try:
        tokens = await auth_client.exchange_code_for_tokens(
            code=payload.code,
            redirect_uri=payload.redirect_uri,
            code_verifier=payload.code_verifier,
        )
    except Auth0Error as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return AuthTokenResponse(
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        refresh_token=tokens.refresh_token,
        id_token=tokens.id_token,
        scope=tokens.scope,
    )


@router.get("/auth/userinfo", response_model=AuthUserInfo, tags=["auth"])
async def fetch_user_info(
    authorization: str = Header(..., alias="Authorization"),
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthUserInfo:
    """Fetch the Auth0 user profile for the provided access token."""

    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token:
        raise HTTPException(status_code=401, detail="Bearer access token required")

    try:
        payload = await auth_client.get_user_info(token)
    except Auth0Error as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc

    return AuthUserInfo.model_validate(payload)


@router.post("/realtime/session", response_model=RealtimeSessionToken, tags=["realtime"])
async def create_realtime_session(
    client: RealtimeSessionClient = Depends(get_realtime_client),
) -> RealtimeSessionToken:
    """Return an ephemeral client secret for establishing WebRTC sessions."""

    try:
        session = await client.create_ephemeral_session()
    except RealtimeSessionError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return RealtimeSessionToken(
        session_id=session.session_id,
        client_secret=session.client_secret,
        expires_at=session.expires_at,
        model=session.model,
        url=session.handshake_url,
        voice=session.voice,
    )


@router.post("/vision/frame", response_model=VisionFrameResponse, tags=["vision"])
async def accept_vision_frame(payload: VisionFrameRequest) -> VisionFrameResponse:
    """Accept a base64-encoded frame from the client camera feed."""

    try:
        decoded = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64-encoded image") from exc

    received_at = datetime.now(timezone.utc)

    return VisionFrameResponse(
        status="accepted",
        bytes=len(decoded),
        captured_at=payload.captured_at,
        received_at=received_at,
    )


@router.post(
    "/payments/checkout",
    response_model=CheckoutSessionResponse,
    tags=["payments"],
)
async def create_checkout_session(
    payload: CheckoutSessionRequest,
    processor: StripePaymentProcessor = Depends(get_payment_processor),
) -> CheckoutSessionResponse:
    """Create a Stripe Checkout session and return the redirect URL."""

    try:
        session = await processor.create_checkout_session(
            price_id=payload.price_id,
            quantity=payload.quantity,
            success_url=payload.success_url,
            cancel_url=payload.cancel_url,
            customer_email=payload.customer_email,
            mode=payload.mode,
        )
    except StripePaymentError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return CheckoutSessionResponse(
        session_id=session.session_id,
        checkout_url=session.url,
    )
