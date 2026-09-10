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

## 2. The `hv3_sets` Schema

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
 * @property {string} session_id - Stable cycleId:dayIndex (legacy hv3_logs uses dates)
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


The version 3 database retains `hv3_logs` and `hv3_archive` for compatibility.
New `hv3_sets` records use the composite key `[session_id, day_id, exercise_id]`
and add `workout_id` equal to `session_id` to join completion summaries.
`sync_status: synced` acknowledges durable receipt by the local bridge, not Garmin publication.

`hv3_active_workout` stores one `current` record with cycleId, selected day,
activeDay, done, completedDays, substitutions, revision, latest completion ID,
and an optional next-cycle draft retained during Undo. Read-modify-write this
record and related summaries/logs in one IndexedDB transaction. Only publish
success or update in-memory state after transaction completion.

`hv3_completed_workouts` stores one summary per cycle/day, including the frozen
exercise prescription and substitutions, exact checked count, local session
date, timestamp, and pre-completion state needed for the latest Undo. Undo removes
only its target summary and retains checks/sets entered subsequently.
Hero localStorage values are disposable projections rebuilt from these summaries.
