import json
import os

protocol_path = 'core_protocol.json'

with open(protocol_path, 'r', encoding='utf-8') as f:
    data = json.load(f)

# Add missing workouts
push_b = {
    "id": "PUSH_B",
    "title": "Push B",
    "subtitle": "Quad Isolation + Upper Chest Focus",
    "exercises": [
        { "id": "LEG_EXTENSION", "sets": "3×10-15", "reps": 15, "rir": "0", "swap_group": "QUAD_ISO" },
        { "id": "SEATED_OHP", "sets": "3×6-10", "reps": 10, "rir": "1-2", "swap_group": "VERT_PRESS" },
        { "id": "MACH_LATERAL", "sets": "3×10-15", "reps": 15, "rir": "0", "swap_group": "LAT_DELT" },
        { "id": "HIGH_INC_SMITH", "sets": "3×8-12", "reps": 12, "rir": "1-2", "swap_group": "CHEST_INC" },
        { "id": "TRI_PUSHDOWN", "sets": "2×10-15", "reps": 15, "rir": "0", "swap_group": "TRI_ISO" }
    ]
}

pull_b = {
    "id": "PULL_B",
    "title": "Pull B",
    "subtitle": "Hamstring Isolation + Upper Back Bias",
    "exercises": [
        { "id": "LAT_PULLDOWN", "sets": "3×8-12", "reps": 12, "rir": "1-2", "swap_group": "LAT_VERT" },
        { "id": "SEATED_L_CURL", "sets": "3×10-15", "reps": 15, "rir": "0", "swap_group": "HAM_ISO" },
        { "id": "WIDE_CABLE_ROW", "sets": "3×10-12", "reps": 12, "rir": "1-2", "swap_group": "ROW_HORIZ" },
        { "id": "FACE_PULL", "sets": "2×15-20", "reps": 20, "rir": "0", "swap_group": "REAR_DELT" },
        { "id": "PREACHER_CURL", "sets": "2×10-15", "reps": 15, "rir": "0", "swap_group": "BI_ISO" }
    ]
}

# Only add if not already present
if len(data['workouts']) == 2:
    data['workouts'].extend([push_b, pull_b])

# Add missing exercises
missing_exs = {
    "SEATED_OHP": {
      "name": "Seated OHP",
      "technique": ["Set bench to 75-80° (not fully 90°)", "Lower bar/handles to chin level", "Press vertically, finishing with biceps by ears", "Control the descent"],
      "mistakes": ["Arching back into a chest press", "Cutting ROM (stopping at forehead)"],
      "visualization": "Head Through Window: As you press up, push your head slightly forward 'through the window' created by your arms.",
      "proTip": "Using a machine or Smith here is preferred over free weights for hypertrophy, allowing you to grind to failure safely.",
      "garmin": { "cat": "SHOULDER_PRESS", "enum": "SEATED_BARBELL_SHOULDER_PRESS" }
    },
    "HIGH_INC_SMITH": {
      "name": "High Incline Smith Press",
      "technique": ["Set bench to 45°", "Lower bar toward the clavicle", "Pause briefly on the chest", "Press up to 90% lockout"],
      "mistakes": ["Lowering to the nipple line (too low for 45°)", "Bouncing off the chest"],
      "visualization": "Scraping the Chin: Position your body so the bar feels like it's almost going to scrape your chin on the way down.",
      "proTip": "Smith machine is crucial here to safely push the upper pecs to failure without dropping the weight.",
      "garmin": { "cat": "CHEST_PRESS", "enum": "SMITH_MACHINE_INCLINE_CHEST_PRESS" }
    },
    "TRI_PUSHDOWN": {
      "name": "Triceps Pushdown",
      "technique": ["Pin elbows to your ribcage", "Hinge only at the elbow", "Pull the rope apart at the bottom", "Squeeze triceps hard"],
      "mistakes": ["Shoulders rolling forward / leaning on the rope", "Moving the elbows forward and back"],
      "visualization": "Breaking the Rope: Visualize trying to rip the rope in half as you reach the bottom.",
      "proTip": "Targets the lateral and medial heads of the triceps. Keep the tempo strict.",
      "garmin": { "cat": "TRICEPS_EXTENSION", "enum": "CABLE_PUSHDOWN" }
    },
    "WIDE_CABLE_ROW": {
      "name": "Wide Grip Cable Row",
      "technique": ["Use a wide mag-grip or straight bar", "Keep torso upright", "Pull elbows high and wide (shoulder height)", "Squeeze scapula together"],
      "mistakes": ["Pulling elbows into sides", "Rounding the back"],
      "visualization": "Scarecrow Pull: Pull your elbows apart like a scarecrow. The goal is width.",
      "proTip": "By flaring the elbows out to 45-60 degrees, you bias the upper back rather than the lats.",
      "garmin": { "cat": "ROW", "enum": "SEATED_CABLE_ROW" }
    },
    "FACE_PULL": {
      "name": "Face Pulls",
      "technique": ["Set rope to upper chest height", "Grasp rope with thumbs facing back", "Pull towards forehead while spreading hands", "Externally rotate"],
      "mistakes": ["Pulling to the chin/neck", "Keeping hands close together"],
      "visualization": "Double Bicep Pose: Finish the movement in a 'double bicep' pose. Your knuckles should face the wall behind you.",
      "proTip": "This is not a heavy strength movement. It's for rotator cuff health and rear delts.",
      "garmin": { "cat": "FLY", "enum": "REAR_DELTOID_FLY" }
    },
    "PREACHER_CURL": {
      "name": "Preacher Curl",
      "technique": ["Adjust seat so armpit fits snugly over pad", "Extend arm fully", "Curl weight without moving the upper arm", "Squeeze biceps at the top"],
      "mistakes": ["Leaning back to gain leverage", "Lifting elbows off the pad", "Stopping short of full extension"],
      "visualization": "The Hinge: Your arm is a simple hinge. Nothing else in the body moves.",
      "proTip": "Exercises the biceps in the 'shortened position'. Control the negative to avoid tendon strain at full extension.",
      "garmin": { "cat": "CURL", "enum": "PREACHER_CURL" }
    },
    "MACH_LATERAL": {
      "name": "Machine Lateral Raise",
      "technique": ["Place elbows against pads", "Keep chest supported against the pad", "Drive elbows up/out leading the movement", "Lower with resistance"],
      "mistakes": ["Gripping the handles too tight", "Shrugging shoulders up"],
      "visualization": "Puppet Strings: Imagine strings are attached to your elbows, pulling them up to the ceiling.",
      "proTip": "Keep your traps relaxed and depressed.",
      "garmin": { "cat": "LATERAL_RAISE", "enum": "MACHINE_LATERAL_RAISE" }
    }
}

for k, v in missing_exs.items():
    if k not in data['exercise_library']:
        data['exercise_library'][k] = v

with open(protocol_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)

print("Updated core_protocol.json with PUSH_B and PULL_B workouts and missing exercises!")
