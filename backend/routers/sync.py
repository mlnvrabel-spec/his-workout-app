from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from cachetools import TTLCache, cached
from auth_manager import get_garmin_client
from datetime import datetime, timedelta
from pathlib import Path
import json
import sqlite3
router = APIRouter()

# 30-minute cache (1800s) to limit Garmin API pings and avoid IP bans.
readiness_cache = TTLCache(maxsize=10, ttl=1800)
QUEUE_DB_PATH = Path(__file__).resolve().parent.parent / "sync_queue.db"

class ReadinessResponse(BaseModel):
    body_battery: int
    hrv_status: int
    sleep_score: int
    biometric_score: int
    readiness_score: int
    strength_activity_today: bool

@cached(cache=readiness_cache)
def fetch_garmin_data(date_str: str) -> dict:
    """
    Fetches real readiness data and recent activity history from Garmin Connect.
    """
    print(f"Cache miss. Fetching Garmin data for {date_str}...")
    try:
        client = get_garmin_client()
        
        # 1. Fetch Training Readiness
        tr_data = client.get_training_readiness(date_str)
        if not tr_data or not isinstance(tr_data, list) or (tr_data[0].get("sleepScore", 0) == 0):
            fallback_date = (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
            tr_data = client.get_training_readiness(fallback_date)

        if tr_data and isinstance(tr_data, list):
            tr = tr_data[0]
            sleep_score = tr.get("sleepScore", 0)
            hrv_val = tr.get("hrvWeeklyAverage", 0)
        else:
            sleep_score = 0
            hrv_val = 0
            
        # 2. Fetch Body Battery
        bb_data = client.get_body_battery(date_str)
        bb_val = 0
        if bb_data and bb_data[0].get("bodyBatteryValuesArray"):
            bb_val = bb_data[0]["bodyBatteryValuesArray"][-1][1]
        if bb_val == 0:
            fallback_date = (datetime.strptime(date_str, "%Y-%m-%d") - timedelta(days=1)).strftime("%Y-%m-%d")
            bb_data_alt = client.get_body_battery(fallback_date)
            if bb_data_alt and bb_data_alt[0].get("bodyBatteryValuesArray"):
                bb_val = bb_data_alt[0]["bodyBatteryValuesArray"][-1][1]

        # 3. Fetch Activity History to check for today's Strength training
        # We check both today and yesterday to handle late-night sessions or sync delays
        activities = client.get_activities_by_date(date_str, date_str)
        strength_today = any(
            act.get('activityType', {}).get('typeKey') == 'strength_training' 
            for act in activities
        )
            
        return {
            "body_battery": bb_val,
            "hrv_status": hrv_val,
            "sleep_score": sleep_score,
            "strength_activity_today": strength_today
        }
    except Exception as e:
        print(f"Error proxying Garmin API: {e}")
        raise Exception(f"Failed to proxy Garmin connect API: {str(e)}")

@router.get("/readiness", response_model=ReadinessResponse)
def get_readiness():
    """
    Proxy endpoint returning Readiness and Activity Status.
    """
    try:
        today_date = datetime.now().strftime("%Y-%m-%d")
        data = fetch_garmin_data(today_date)
        
        bb = data.get("body_battery", 0)
        hrv = data.get("hrv_status", 0)
        sleep = data.get("sleep_score", 0)
        strength_today = data.get("strength_activity_today", False)
        
        biometric_score = max(0, min(100, int((hrv * 0.4) + (sleep * 0.4) + (bb * 0.2))))
        
        return ReadinessResponse(
            body_battery=bb,
            hrv_status=hrv,
            sleep_score=sleep,
            biometric_score=biometric_score,
            readiness_score=biometric_score,
            strength_activity_today=strength_today
        )
    except Exception as e:
        error_msg = str(e)
        if "Unauthorized" in error_msg:
            raise HTTPException(status_code=401, detail="NOT_CONNECTED")
        raise HTTPException(status_code=500, detail=error_msg)

class WorkoutSet(BaseModel):
    set_number: int
    weight_kg: float
    reps: int
    rpe: float
    timestamp: str

class WorkoutLog(BaseModel):
    session_id: str
    day_id: str
    exercise_id: str
    sets: list[WorkoutSet]
    sync_status: str

def queue_workout_logs(logs: list[WorkoutLog]) -> None:
    with sqlite3.connect(QUEUE_DB_PATH) as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS workout_logs (
                session_id TEXT NOT NULL,
                day_id TEXT NOT NULL,
                exercise_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                received_at TEXT NOT NULL,
                PRIMARY KEY (session_id, day_id, exercise_id)
            )
            """
        )
        connection.executemany(
            """
            INSERT OR REPLACE INTO workout_logs
                (session_id, day_id, exercise_id, payload, received_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            [
                (
                    log.session_id,
                    log.day_id,
                    log.exercise_id,
                    json.dumps(log.model_dump()),
                    datetime.now().isoformat(),
                )
                for log in logs
            ],
        )

@router.post("/workout", status_code=202)
def sync_workout(logs: list[WorkoutLog]):
    """
    Durably accepts an array of WorkoutLog items from the frontend's offline sync
    queue before acknowledging them to the client.
    """
    try:
        queue_workout_logs(logs)
        return {"detail": "Workout logs queued for Garmin processing.", "accepted": len(logs)}
    except sqlite3.Error as error:
        raise HTTPException(status_code=500, detail=f"Unable to queue workout logs: {error}")
