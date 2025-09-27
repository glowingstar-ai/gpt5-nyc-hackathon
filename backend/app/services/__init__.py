"""Service layer exports."""

from .emotion import EmotionAnalyzer, EmotionTaxonomy
from .note import AnnotationResult, NoteAnnotator, NoteAnnotationError
from .research import (
    ArxivPaper,
    CandidateMatch,
    ResearchDiscoveryService,
    ResearchEvent,
    ResearchResult,
    ResearchResultsEvent,
    ResearchServiceError,
    ResearchStepEvent,
)
from .storage import AudioUploadResult, S3AudioStorage, StorageServiceError
from .tutor import TutorModeService

__all__ = [
    "EmotionAnalyzer",
    "EmotionTaxonomy",
    "AnnotationResult",
    "NoteAnnotator",
    "NoteAnnotationError",
    "ArxivPaper",
    "CandidateMatch",
    "ResearchDiscoveryService",
    "ResearchEvent",
    "ResearchResult",
    "ResearchResultsEvent",
    "ResearchServiceError",
    "ResearchStepEvent",
    "AudioUploadResult",
    "S3AudioStorage",
    "StorageServiceError",
    "TutorModeService",
]
