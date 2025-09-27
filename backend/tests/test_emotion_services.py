"""Unit tests covering the emotion analysis service helpers."""

from __future__ import annotations

from typing import cast

import pytest

from app.api import dependencies
from app.core import config
from app.schemas.emotion import EmotionAnalysisRequest, VideoSignal, VoiceSignal
from app.services import emotion


def test_normalized_with_non_positive_total() -> None:
    scores = {"joy": -1.0, "sadness": 0.0}

    result = emotion._normalized(scores, epsilon=1.0)

    assert result["joy"] == pytest.approx(0.5)
    assert result["sadness"] == pytest.approx(0.5)


def test_normalized_with_positive_values() -> None:
    scores = {"joy": 2.0, "sadness": 1.0}

    result = emotion._normalized(scores)

    assert result == {"joy": pytest.approx(2 / 3), "sadness": pytest.approx(1 / 3)}


def test_ensure_emotion_keys_adds_missing_entries() -> None:
    provided = {"joy": 0.25}

    result = emotion._ensure_emotion_keys(
        provided,
        ("joy", "sadness"),
    )

    assert result == {"joy": 0.25, "sadness": 0.0}


def test_text_analyzer_handles_empty_payload() -> None:
    analyzer = emotion.TextEmotionAnalyzer()

    assert analyzer.analyze(None) is None
    assert analyzer.analyze("   ") is None


def test_text_analyzer_detects_keywords_and_biases() -> None:
    analyzer = emotion.TextEmotionAnalyzer()

    text = "I am so happy and excited! Are you ready for this awesome news?"

    result = analyzer.analyze(text)

    assert result is not None
    assert result["joy"] > result["sadness"]
    assert result["surprise"] > 0
    assert result["anticipation"] > 0


def test_text_analyzer_negative_sentiment_bias() -> None:
    analyzer = emotion.TextEmotionAnalyzer()

    result = analyzer.analyze("I am bad, angry and I hate everything")

    assert result is not None
    assert result["sadness"] > 0
    assert result["anger"] > 0


def test_voice_analyzer_handles_none_signal() -> None:
    analyzer = emotion.VoiceEmotionAnalyzer()

    assert analyzer.analyze(None) is None


def test_voice_analyzer_low_energy_profile() -> None:
    analyzer = emotion.VoiceEmotionAnalyzer()

    signal = VoiceSignal(energy=0.01, pitch=100.0, tempo=1.0, jitter=0.3)

    result = analyzer.analyze(signal)

    assert result["sadness"] > result["joy"]
    assert result["fear"] > 0
    assert result["neutral"] > 0


def test_voice_analyzer_high_energy_profile() -> None:
    bands = emotion.VoiceBands(calm_energy=0.05, elevated_energy=0.2)
    analyzer = emotion.VoiceEmotionAnalyzer(bands=bands)

    signal = VoiceSignal(energy=0.5, pitch=260.0, tempo=3.5, jitter=0.05)

    result = analyzer.analyze(signal)

    assert result["anger"] > 0
    assert result["joy"] > 0
    assert result["surprise"] > 0


def test_voice_analyzer_midrange_profile() -> None:
    analyzer = emotion.VoiceEmotionAnalyzer()

    signal = VoiceSignal(energy=0.12, pitch=180.0, tempo=2.0, jitter=0.05)

    result = analyzer.analyze(signal)

    assert result["trust"] > 0
    assert result["anticipation"] > 0


def test_video_analyzer_handles_none_signal() -> None:
    analyzer = emotion.VideoEmotionAnalyzer()

    assert analyzer.analyze(None) is None


def test_video_analyzer_computes_probabilities() -> None:
    analyzer = emotion.VideoEmotionAnalyzer()

    signal = VideoSignal(smile=0.7, brow_raise=0.6, eye_openness=0.8, head_movement=0.2, engagement=0.9)

    result = analyzer.analyze(signal)

    assert result["joy"] > 0
    assert result["neutral"] > 0
    assert pytest.approx(sum(result.values()), rel=1e-6) == 1.0


def test_emotion_fusion_uniform_when_no_modalities() -> None:
    fusion = emotion.EmotionFusion(emotion.PLUTCHIK_EMOTIONS)

    aggregated, weights = fusion.combine({"text": None, "voice": None, "video": None})

    assert weights == {}
    assert pytest.approx(sum(aggregated.values()), rel=1e-6) == 1.0
    assert len(set(aggregated.values())) == 1


def test_emotion_fusion_balances_unknown_modalities() -> None:
    fusion = emotion.EmotionFusion(emotion.PLUTCHIK_EMOTIONS)

    aggregated, weights = fusion.combine({"sensor": {"joy": 1.0}, "other": {"sadness": 2.0}})

    assert set(weights) == {"sensor", "other"}
    assert pytest.approx(weights["sensor"], rel=1e-6) == pytest.approx(weights["other"], rel=1e-6)
    assert pytest.approx(sum(aggregated.values()), rel=1e-6) == 1.0


def test_emotion_analyzer_supports_full_pipeline() -> None:
    analyzer = emotion.EmotionAnalyzer()

    payload = EmotionAnalysisRequest(
        text="I feel confident and ready!",
        voice=VoiceSignal(energy=0.3, pitch=230.0, tempo=3.0, jitter=0.02),
        video=VideoSignal(smile=0.8, brow_raise=0.2, eye_openness=0.9, head_movement=0.1, engagement=0.8),
    )

    response = analyzer.analyze(payload)

    assert response.dominant_emotion in response.aggregated
    assert pytest.approx(sum(response.aggregated.values()), rel=1e-6) == 1.0
    assert response.modality_weights["text"] == pytest.approx(0.4 / 1.0, rel=1e-6)


def test_emotion_analyzer_rejects_unknown_taxonomy() -> None:
    with pytest.raises(ValueError):
        emotion.EmotionAnalyzer(taxonomy=cast(emotion.EmotionTaxonomy, "unsupported"))


def test_dependency_helpers_return_singletons() -> None:
    first_settings = dependencies.get_settings()
    second_settings = dependencies.get_settings()

    assert first_settings is second_settings

    first_analyzer = dependencies.get_emotion_analyzer()
    second_analyzer = dependencies.get_emotion_analyzer()

    assert first_analyzer is second_analyzer


def test_configuration_aliases_are_respected(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PROJECT_NAME", "Custom API")
    monkeypatch.setenv("ENVIRONMENT", "staging")

    config.get_settings.cache_clear()
    settings = config.get_settings()

    assert settings.project_name == "Custom API"
    assert settings.environment == "staging"

    config.get_settings.cache_clear()


def test_root_endpoint_returns_welcome_message() -> None:
    from fastapi.testclient import TestClient

    from app.main import app

    with TestClient(app) as client:
        response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {"message": "Welcome to the GPT5 Hackathon API"}

