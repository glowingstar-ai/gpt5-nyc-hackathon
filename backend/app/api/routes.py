import base64
import binascii
import json
import os
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import HttpUrl

from app.api.dependencies import (
    get_auth_client,
    get_audio_transcriber,
    # get_audio_storage,  # Commented out AWS S3 for now
    get_context_storage,
    get_emotion_analyzer,
    get_generative_ui_service,
    get_journal_coach,
    get_note_annotator,
    get_payment_service,
    get_realtime_client,
    get_research_service,
    get_settings,
    get_tutor_service,
    get_vision_analyzer,
)
from app.core.config import Settings
from app.schemas.auth import (
    AuthCallbackRequest,
    AuthLoginResponse,
    AuthTokenResponse,
    AuthUserInfoResponse,
)
from app.schemas.emotion import EmotionAnalysisRequest, EmotionAnalysisResponse
from app.schemas.generative_ui import GenerativeUIRequest, GenerativeUIResponse
from app.schemas.health import HealthResponse
from app.schemas.payment import PaymentCheckoutRequest, PaymentCheckoutResponse
from app.schemas.realtime import (
    HighlightInstruction as HighlightInstructionSchema,
    RealtimeSessionToken,
    VisionFrameRequest,
    VisionFrameResponse,
)

from app.schemas.journal import JournalEntryRequest, JournalEntryResponse
from app.schemas.research import ResearchPaperSummary, ResearchSearchRequest
from app.schemas.note import NoteCreateRequest, NoteCreateResponse
from app.schemas.tutor import (
    TutorAssessmentResponse,
    TutorCoachResponse,
    TutorCurriculumResponse,
    TutorManagerResponse,
    TutorModalitiesResponse,
    TutorModeRequest,
)
from app.services.auth import Auth0Client, Auth0ClientError
from app.services.emotion import EmotionAnalyzer
from app.services.generative_ui import (
    GenerativeUIService,
    GenerativeUIServiceError,
    ThemeSuggestion,
)
from app.services.journal import JournalCoach, JournalCoachError
from app.services.note import NoteAnnotator, NoteAnnotationError
from app.services.transcription import AudioTranscriber, AudioTranscriptionError
from app.services.payment import StripePaymentError, StripePaymentService
from app.services.realtime import RealtimeSessionClient, RealtimeSessionError
from app.services.research import ResearchDiscoveryService
# from app.services.storage import S3AudioStorage, StorageServiceError  # Commented out AWS S3 for now
from app.services.tutor import TutorModeService
from app.services.vision import (
    VisionAnalysisError,
    VisionAnalyzer,
    VisionContext,
)
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
    recent_context = context_storage.get_latest_context()

    # Enhance instructions with visual context if available
    enhanced_instructions = None
    latest_frame_base64: str | None = None
    highlight_payload: list[HighlightInstructionSchema] | None = None
    if recent_context:
        latest_frame_base64 = recent_context.image_base64

        summary_lines = []
        if recent_context.description and recent_context.description.strip():
            summary_lines.append(f"- Description: {recent_context.description.strip()}")

        if recent_context.key_elements:
            key_elements = [
                element.strip()
                for element in recent_context.key_elements
                if element and element.strip()
            ]
            if key_elements:
                summary_lines.append("- Key elements: " + ", ".join(key_elements))

        if recent_context.user_intent and recent_context.user_intent.strip():
            summary_lines.append(f"- User intent: {recent_context.user_intent.strip()}")

        if recent_context.actionable_items:
            actionable_items = [
                item.strip()
                for item in recent_context.actionable_items
                if item and item.strip()
            ]
            if actionable_items:
                summary_lines.append("- Actionable items: " + ", ".join(actionable_items))

        if recent_context.dom_summary and recent_context.dom_summary.strip():
            summary_lines.append("- DOM summary: " + recent_context.dom_summary.strip())

        if recent_context.highlight_instructions:
            highlight_payload = [
                HighlightInstructionSchema(
                    selector=instruction.selector,
                    action=instruction.action,
                    reason=instruction.reason,
                )
                for instruction in recent_context.highlight_instructions
            ]
            if highlight_payload:
                highlight_overview = ", ".join(
                    f"{item.selector}{f' ({item.reason})' if item.reason else ''}"
                    for item in highlight_payload
                )
                summary_lines.append("- Highlight candidates: " + highlight_overview)

        if not summary_lines:
            summary_lines.append(
                "- Visual analysis metadata is unavailable. Request additional processing if you need structured details."
            )

        context_summary = "\n".join(summary_lines)

        enhanced_instructions = f"""You are an AI assistant that can see and understand the user's current screen context.

Visual context summary:
{context_summary}

A raw base64-encoded frame captured by the client is available for immediate multimodal processing.

When responding to the user, you MUST reply with valid JSON using this schema:

{{
  "answer": "Helpful natural-language response to the user",
  "highlights": [
    {{"selector": "CSS selector from the DOM digest", "action": "highlight", "reason": "Why it matters"}}
  ]
}}

Return an empty array for "highlights" if nothing should be highlighted. Do not include Markdown or additional prose outside the JSON.

Use this visual context to provide more relevant and helpful responses. You can reference what you see on their screen, help them with tasks they're working on, or answer questions about the content they're viewing. Be specific about what you observe and how you can assist them with their current activity."""

        if recent_context.dom_snapshot:
            enhanced_instructions += "\n\nDOM digest (JSON):\n" + recent_context.dom_snapshot

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
        latest_frame_base64=latest_frame_base64,
        dom_summary=recent_context.dom_summary if recent_context else None,
        dom_snapshot=recent_context.dom_snapshot if recent_context else None,
        highlight_instructions=highlight_payload,
    )


