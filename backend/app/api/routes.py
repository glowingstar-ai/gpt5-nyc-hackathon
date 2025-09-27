import base64
import binascii
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import HttpUrl

from app.api.dependencies import (
    get_auth_client,
    get_audio_storage,
    get_emotion_analyzer,
    get_note_annotator,
    get_payment_service,
    get_realtime_client,
    get_settings,
    get_tutor_service,
)
from app.core.config import Settings
from app.schemas.auth import (
    AuthCallbackRequest,
    AuthLoginResponse,
    AuthTokenResponse,
    AuthUserInfoResponse,
)
from app.schemas.emotion import EmotionAnalysisRequest, EmotionAnalysisResponse
from app.schemas.health import HealthResponse
from app.schemas.payment import PaymentCheckoutRequest, PaymentCheckoutResponse
from app.schemas.realtime import (
    RealtimeSessionToken,
    VisionFrameRequest,
    VisionFrameResponse,
)
from app.schemas.note import NoteCreateRequest, NoteCreateResponse
from app.schemas.tutor import TutorModeRequest, TutorModeResponse
from app.services.auth import Auth0Client, Auth0ClientError
from app.services.emotion import EmotionAnalyzer
from app.services.note import NoteAnnotator, NoteAnnotationError
from app.services.payment import StripePaymentError, StripePaymentService
from app.services.realtime import RealtimeSessionClient, RealtimeSessionError
from app.services.storage import S3AudioStorage, StorageServiceError
from app.services.tutor import TutorModeService

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["health"])
async def health_check(settings: Settings = Depends(get_settings)) -> HealthResponse:
    """Return basic service health information."""

    return HealthResponse(
        status="ok",
        service=settings.project_name,
        environment=settings.environment,
    )


@router.get("/auth/login", response_model=AuthLoginResponse, tags=["auth"])
async def auth_login(
    redirect_uri: HttpUrl = Query(..., description="Redirect URI configured in Auth0"),
    state: str | None = Query(None, description="Opaque state passed back after login"),
    scope: str | None = Query(None, description="Optional override for OAuth scopes"),
    audience: str | None = Query(None, description="Optional override for the API audience"),
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthLoginResponse:
    """Return the Auth0 hosted login page URL."""

    url = auth_client.build_authorize_url(
        redirect_uri=str(redirect_uri),
        state=state,
        scope=scope,
        audience=audience,
    )
    return AuthLoginResponse(authorization_url=url)


@router.post("/auth/callback", response_model=AuthTokenResponse, tags=["auth"])
async def auth_callback(
    payload: AuthCallbackRequest,
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthTokenResponse:
    """Exchange an Auth0 authorization code for access tokens."""

    try:
        tokens = await auth_client.exchange_code_for_tokens(
            code=payload.code,
            redirect_uri=str(payload.redirect_uri),
        )
    except Auth0ClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return AuthTokenResponse(
        access_token=tokens.access_token,
        token_type=tokens.token_type,
        expires_in=tokens.expires_in,
        scope=tokens.scope,
        id_token=tokens.id_token,
        refresh_token=tokens.refresh_token,
    )


@router.get("/auth/user", response_model=AuthUserInfoResponse, tags=["auth"])
async def auth_user_info(
    authorization: str = Header(..., alias="Authorization"),
    auth_client: Auth0Client = Depends(get_auth_client),
) -> AuthUserInfoResponse:
    """Return the authenticated user's profile by calling Auth0's userinfo endpoint."""

    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=401, detail="Authorization header must contain a Bearer token"
        )

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Bearer token is missing")

    try:
        profile = await auth_client.get_user_info(token)
    except Auth0ClientError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    claims = {
        key: value
        for key, value in profile.raw.items()
        if key not in {"sub", "email", "name", "picture"}
    }

    return AuthUserInfoResponse(
        sub=profile.sub,
        email=profile.email,
        name=profile.name,
        picture=profile.picture,
        claims=claims,
    )


@router.post("/emotion/analyze", response_model=EmotionAnalysisResponse, tags=["emotion"])
async def analyze_emotion(
    payload: EmotionAnalysisRequest,
    analyzer: EmotionAnalyzer = Depends(get_emotion_analyzer),
) -> EmotionAnalysisResponse:
    """Analyze multi-modal signals and return an emotion profile."""

    return analyzer.analyze(payload)


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


@router.post("/notes", response_model=NoteCreateResponse, tags=["notes"])
async def create_note(
    payload: NoteCreateRequest,
    storage: S3AudioStorage = Depends(get_audio_storage),
    annotator: NoteAnnotator = Depends(get_note_annotator),
) -> NoteCreateResponse:
    """Persist a note and request an annotated summary."""

    audio_url: str | None = None
    if payload.audio_base64:
        try:
            audio_bytes = base64.b64decode(payload.audio_base64, validate=True)
        except (binascii.Error, ValueError) as exc:
            raise HTTPException(status_code=400, detail="Invalid base64-encoded audio clip") from exc

        try:
            upload = storage.upload_audio(audio_bytes, payload.audio_mime_type)
        except StorageServiceError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

        audio_url = upload.url

    try:
        annotation = await annotator.annotate(
            title=payload.title,
            content=payload.content,
            audio_url=audio_url,
        )
    except NoteAnnotationError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    created_at = datetime.now(timezone.utc)

    return NoteCreateResponse(
        note_id=str(uuid4()),
        title=payload.title,
        content=payload.content,
        audio_url=audio_url,
        annotation=annotation.content,
        created_at=created_at,
    )


@router.post("/payments/checkout", response_model=PaymentCheckoutResponse, tags=["payments"])
async def create_checkout_session(
    payload: PaymentCheckoutRequest,
    payment_service: StripePaymentService = Depends(get_payment_service),
) -> PaymentCheckoutResponse:
    """Create a Stripe Checkout session for the client to complete payment."""

    try:
        session = payment_service.create_checkout_session(
            success_url=str(payload.success_url),
            cancel_url=str(payload.cancel_url),
            price_id=payload.price_id,
            quantity=payload.quantity,
            customer_email=payload.customer_email,
        )
    except StripePaymentError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return PaymentCheckoutResponse(session_id=session.session_id, checkout_url=session.url)


@router.post("/tutor/mode", response_model=TutorModeResponse, tags=["tutor"])
async def create_tutor_mode_plan(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorModeResponse:
    """Create a BabyAGI-inspired tutoring plan powered by GPT-5."""

    return await tutor_service.generate_plan(payload)
