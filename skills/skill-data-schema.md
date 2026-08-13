# Skill: Data Architecture & Strict Schema

## Goal

Keep the protocol, UI, offline logs, Garmin mapping, and coaching inputs on one
small, explicit contract.

## 1. The `core_protocol.json` Schema

`src/data/core_protocol.json` is the programming source of truth. It defines
the rolling workout order, exercise prescriptions, technique cues, Garmin
metadata, and only biomechanically comparable swap options.

```json
{
  "workouts": [
    {
      "id": "PUSH_A",
      "title": "Push A",
      "exercises": [
        {
          "id": "LOW_INC_DB_PRESS",
          "sets": 3,
          "reps": "6-10",
          "rir": "1-2",
          "rest_sec": 180,
          "swap_group": "CHEST_LOW_INC"
        }
      ]
    }
  ]
}
```

Constraints:

- `sets` is a number; `reps` is a range string; `rir` is the target range;
  `rest_sec` is a number.
- Each slot must reference an `exercise_library` entry.
- A `swap_group` contains only genuine, mechanically comparable substitutes.
  No appropriate substitute is preferable to a misleading one.
- The workout list is a continuous cycle, not a weekday schedule.

## 2. The `hv3_logs` Schema

This is stored locally by `StorageManager.js` and sent to the FastAPI queue.

```javascript
/**
 * @typedef {Object} WorkoutSet
 * @property {number} set_number
 * @property {number} weight_kg
 * @property {number} reps
 * @property {number} rpe
 * @property {string} timestamp - ISO 8601
 */

/**
 * @typedef {Object} WorkoutLog
 * @property {string} session_id - Local calendar date
 * @property {string} day_id
 * @property {string} exercise_id
 * @property {WorkoutSet[]} sets
 * @property {"pending" | "synced"} sync_status
 */
```

Constraints:

- Persist locally before requesting remote sync.
- Keep logged load in kilograms; convert only in presentation.
- `session_id`, `day_id`, and `exercise_id` jointly identify an idempotent
  queued log.
