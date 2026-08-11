from pathlib import Path
from tempfile import TemporaryDirectory

from fastapi.testclient import TestClient

from main import app
from routers import sync


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


if __name__ == "__main__":
    test_workout_queue()
    test_readiness_component()
    print("Backend API behavior: OK")
