"""Service layer exports."""

from .auth import Auth0Client, Auth0ClientError, AuthTokens, AuthUserInfo
from .emotion import EmotionAnalyzer, EmotionTaxonomy
from .generative_ui import (
    GenerativeUIResult,
    GenerativeUIService,
    GenerativeUIServiceError,
    ThemeSuggestion,
)
from .journal import JournalCoach, JournalCoachError, JournalGuidance
from .note import AnnotationResult, NoteAnnotator, NoteAnnotationError
from .payment import CheckoutSession, StripePaymentError, StripePaymentService
from .research import ResearchDiscoveryService
from .storage import AudioUploadResult, S3AudioStorage, StorageServiceError
from .transcription import AudioTranscriber, AudioTranscriptionError, TranscriptionResult
from .tutor import TutorAgentService

__all__ = [
    "Auth0Client",
    "Auth0ClientError",
    "AuthTokens",
    "AuthUserInfo",
    "EmotionAnalyzer",
    "EmotionTaxonomy",
    "GenerativeUIResult",
    "GenerativeUIService",
    "GenerativeUIServiceError",
    "ThemeSuggestion",
    "JournalCoach",
    "JournalCoachError",
    "JournalGuidance",
    "AnnotationResult",
    "NoteAnnotator",
    "NoteAnnotationError",
    "CheckoutSession",
    "StripePaymentService",
    "StripePaymentError",
    "AudioUploadResult",
    "S3AudioStorage",
    "StorageServiceError",
    "AudioTranscriber",
    "AudioTranscriptionError",
    "TranscriptionResult",
    "TutorAgentService",
    "ResearchDiscoveryService",
]
