import base64
import binascii
import json
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import HttpUrl

from app.api.dependencies import (
    get_auth_client,
    get_audio_storage,
    get_emotion_analyzer,
    get_journal_coach,
    get_note_annotator,
    get_payment_service,
    get_realtime_client,
    get_research_service,
    get_settings,
    get_tutor_service,
    get_vision_analyzer,
    get_context_storage,
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

from app.schemas.journal import JournalEntryRequest, JournalEntryResponse
from app.schemas.research import ResearchPaperSummary, ResearchSearchRequest
from app.schemas.note import NoteCreateRequest, NoteCreateResponse
from app.schemas.tutor import TutorModeRequest, TutorModeResponse
from app.services.auth import Auth0Client, Auth0ClientError
from app.services.emotion import EmotionAnalyzer
from app.services.journal import JournalCoach, JournalCoachError
from app.services.note import NoteAnnotator, NoteAnnotationError
from app.services.payment import StripePaymentError, StripePaymentService
from app.services.realtime import RealtimeSessionClient, RealtimeSessionError
from app.services.research import ResearchDiscoveryService
from app.services.storage import S3AudioStorage, StorageServiceError
from app.services.tutor import TutorModeService
from app.services.vision import VisionAnalyzer, VisionAnalysisError
from app.services.context_storage import ContextStorage

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
    context_storage: ContextStorage = Depends(get_context_storage),
) -> RealtimeSessionToken:
    """Return an ephemeral client secret for establishing WebRTC sessions with visual context."""

    # Get the most recent visual context
    recent_context = None
    for session_id in list(context_storage._storage.keys()):
        context = context_storage.get_context(session_id)
        if context and (recent_context is None or context.timestamp > recent_context.timestamp):
            recent_context = context

    # Enhance instructions with visual context if available
    enhanced_instructions = None
    if recent_context:
        enhanced_instructions = f"""You are an AI assistant that can see and understand the user's current screen context. 

Current visual context:
- Description: {recent_context.description}
- Key elements: {', '.join(recent_context.key_elements)}
- User intent: {recent_context.user_intent or 'Not specified'}
- Actionable items: {', '.join(recent_context.actionable_items)}

Use this visual context to provide more relevant and helpful responses. You can reference what you see on their screen, help them with tasks they're working on, or answer questions about the content they're viewing. Be specific about what you observe and how you can assist them with their current activity."""

    try:
        # Create a new client with enhanced instructions
        enhanced_client = RealtimeSessionClient(
            api_key=client.api_key,
            base_url=client.base_url,
            model=client.model,
            voice=client.voice,
            instructions=enhanced_instructions or client.instructions,
            timeout=client.timeout,
        )
        
        session = await enhanced_client.create_ephemeral_session()
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
async def accept_vision_frame(
    payload: VisionFrameRequest,
    analyzer: VisionAnalyzer = Depends(get_vision_analyzer),
    context_storage: ContextStorage = Depends(get_context_storage),
) -> VisionFrameResponse:
    """Accept a base64-encoded frame from the client camera or UI surface and analyze it."""

    try:
        decoded = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64-encoded image") from exc

    received_at = datetime.now(timezone.utc)

    # Analyze the screenshot for context
    try:
        context = await analyzer.analyze_screenshot(
            image_base64=payload.image_base64,
            source=payload.source,
            captured_at=payload.captured_at,
        )
        
        # Store context for potential use in realtime conversations
        # Use a session ID based on timestamp for now (in production, use actual session ID)
        session_id = f"session_{int(received_at.timestamp())}"
        context_storage.store_context(session_id, context)
        
    except VisionAnalysisError as exc:
        # Log the error but don't fail the request
        print(f"Vision analysis failed: {exc}")

    return VisionFrameResponse(
        status="accepted",
        bytes=len(decoded),
        captured_at=payload.captured_at,
        received_at=received_at,
        source=payload.source,
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


@router.post("/journals", response_model=JournalEntryResponse, tags=["journals"])
async def create_journal_entry(
    payload: JournalEntryRequest,
    coach: JournalCoach = Depends(get_journal_coach),
) -> JournalEntryResponse:
    """Transform a free-form journal entry into guided reflections."""

    try:
        guidance = await coach.guide(
            title=payload.title,
            entry=payload.entry,
            mood=payload.mood,
            gratitude=payload.gratitude,
            intention=payload.intention,
            focus_area=payload.focus_area,
        )
    except JournalCoachError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    created_at = datetime.now(timezone.utc)

    return JournalEntryResponse(
        journal_id=str(uuid4()),
        created_at=created_at,
        title=payload.title,
        entry=payload.entry,
        mood=payload.mood,
        gratitude=payload.gratitude,
        intention=payload.intention,
        focus_area=payload.focus_area,
        ai_reflection=guidance.reflection,
        affirmation=guidance.affirmation,
        suggested_prompts=guidance.prompts,
        breathing_exercise=guidance.breathwork,
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


def _encode_event(payload: dict[str, object]) -> str:
    """Return a JSONL-safe representation of a streaming event."""

    return json.dumps(payload, separators=(",", ":")) + "\n"


@router.post(
    "/research/discover",
    response_model=None,
    tags=["research"],
    summary="Discover relevant arXiv papers with a streamed RAG workflow",
)
async def discover_research_papers(
    payload: ResearchSearchRequest,
    service: ResearchDiscoveryService = Depends(get_research_service),
) -> StreamingResponse:
    """Stream the reasoning trail for a research discovery request."""

    top_k = payload.top_k or 5

    async def event_stream():
        try:
            yield _encode_event(
                {
                    "type": "status",
                    "stage": "expanding_query",
                    "message": "Expanding your description with GPT-5",
                }
            )
            expansions = await service.expand_query(payload.query)
            yield _encode_event(
                {
                    "type": "expansion",
                    "stage": "expanding_query",
                    "message": "Generated expanded search intents",
                    "expansions": expansions,
                }
            )

            yield _encode_event(
                {
                    "type": "status",
                    "stage": "retrieving_candidates",
                    "message": "Querying arXiv for candidate papers",
                }
            )
            candidates = await service.retrieve_papers(expansions)
            yield _encode_event(
                {
                    "type": "retrieval",
                    "stage": "retrieving_candidates",
                    "message": f"Retrieved {len(candidates)} unique arXiv candidates",
                    "count": len(candidates),
                }
            )

            yield _encode_event(
                {
                    "type": "status",
                    "stage": "ranking",
                    "message": "Ranking candidates with Cohere's re-ranker",
                }
            )
            ranked = await service.rank_papers(
                query=payload.query, papers=candidates, top_k=top_k
            )
            ranked_summaries = [
                paper.to_summary(score=score).model_dump(mode="json")
                for paper, score in ranked
            ]
            yield _encode_event(
                {
                    "type": "ranking",
                    "stage": "ranking",
                    "message": "Identified the strongest matches",
                    "total_candidates": len(candidates),
                    "results": ranked_summaries,
                }
            )

            enriched: list[ResearchPaperSummary] = []
            for paper, score in ranked:
                yield _encode_event(
                    {
                        "type": "status",
                        "stage": "explaining",
                        "message": f"Explaining relevance for {paper.title}",
                        "paper_id": paper.paper_id,
                    }
                )
                reason = await service.explain_relevance(query=payload.query, paper=paper)
                summary = paper.to_summary(score=score, reason=reason)
                enriched.append(summary)
                yield _encode_event(
                    {
                        "type": "explanation",
                        "stage": "explaining",
                        "paper_id": paper.paper_id,
                        "reason": reason,
                    }
                )

            yield _encode_event(
                {
                    "type": "results",
                    "stage": "complete",
                    "message": "Finished building the research digest",
                    "results": [item.model_dump(mode="json") for item in enriched],
                }
            )
        except Exception as exc:  # pragma: no cover - defensive streaming guard
            yield _encode_event(
                {
                    "type": "error",
                    "stage": "error",
                    "message": str(exc),
                }
            )

    return StreamingResponse(event_stream(), media_type="application/jsonl")
