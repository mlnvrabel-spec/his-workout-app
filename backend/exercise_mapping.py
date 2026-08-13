"""
Garmin Exercise Mapping Logic
Maps custom Hypertrophy Protocol names to Garmin Connect SDK valid enums.
"""

EXERCISE_MAP = {
    # --- PUSH A & B ---
    "Pendulum Squat": {
        "category": "SQUAT",
        "name": "SQUAT",  # Non-native, mapped to generic
        "note": "Pendulum Squat: controlled eccentric, deep pain-free knee flexion."
    },
    "Reverse Hack Squat": {
        "category": "SQUAT",
        "name": "HACK_SQUAT",
        "note": "Reverse Hack Squat: controlled depth with stable bracing."
    },
    "Hack Squat": {
        "category": "SQUAT",
        "name": "HACK_SQUAT",
        "note": "Hack Squat: use a controlled, pain-free range."
    },
    "Leg Press": {
        "category": "LEG_PRESS",
        "name": "LEG_PRESS",
        "note": "Leg Press: keep the pelvis stable against the pad."
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
    "Cable Fly": {
        "category": "CHEST_PRESS",
        "name": "CABLE_CROSSOVER",
        "note": "Cable Fly: use a controlled chest stretch and fixed elbow bend."
    },
    "Incline Machine Press": {
        "category": "CHEST_PRESS",
        "name": "MACHINE_INCLINE_CHEST_PRESS",
        "note": "Incline Machine Press: keep the upper back fixed into the pad."
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
    "Seated DB OHP": {
        "category": "SHOULDER_PRESS",
        "name": "SEATED_DUMBBELL_SHOULDER_PRESS",
        "note": "Seated DB OHP: brace the torso and use a controlled shoulder-level stretch."
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
    "Dumbbell Romanian Deadlift": {
        "category": "DEADLIFT",
        "name": "DUMBBELL_ROMANIAN_DEADLIFT",
        "note": "Dumbbell RDL: hinge to the deepest stable hamstring stretch."
    },
    "Smith Machine RDL": {
        "category": "DEADLIFT",
        "name": "SMITH_MACHINE_ROMANIAN_DEADLIFT",
        "note": "Smith RDL: keep the bar close to the legs."
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
        "note": "Controlled eccentric; hips locked down."
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
    "Face Pull": {
        "category": "SHOULDER_STABILITY",
        "name": "FACE_PULL",
        "note": "Face Pull: finish with the hands apart and a controlled external rotation."
    },
    "Preacher Curl": {
        "category": "CURL",
        "name": "PREACHER_CURL",
        "note": "Full extension; arm is a simple hinge."
    },
    "Standing Calf Raise": {
        "category": "CALF_RAISE",
        "name": "STANDING_CALF_RAISE",
        "note": "Standing Calf Raise: control the deep stretch and pause briefly at the top."
    }
}

def get_garmin_exercise(app_exercise_name):
    """Returns a dict with Garmin-safe enums and instructions."""
    return EXERCISE_MAP.get(
        app_exercise_name, 
        {"category": "UNKNOWN", "name": "UNKNOWN", "note": ""}
    )