@router.post("/vision/frame", response_model=VisionFrameResponse, tags=["vision"])
async def accept_vision_frame(
    payload: VisionFrameRequest,
    context_storage: ContextStorage = Depends(get_context_storage),
    analyzer: VisionAnalyzer = Depends(get_vision_analyzer),
) -> VisionFrameResponse:
    """Accept a base64-encoded frame from the client camera or UI surface."""

    try:
        decoded = base64.b64decode(payload.image_base64, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise HTTPException(status_code=400, detail="Invalid base64-encoded image") from exc

    received_at = datetime.now(timezone.utc)

    # Save the image to the backend folder for debugging/visualization
    try:
        # Create images directory if it doesn't exist
        images_dir = os.path.join(os.path.dirname(__file__), "..", "..", "captured_images")
        os.makedirs(images_dir, exist_ok=True)
        
        # Generate filename with timestamp and source
        timestamp_str = received_at.strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Include milliseconds
        filename = f"frame_{timestamp_str}_{payload.source}.jpg"
        filepath = os.path.join(images_dir, filename)
        
        # Save the decoded image
        with open(filepath, "wb") as f:
            f.write(decoded)
            
        print(f"Saved captured image to: {filepath}")
        
    except Exception as exc:
        # Don't fail the request if image saving fails, just log it
        print(f"Failed to save image: {exc}")

    # Analyze the frame with GPT-5 to extract semantic context and highlight instructions
    try:
        context = await analyzer.analyze_screenshot(
            payload.image_base64,
            source=payload.source,
            captured_at=payload.captured_at,
            dom_snapshot=payload.dom_snapshot,
        )
    except VisionAnalysisError as exc:
        print(f"Vision analysis failed: {exc}")
        context = VisionContext(
            description="Raw frame capture (analysis unavailable)",
            key_elements=[],
            user_intent=None,
            actionable_items=[],
            timestamp=received_at,
            source=payload.source,
            image_base64=payload.image_base64,
            captured_at=payload.captured_at,
            dom_snapshot=payload.dom_snapshot,
            dom_summary=None,
            highlight_instructions=[],
        )

    # Use a session ID based on timestamp for now (in production, use actual session ID)
    session_id = f"session_{int(received_at.timestamp())}"
    context_storage.store_context(session_id, context)

    return VisionFrameResponse(
        status="accepted",
        bytes=len(decoded),
        captured_at=payload.captured_at,
        received_at=received_at,
        source=payload.source,
        description=context.description,
        dom_summary=context.dom_summary,
        highlight_instructions=[
            HighlightInstructionSchema(
                selector=instruction.selector,
                action=instruction.action,
                reason=instruction.reason,
            )
            for instruction in context.highlight_instructions
        ]
        or None,
    )


@router.post("/notes", response_model=NoteCreateResponse, tags=["notes"])
async def create_note(
    payload: NoteCreateRequest,
    # storage: S3AudioStorage = Depends(get_audio_storage),  # Commented out AWS S3 for now
    annotator: NoteAnnotator = Depends(get_note_annotator),
) -> NoteCreateResponse:
    """Persist a note and request an annotated summary."""

    audio_url: str | None = None
    # Commented out AWS S3 audio upload functionality for now
    # if payload.audio_base64:
    #     try:
    #         audio_bytes = base64.b64decode(payload.audio_base64, validate=True)
    #     except (binascii.Error, ValueError) as exc:
    #         raise HTTPException(status_code=400, detail="Invalid base64-encoded audio clip") from exc

    #     try:
    #         upload = storage.upload_audio(audio_bytes, payload.audio_mime_type)
    #     except StorageServiceError as exc:
    #         raise HTTPException(status_code=502, detail=str(exc)) from exc

    #     audio_url = upload.url

    try:
        polished_notes = await annotator.annotate(
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
        content=polished_notes.content,  # Use polished notes as the main content
        audio_url=audio_url,
        annotation=payload.content,  # Keep original notes as annotation for reference
        created_at=created_at,
    )


@router.post("/notes/annotate", response_model=None, tags=["notes"])
async def stream_note_annotation(
    payload: NoteCreateRequest,
    # storage: S3AudioStorage = Depends(get_audio_storage),  # Commented out AWS S3 for now
    annotator: NoteAnnotator = Depends(get_note_annotator),
    transcriber: AudioTranscriber = Depends(get_audio_transcriber),
) -> StreamingResponse:
    """Stream the full note annotation workflow."""

    async def event_stream():
        annotation_chunks: list[str] = []
        audio_bytes: bytes | None = None
        audio_url: str | None = None
        transcript_text: str | None = None

        try:
            yield _encode_event(
                {
                    "type": "status",
                    "stage": "initializing",
                    "message": "Preparing to polish your notes with GPT-5",
                }
            )

            # Commented out AWS S3 audio upload functionality for now
            # if payload.audio_base64:
            #     try:
            #         audio_bytes = base64.b64decode(payload.audio_base64, validate=True)
            #     except (binascii.Error, ValueError) as exc:
            #         raise ValueError("Invalid base64-encoded audio clip") from exc

            # if audio_bytes:
            #     yield _encode_event(
            #         {
            #             "type": "status",
            #             "stage": "transcribing",
            #             "message": "Converting your voice memo to text",
            #         }
            #     )

            #     try:
            #         transcription = await transcriber.transcribe(audio_bytes, payload.audio_mime_type)
            #     except AudioTranscriptionError as exc:
            #         raise RuntimeError(str(exc)) from exc

            #     transcript_text = transcription.text
            #     yield _encode_event(
            #         {
            #             "type": "transcript",
            #             "stage": "transcribing",
            #             "text": transcript_text,
            #         }
            #     )

            #     try:
            #         upload = storage.upload_audio(audio_bytes, payload.audio_mime_type)
            #         audio_url = upload.url
            #         yield _encode_event(
            #             {
            #                 "type": "status",
            #                 "stage": "uploading",
            #                 "message": "Stored your voice memo securely",
            #             }
            #         )
            #     except StorageServiceError as exc:
            #         raise RuntimeError(str(exc)) from exc

            yield _encode_event(
                {
                    "type": "status",
                    "stage": "annotating",
                    "message": "Polishing your notes with GPT-5",
                }
            )

            try:
                async for delta in annotator.stream_annotation(
                    title=payload.title,
                    content=payload.content,
                    audio_url=audio_url,
                    transcript=transcript_text,
                ):
                    if delta:
                        if isinstance(delta, dict):
                            # Handle new format with reasoning
                            if delta.get("type") == "reasoning":
                                yield _encode_event(
                                    {
                                        "type": "reasoning_delta",
                                        "stage": "reasoning",
                                        "delta": delta["content"],
                                    }
                                )
                            elif delta.get("type") == "content":
                                annotation_chunks.append(delta["content"])
                                yield _encode_event(
                                    {
                                        "type": "annotation_delta",
                                        "stage": "annotating",
                                        "delta": delta["content"],
                                    }
                                )
                        else:
                            # Handle old format (backward compatibility)
                            annotation_chunks.append(delta)
                            yield _encode_event(
                                {
                                    "type": "annotation_delta",
                                    "stage": "annotating",
                                    "delta": delta,
                                }
                            )
            except NoteAnnotationError as exc:
                raise RuntimeError(str(exc)) from exc

            annotation_text = "".join(annotation_chunks).strip()
            if not annotation_text:
                try:
                    fallback = await annotator.annotate(
                        title=payload.title,
                        content=payload.content,
                        audio_url=audio_url,
                        transcript=transcript_text,
                    )
                except NoteAnnotationError as exc:
                    raise RuntimeError(str(exc)) from exc
                annotation_text = fallback.content
            created_at = datetime.now(timezone.utc)
            note = NoteCreateResponse(
                note_id=str(uuid4()),
                title=payload.title,
                content=annotation_text,  # Use polished notes as the main content
                audio_url=audio_url,
                annotation=payload.content,  # Keep original notes as annotation for reference
                created_at=created_at,
            )

            yield _encode_event(
                {
                    "type": "note_saved",
                    "stage": "complete",
                    "note": note.model_dump(mode="json"),
                    "transcript": transcript_text,
                }
            )
            yield _encode_event(
                {
                    "type": "complete",
                    "stage": "complete",
                    "message": "Annotation finished",
                }
            )
        except ValueError as exc:
            yield _encode_event(
                {
                    "type": "error",
                    "stage": "error",
                    "message": str(exc),
                }
            )
        except RuntimeError as exc:
            yield _encode_event(
                {
                    "type": "error",
                    "stage": "error",
                    "message": str(exc),
                }
            )
        except Exception:  # pragma: no cover - defensive guard
            yield _encode_event(
                {
                    "type": "error",
                    "stage": "error",
                    "message": "An unexpected error occurred while annotating the note.",
                }
            )

    return StreamingResponse(event_stream(), media_type="application/jsonl")


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


@router.post("/tutor/mode", response_model=TutorManagerResponse, tags=["tutor"])
@router.post("/tutor/manager", response_model=TutorManagerResponse, tags=["tutor"])
async def tutor_manager_overview(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorManagerResponse:
    """Return the tutor manager agent and its available hooks."""

    return await tutor_service.manager_overview(payload)


@router.post("/tutor/curriculum", response_model=TutorCurriculumResponse, tags=["tutor"])
async def tutor_curriculum_plan(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorCurriculumResponse:
    """Return a staged curriculum assembled by the curriculum agent."""

    return await tutor_service.curriculum_plan(payload)


@router.post("/tutor/modalities", response_model=TutorModalitiesResponse, tags=["tutor"])
async def tutor_modalities_plan(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorModalitiesResponse:
    """Return modality and resource recommendations from the modality agent."""

    return await tutor_service.modalities_plan(payload)


@router.post("/tutor/assessment", response_model=TutorAssessmentResponse, tags=["tutor"])
async def tutor_assessment_plan(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorAssessmentResponse:
    """Return quizzes and answer keys from the assessment agent."""

    return await tutor_service.assessment_plan(payload)


@router.post("/tutor/coach", response_model=TutorCoachResponse, tags=["tutor"])
async def tutor_coach_plan(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorCoachResponse:
    """Return diagnostic and completion guidance from the coach agent."""

    return await tutor_service.coach_plan(payload)


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


@router.post(
    "/generative-ui/chat",
    response_model=GenerativeUIResponse,
    tags=["generative-ui"],
)
async def generative_ui_chat(
    payload: GenerativeUIRequest,
    service: GenerativeUIService = Depends(get_generative_ui_service),
) -> GenerativeUIResponse:
    """Chat endpoint that returns UI guidance and theme suggestions."""

    current_theme = None
    if payload.current_theme:
        current_theme = ThemeSuggestion(
            primary_color=payload.current_theme.primary_color,
            background_color=payload.current_theme.background_color,
            accent_color=payload.current_theme.accent_color,
            text_color=payload.current_theme.text_color,
        )

    try:
        result = await service.generate(
            messages=[message.model_dump() for message in payload.messages],
            current_theme=current_theme,
        )
    except GenerativeUIServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    suggested_theme = None
    if result.theme:
        suggested_theme = {
            "primary_color": result.theme.primary_color,
            "background_color": result.theme.background_color,
            "accent_color": result.theme.accent_color,
            "text_color": result.theme.text_color,
        }

    return GenerativeUIResponse(message=result.message, suggested_theme=suggested_theme)
