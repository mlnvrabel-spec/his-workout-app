from pathlib import Path
from tempfile import TemporaryDirectory
import os

from fastapi.testclient import TestClient

from main import app
from exercise_mapping import get_garmin_exercise
from routers import ai, sync


def test_workout_queue():
    payload = [{
        "session_id": "2026-08-10",
        "day_id": "push_a",
        "exercise_id": "ex_001",
        "sets": [{"set_number": 1, "weight_kg": 50, "reps": 10, "rpe": 8, "timestamp": "2026-08-10T12:00:00Z"}],
        "sync_status": "pending",
    }]
    with TemporaryDirectory(ignore_cleanup_errors=True) as temp_dir:
        original_path = sync.QUEUE_DB_PATH
        sync.QUEUE_DB_PATH = Path(temp_dir) / "queue.db"
        try:
            with TestClient(app) as client:
                response = client.post("/sync/workout", json=payload)
            assert response.status_code == 202, response.text
            assert response.json()["accepted"] == 1
            assert sync.QUEUE_DB_PATH.exists()
        finally:
            sync.QUEUE_DB_PATH = original_path


def test_readiness_component():
    original_fetch = sync.fetch_garmin_data
    sync.fetch_garmin_data = lambda _: {
        "body_battery": 80,
        "hrv_status": 70,
        "sleep_score": 90,
        "strength_activity_today": False,
    }
    try:
        with TestClient(app) as client:
            response = client.get("/sync/readiness")
        assert response.status_code == 200, response.text
        assert response.json()["biometric_score"] == 80
    finally:
        sync.fetch_garmin_data = original_fetch


def test_protocol_exercise_mappings():
    assert get_garmin_exercise("Reverse Hack Squat")["name"] == "HACK_SQUAT"
    assert get_garmin_exercise("Seated DB OHP")["name"] == "SEATED_DUMBBELL_SHOULDER_PRESS"
    assert get_garmin_exercise("Standing Calf Raise")["name"] == "STANDING_CALF_RAISE"


def test_coach_fallbacks():
    original_keys = {
        key: os.environ.get(key)
        for key in ("GEMINI_API_KEY", "OPENAI_API_KEY")
    }
    os.environ.pop("GEMINI_API_KEY", None)
    os.environ.pop("OPENAI_API_KEY", None)
    try:
        with TestClient(app) as client:
            high = client.post("/api/ai/coach", json={
                "readiness_score": 80,
                "exercise_name": "Standing Calf Raise",
                "last_session_log": "60kg x 12",
                "target_rir": "0-1",
                "rep_range": "8-15",
            })
            low = client.post("/api/ai/coach", json={
                "readiness_score": 30,
                "exercise_name": "Romanian Deadlift",
                "last_session_log": "First time performing this logged locally.",
                "target_rir": "1-2",
                "rep_range": "6-10",
            })
        assert high.status_code == 200, high.text
        assert "Readiness is high" in high.json()["cue"]
        assert "0-1 RIR" in high.json()["cue"]
        assert low.status_code == 200, low.text
        assert "No prior session is logged" in low.json()["cue"]
        assert "Readiness is low" in low.json()["cue"]

        request = ai.CoachRequest(
            readiness_score=50,
            exercise_name="Cable Fly",
            last_session_log="20kg x 12",
            target_rir="0-1",
            rep_range="10-15",
        )
        assert ai.usable_cue_or_fallback("", request) == ai.build_fallback_cue(request)
    finally:
        for key, value in original_keys.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def test_chat_contract():
    from unittest.mock import patch
    payload = {
        "readiness_score": 50, "exercise_name": "Cable Fly",
        "last_session_log": "20kg x 12", "target_rir": "0-1", "rep_range": "10-15",
        "message": "What comes next?", "workout_title": "Push A",
        "next_workout": "Pull B", "exercise_names": ["Cable Fly"],
    }
    with patch.dict(os.environ, {}, clear=True), TestClient(app) as client:
        response = client.post("/api/ai/chat", json=payload)
        assert response.status_code == 200, response.text
        assert response.json()["source"] == "local"
        assert "Pull B" in response.json()["cue"]
        assert client.post("/api/ai/chat", json={**payload, "message": ""}).status_code == 422
        assert client.post("/api/ai/chat", json={**payload, "readiness_score": 101}).status_code == 422
    req = ai.CoachRequest(**{k: payload[k] for k in ("readiness_score", "exercise_name", "last_session_log", "target_rir", "rep_range")})
    assert ai.usable_cue_or_fallback("One. Two. Three. Four.", req) == "One. Two. Three."
    for malformed in (None, {}, [], "  "):
        assert ai.usable_cue_or_fallback(malformed, req) == ai.build_fallback_cue(req)


if __name__ == "__main__":
    test_workout_queue()
    test_readiness_component()
    test_protocol_exercise_mappings()
    test_coach_fallbacks()
    test_chat_contract()
    print("Backend API behavior: OK")
