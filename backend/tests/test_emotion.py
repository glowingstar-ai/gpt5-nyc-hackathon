"""Tests for the emotion analysis service and API."""

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.emotion import EmotionAnalysisRequest, VideoSignal, VoiceSignal
from app.services.emotion import EmotionAnalyzer


def test_emotion_analyzer_combines_modalities() -> None:
    analyzer = EmotionAnalyzer()
    payload = EmotionAnalysisRequest(
        text="I am so excited and happy to see everyone!",
        voice=VoiceSignal(energy=0.25, pitch=250.0, tempo=3.2, jitter=0.05),
        video=VideoSignal(smile=0.9, brow_raise=0.4, eye_openness=0.6, head_movement=0.2, engagement=0.8),
    )

    result = analyzer.analyze(payload)

    assert result.dominant_emotion in result.aggregated
    assert 0 <= result.confidence <= 1
    assert pytest.approx(sum(result.aggregated.values()), rel=1e-3) == 1.0
    assert result.modality_breakdown.text is not None
    assert result.modality_breakdown.voice is not None
    assert result.modality_breakdown.video is not None


def test_emotion_endpoint_returns_prediction() -> None:
    with TestClient(app) as client:
        response = client.post(
            "/api/v1/emotion/analyze",
            json={
                "text": "The news makes me anxious but I'm hopeful",
                "voice": {"energy": 0.12, "pitch": 210.0, "tempo": 2.1, "jitter": 0.2},
                "video": {
                    "smile": 0.3,
                    "brow_raise": 0.6,
                    "eye_openness": 0.5,
                    "head_movement": 0.4,
                    "engagement": 0.7,
                },
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload["taxonomy"] == "plutchik_primary"
    assert isinstance(payload["aggregated"], dict)
    assert payload["dominant_emotion"] in payload["aggregated"]
