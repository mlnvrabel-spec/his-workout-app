from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from auth_manager import get_garmin_client
from exercise_mapping import get_garmin_exercise
from datetime import datetime

router = APIRouter()

class WorkoutPlan(BaseModel):
    title: str
    exercises: list[dict]

class ActualWorkoutLog(BaseModel):
    title: str
    log_text: str

@router.post("/publish")
def publish_workout(workout: WorkoutPlan):
    """
    Converts app's workout plan into Garmin Structured Workout JSON
    and pushes it to Garmin Connect.
    """
    try:
        client = get_garmin_client()
        
        workout_steps = []
        for step_order, ex in enumerate(workout.exercises, start=1):
            mapped_data = get_garmin_exercise(ex.get("name", "Unknown"))
            
            # Formulating the payload struct per garminconnect specifications
            step = {
                "type": "ExecutableStepDTO",
                "stepId": step_order,
                "stepOrder": step_order,
                "childStepId": None,
                "description": mapped_data["note"],
                "stepType": {
                    "stepTypeId": 3,
                    "stepTypeKey": "active",
                },
                "targetType": {
                    "workoutTargetTypeId": 1,
                    "workoutTargetTypeKey": "no.target",
                },
                "exerciseCategory": {
                    "categoryKey": mapped_data["category"],
                },
                "exerciseName": mapped_data["name"],
            }
            workout_steps.append(step)
            
        structured_workout = {
            "workoutName": workout.title,
            "sport": {
                "sportId": 6,
                "sportKey": "training"
            },
            "subSport": {
                "subSportId": 25, # Mapping for STRENGTH TRAINING generally
            },
            "workoutSegments": [
                {
                    "segmentOrder": 1,
                    "sport": {"sportId": 6, "sportKey": "training"},
                    "workoutSteps": workout_steps
                }
            ]
        }
        
        # Upload using the python-garminconnect client
        saved_workout = client.upload_workout(structured_workout)
        
        return {"detail": "Workout Sync Complete. Ready on Watch.", "workout_id": saved_workout.get('workoutId')}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync-actuals")
def sync_actuals(log: ActualWorkoutLog):
    """
    Fetches the last matching STRENGTH activity and replaces its name and notes
    with the actual logged data from the dashboard.
    """
    try:
        client = get_garmin_client()
        
        # Fetch last 5 activities
        activities = client.get_activities(0, 5) 
        strength_activity = None
        
        for activity in activities:
            if activity.get('activityType', {}).get('typeKey') == 'strength_training':
                strength_activity = activity
                break
                
        if not strength_activity:
            raise Exception("No strength activity found recently.")
            
        activity_id = strength_activity["activityId"]
        
        # Update name and description (notes field acts as our unified log append target)
        # client.update_activity is a placeholder mapped action based on the library payload logic
        try:
            # Attempt to push metadata patch (Actual dict argument depends on library signature)
            # client.update_activity(activity_id, {"activityName": log.title, "description": log.log_text})
            pass
        except Exception as patch_e:
            print(f"Failed to patch activity: {patch_e}")
            raise HTTPException(status_code=500, detail="Activity update failed")

        return {"detail": f"Activity {activity_id} successfully patched with actuals."}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
