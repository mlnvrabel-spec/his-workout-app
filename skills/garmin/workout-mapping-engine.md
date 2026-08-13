# Garmin Workout Mapping

`backend/exercise_mapping.py` is the executable mapping used when a workout is
published to Garmin. Exercise names in `core_protocol.json` must match its keys
exactly.

| Protocol exercise | Garmin category | Garmin exercise name |
|---|---|---|
| Reverse Hack Squat | SQUAT | HACK_SQUAT |
| Pendulum Squat | SQUAT | SQUAT |
| Hack Squat | SQUAT | HACK_SQUAT |
| Leg Press | LEG_PRESS | LEG_PRESS |
| Low Incline DB Press | CHEST_PRESS | DUMBBELL_INCLINE_BENCH_PRESS |
| Incline Machine Press | CHEST_PRESS | MACHINE_INCLINE_CHEST_PRESS |
| High Incline Smith Press | CHEST_PRESS | SMITH_MACHINE_INCLINE_BENCH_PRESS |
| Cable Fly | CHEST_PRESS | CABLE_CROSSOVER |
| Seated DB OHP | SHOULDER_PRESS | SEATED_DUMBBELL_SHOULDER_PRESS |
| Machine/Cable/DB Lateral Raise | LATERAL_RAISE | native matching enum |
| Overhead Cable Extension | TRICEPS_EXTENSION | OVERHEAD_TRICEPS_EXTENSION |
| Triceps Pushdown | TRICEPS_EXTENSION | TRICEPS_PUSHDOWN |
| Romanian Deadlift variants | DEADLIFT | native matching enum |
| Weighted Pull-Up / Lat Pulldown | PULL_UP | native matching enum |
| Seated Leg Curl | LEG_CURL | LEG_CURL |
| Chest-Supported / Wide Cable Row | ROW | native matching enum |
| Reverse Pec Deck / Face Pull | FLY / SHOULDER_STABILITY | native matching enum |
| Incline DB Curl / Preacher Curl | CURL | native matching enum |
| Standing Calf Raise | CALF_RAISE | STANDING_CALF_RAISE |

When Garmin lacks an exact device-supported option, keep the closest valid
movement and preserve the precise protocol name in the workout description.
