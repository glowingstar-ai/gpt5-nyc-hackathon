"""Service layer exports."""

from .auth import Auth0Client, Auth0ClientError, AuthTokens, AuthUserInfo
from .emotion import EmotionAnalyzer, EmotionTaxonomy
from .note import AnnotationResult, NoteAnnotator, NoteAnnotationError
from .payment import CheckoutSession, StripePaymentError, StripePaymentService
from .storage import AudioUploadResult, S3AudioStorage, StorageServiceError
from .tutor import TutorModeService

__all__ = [
    "Auth0Client",
    "Auth0ClientError",
    "AuthTokens",
    "AuthUserInfo",
    "EmotionAnalyzer",
    "EmotionTaxonomy",
    "AnnotationResult",
    "NoteAnnotator",
    "NoteAnnotationError",
    "CheckoutSession",
    "StripePaymentService",
    "StripePaymentError",
    "AudioUploadResult",
    "S3AudioStorage",
    "StorageServiceError",
    "TutorModeService",
]
