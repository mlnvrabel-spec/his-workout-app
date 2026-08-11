"""
Garmin Exercise Mapping Logic
Maps custom Hypertrophy Protocol names to Garmin Connect SDK valid enums.
"""

EXERCISE_MAP = {
    # --- PUSH A & B ---
    "Pendulum Squat": {
        "category": "SQUAT",
        "name": "SQUAT",  # Non-native, mapped to generic
        "note": "Pendulum Squat: Slow eccentric, drive knees forward."
    },
    "Low Incline DB Press": {
        "category": "CHEST_PRESS",
        "name": "DUMBBELL_INCLINE_BENCH_PRESS",
        "note": "15-30 degree incline for clavicular fibers."
    },
    "Cable Lateral Raise": {
        "category": "LATERAL_RAISE",
        "name": "CABLE_LATERAL_RAISE",
        "note": "Sweep out toward the walls."
    },
    "Cable Flys": {
        "category": "CHEST_PRESS",
        "name": "CABLE_CROSSOVER",
        "note": "The Barrel Hug: Pause in the stretch."
    },
    "Overhead Extension": {
        "category": "TRICEPS_EXTENSION",
        "name": "OVERHEAD_TRICEPS_EXTENSION",
        "note": "Focus on the deep stretch behind the neck."
    },
    "Leg Extension": {
        "category": "LEG_EXTENSION",
        "name": "LEG_EXTENSION",
        "note": "Dorsiflex toes; hold 1s at top."
    },
    "Seated OHP": {
        "category": "SHOULDER_PRESS",
        "name": "SEATED_BARBELL_SHOULDER_PRESS",
        "note": "80 degree bench angle."
    },
    "Machine Lateral Raise": {
        "category": "LATERAL_RAISE",
        "name": "LATERAL_RAISE",
        "note": "Lead with elbows."
    },
    "High Incline Smith Press": {
        "category": "CHEST_PRESS",
        "name": "SMITH_MACHINE_INCLINE_BENCH_PRESS",
        "note": "Lower toward clavicle."
    },
    "Triceps Pushdown": {
        "category": "TRICEPS_EXTENSION",
        "name": "TRICEPS_PUSHDOWN",
        "note": "Rip the rope apart at the bottom."
    },

    # --- PULL A & B ---
    "Romanian Deadlift": {
        "category": "DEADLIFT",
        "name": "BARBELL_ROMANIAN_DEADLIFT",
        "note": "Hinge until hips stop moving back."
    },
    "Weighted Pull-Up": {
        "category": "PULL_UP",
        "name": "PULL_UP",
        "note": "Neutral grip; elbows to pockets."
    },
    "Reverse Pec Deck": {
        "category": "FLY",
        "name": "REAR_DELTOID_FLY",
        "note": "Keep shoulder blades wide; isolate rear delt."
    },
    "Chest-Supported Row": {
        "category": "ROW",
        "name": "SEATED_ROW",
        "note": "Wrap around the pad at the bottom."
    },
    "Incline DB Curls": {
        "category": "CURL",
        "name": "DUMBBELL_INCLINE_CURL",
        "note": "Keep elbows pinned to the floor."
    },
    "Lat Pulldown": {
        "category": "PULL_UP",
        "name": "LAT_PULLDOWN",
        "note": "Drive elbows toward hips."
    },
    "Seated Leg Curl": {
        "category": "LEG_CURL",
        "name": "LEG_CURL",
        "note": "3-second eccentric; hips locked down."
    },
    "Wide Grip Cable Row": {
        "category": "ROW",
        "name": "SEATED_ROW",
        "note": "Scarecrow pull; elbows high and wide."
    },
    "Face Pulls": {
        "category": "SHOULDER_STABILITY",
        "name": "FACE_PULL",
        "note": "Finish in double bicep pose."
    },
    "Preacher Curl": {
        "category": "CURL",
        "name": "PREACHER_CURL",
        "note": "Full extension; arm is a simple hinge."
    }
}

def get_garmin_exercise(app_exercise_name):
    """Returns a dict with Garmin-safe enums and instructions."""
    return EXERCISE_MAP.get(
        app_exercise_name, 
        {"category": "UNKNOWN", "name": "UNKNOWN", "note": ""}
    )
