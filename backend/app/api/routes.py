import base64
import binascii
from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies import (
    get_audio_storage,
    get_emotion_analyzer,
    get_note_annotator,
    get_realtime_client,
    get_settings,
    get_tutor_service,
)
from app.core.config import Settings
from app.schemas.emotion import EmotionAnalysisRequest, EmotionAnalysisResponse
from app.schemas.health import HealthResponse
from app.schemas.realtime import (
    RealtimeSessionToken,
    VisionFrameRequest,
    VisionFrameResponse,
)
from app.schemas.note import NoteCreateRequest, NoteCreateResponse
from app.schemas.tutor import TutorModeRequest, TutorModeResponse
from app.services.emotion import EmotionAnalyzer
from app.services.note import NoteAnnotator, NoteAnnotationError
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


@router.post("/tutor/mode", response_model=TutorModeResponse, tags=["tutor"])
async def create_tutor_mode_plan(
    payload: TutorModeRequest,
    tutor_service: TutorModeService = Depends(get_tutor_service),
) -> TutorModeResponse:
    """Create a BabyAGI-inspired tutoring plan powered by GPT-5."""

    return await tutor_service.generate_plan(payload)
