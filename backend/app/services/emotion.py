"""Emotion analysis services that fuse multi-modal signals."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, Iterable, Mapping, MutableMapping

from app.schemas.emotion import (
    EmotionAnalysisRequest,
    EmotionAnalysisResponse,
    ModalityBreakdown,
    VideoSignal,
    VoiceSignal,
)


class EmotionTaxonomy(str, Enum):
    """Supported emotion taxonomies."""

    PLUTCHIK_PRIMARY = "plutchik_primary"


PLUTCHIK_EMOTIONS: tuple[str, ...] = (
    "joy",
    "trust",
    "fear",
    "surprise",
    "sadness",
    "disgust",
    "anger",
    "anticipation",
    "neutral",
)


def _normalized(scores: Mapping[str, float], *, epsilon: float = 1e-6) -> Dict[str, float]:
    """Return scores normalized to a probability distribution."""

    total = float(sum(max(value, 0.0) for value in scores.values()))
    if total <= epsilon:
        uniform = 1.0 / len(scores)
        return {emotion: uniform for emotion in scores}
    return {emotion: max(value, 0.0) / total for emotion, value in scores.items()}


def _ensure_emotion_keys(scores: Mapping[str, float], emotions: Iterable[str]) -> Dict[str, float]:
    """Ensure all expected emotion keys exist in the mapping."""

    return {emotion: float(scores.get(emotion, 0.0)) for emotion in emotions}


class TextEmotionAnalyzer:
    """Lexicon-driven heuristics for inferring emotion from text transcripts."""

    KEYWORD_LEXICON: Mapping[str, set[str]] = {
        "joy": {
            "happy",
            "glad",
            "excited",
            "delighted",
            "grateful",
            "pleased",
            "smile",
            "fantastic",
        },
        "trust": {
            "confident",
            "assured",
            "certain",
            "secure",
            "reliable",
            "support",
            "together",
        },
        "fear": {
            "afraid",
            "worried",
            "scared",
            "anxious",
            "terrified",
            "nervous",
            "panic",
        },
        "surprise": {
            "surprised",
            "shocked",
            "amazed",
            "astonished",
            "wow",
            "unexpected",
        },
        "sadness": {
            "sad",
            "upset",
            "down",
            "depressed",
            "unhappy",
            "cry",
            "mourn",
        },
        "disgust": {
            "gross",
            "disgusted",
            "nasty",
            "repulsed",
            "abhorrent",
            "yuck",
        },
        "anger": {
            "angry",
            "furious",
            "mad",
            "enraged",
            "annoyed",
            "resent",
        },
        "anticipation": {
            "looking",
            "ready",
            "planning",
            "awaiting",
            "expect",
            "soon",
            "hope",
        },
    }

    def analyze(self, text: str | None) -> Dict[str, float] | None:
        """Return normalized emotion probabilities for textual content."""

        if not text or not text.strip():
            return None

        import re

        tokens = re.findall(r"\b\w+\b", text.lower())
        if not tokens:
            return None

        scores: MutableMapping[str, float] = {emotion: 0.0 for emotion in PLUTCHIK_EMOTIONS}
        punctuation_bonus = text.count("!") * 0.2
        question_bonus = text.count("?") * 0.1

        for token in tokens:
            for emotion, keywords in self.KEYWORD_LEXICON.items():
                if token in keywords:
                    scores[emotion] += 1.0

        if punctuation_bonus:
            scores["surprise"] += punctuation_bonus
        if question_bonus:
            scores["anticipation"] += question_bonus

        sentiment_bias = 0.0
        positive_markers = {"good", "great", "love", "awesome", "yes"}
        negative_markers = {"no", "bad", "hate", "awful", "never"}
        for token in tokens:
            if token in positive_markers:
                sentiment_bias += 0.5
            if token in negative_markers:
                sentiment_bias -= 0.5

        if sentiment_bias > 0:
            scores["joy"] += sentiment_bias
            scores["trust"] += sentiment_bias * 0.5
        elif sentiment_bias < 0:
            scores["sadness"] += abs(sentiment_bias)
            scores["anger"] += abs(sentiment_bias) * 0.5

        neutral_floor = max(len(tokens) * 0.05, 0.2)
        scores["neutral"] = max(scores["neutral"], neutral_floor)

        return _normalized(_ensure_emotion_keys(scores, PLUTCHIK_EMOTIONS))


@dataclass(slots=True)
class VoiceBands:
    """Threshold configuration for mapping acoustic features to emotions."""

    calm_energy: float = 0.08
    elevated_energy: float = 0.18
    high_pitch: float = 220.0
    low_pitch: float = 140.0
    rapid_tempo: float = 2.8
    slow_tempo: float = 1.4
    jitter_threshold: float = 0.15


class VoiceEmotionAnalyzer:
    """Heuristic analysis using common prosodic indicators."""

    def __init__(self, bands: VoiceBands | None = None) -> None:
        self.bands = bands or VoiceBands()

    def analyze(self, signal: VoiceSignal | None) -> Dict[str, float] | None:
        if signal is None:
            return None

        scores: MutableMapping[str, float] = {emotion: 0.0 for emotion in PLUTCHIK_EMOTIONS}

        energy = max(signal.energy, 0.0)
        pitch = max(signal.pitch, 0.0)
        tempo = max(signal.tempo, 0.0)
        jitter = max(signal.jitter, 0.0)

        if energy <= self.bands.calm_energy:
            scores["sadness"] += 1.2
            scores["neutral"] += 0.8
        elif energy >= self.bands.elevated_energy:
            scores["anger"] += 1.0
            scores["joy"] += 0.7
            scores["surprise"] += 0.5
        else:
            scores["trust"] += 0.6
            scores["anticipation"] += 0.4

        if pitch >= self.bands.high_pitch:
            scores["surprise"] += 1.0
            scores["fear"] += 0.8
        elif pitch <= self.bands.low_pitch:
            scores["sadness"] += 0.6
            scores["disgust"] += 0.3
        else:
            scores["trust"] += 0.3

        if tempo >= self.bands.rapid_tempo:
            scores["anticipation"] += 0.9
            scores["anger"] += 0.4
        elif tempo <= self.bands.slow_tempo:
            scores["sadness"] += 0.5
            scores["fear"] += 0.3

        if jitter >= self.bands.jitter_threshold:
            scores["fear"] += 1.1
            scores["surprise"] += 0.4
        else:
            scores["trust"] += 0.2

        scores["neutral"] += 0.5

        return _normalized(_ensure_emotion_keys(scores, PLUTCHIK_EMOTIONS))


class VideoEmotionAnalyzer:
    """Interpret facial cues derived from a lightweight landmark model."""

    def analyze(self, signal: VideoSignal | None) -> Dict[str, float] | None:
        if signal is None:
            return None

        scores: MutableMapping[str, float] = {emotion: 0.0 for emotion in PLUTCHIK_EMOTIONS}

        smile = max(min(signal.smile, 1.0), 0.0)
        brow_raise = max(min(signal.brow_raise, 1.0), 0.0)
        eye_openness = max(min(signal.eye_openness, 1.0), 0.0)
        head_movement = max(min(signal.head_movement, 1.0), 0.0)
        engagement = max(min(signal.engagement or 0.0, 1.0), 0.0)

        scores["joy"] += smile * 1.4
        scores["trust"] += smile * 0.5
        scores["anticipation"] += engagement * 0.6

        scores["surprise"] += brow_raise * 1.0 + eye_openness * 0.6
        scores["fear"] += brow_raise * 0.5 + head_movement * 0.7

        scores["anger"] += (1.0 - smile) * engagement * 0.5
        scores["disgust"] += max(0.0, engagement - smile) * 0.3

        calmness = max(0.0, 1.0 - (brow_raise + head_movement) / 2.0)
        scores["neutral"] += calmness * 0.8
        scores["sadness"] += (1.0 - smile) * (1.0 - eye_openness) * 0.8

        return _normalized(_ensure_emotion_keys(scores, PLUTCHIK_EMOTIONS))


class EmotionFusion:
    """Combine modality-specific probabilities into a single prediction."""

    DEFAULT_WEIGHTS: Mapping[str, float] = {
        "text": 0.4,
        "voice": 0.3,
        "video": 0.3,
    }

    def __init__(self, emotions: Iterable[str]) -> None:
        self.emotions = tuple(emotions)

    def combine(self, modality_scores: Mapping[str, Dict[str, float] | None]) -> tuple[Dict[str, float], Dict[str, float]]:
        available = {modality: scores for modality, scores in modality_scores.items() if scores}
        if not available:
            uniform = {emotion: 1.0 / len(self.emotions) for emotion in self.emotions}
            return uniform, {}

        total_weight = sum(self.DEFAULT_WEIGHTS.get(modality, 0.0) for modality in available)
        if total_weight == 0:
            total_weight = len(available)
            weights = {modality: 1.0 / len(available) for modality in available}
        else:
            weights = {
                modality: self.DEFAULT_WEIGHTS.get(modality, 0.0) / total_weight
                for modality in available
            }

        aggregated = {emotion: 0.0 for emotion in self.emotions}
        for modality, scores in available.items():
            weighted = weights[modality]
            for emotion in self.emotions:
                aggregated[emotion] += weighted * scores.get(emotion, 0.0)

        return _normalized(aggregated), weights


class EmotionAnalyzer:
    """Facade that orchestrates modality-level analyzers."""

    def __init__(self, taxonomy: EmotionTaxonomy = EmotionTaxonomy.PLUTCHIK_PRIMARY) -> None:
        if taxonomy != EmotionTaxonomy.PLUTCHIK_PRIMARY:
            msg = f"Unsupported taxonomy: {taxonomy}"
            raise ValueError(msg)

        self.taxonomy = taxonomy
        self.text_analyzer = TextEmotionAnalyzer()
        self.voice_analyzer = VoiceEmotionAnalyzer()
        self.video_analyzer = VideoEmotionAnalyzer()
        self.fusion = EmotionFusion(PLUTCHIK_EMOTIONS)

    def analyze(self, payload: EmotionAnalysisRequest) -> EmotionAnalysisResponse:
        text_scores = self.text_analyzer.analyze(payload.text)
        voice_scores = self.voice_analyzer.analyze(payload.voice)
        video_scores = self.video_analyzer.analyze(payload.video)

        aggregated, weights = self.fusion.combine(
            {
                "text": text_scores,
                "voice": voice_scores,
                "video": video_scores,
            }
        )

        dominant = max(aggregated.items(), key=lambda pair: pair[1])
        modality_breakdown = ModalityBreakdown(text=text_scores, voice=voice_scores, video=video_scores)

        return EmotionAnalysisResponse(
            taxonomy=self.taxonomy.value,
            dominant_emotion=dominant[0],
            confidence=dominant[1],
            aggregated=aggregated,
            modality_breakdown=modality_breakdown,
            modality_weights=weights,
        )

