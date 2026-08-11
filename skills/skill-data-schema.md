# Skill: Data Architecture & Strict Schema

## Goal
Establish a universal, immutable contract for data structures across all agents (Marcus, Atlas, Mr. Olympia). 

## 1. The `core_protocol.json` Schema (Read-Only)
This file dictates the UI structure. It is fetched from `/data/core_protocol.json`.
```json
{
  "protocol_version": "HV4_Elite",
  "days": {
    "D1_Push_A": {
      "exercises": [
        {
          "id": "ex_001",
          "name": "Pendulum Squat",
          "garmin_enum": "SQUAT",
          "sets": 3,
          "target_rpe": 8.5,
          "rest_sec": 180,
          "swap_group": ["Hack Squat", "Leg Press"]
        }
      ]
    }
  }
}


## 2. The `hv3_logs` Schema (Current Session State)
This is how data is stored locally via `StorageManager.js` and transmitted to the FastAPI backend.
**Important:** Use JSDoc comments in JS files to enforce this shape. Do NOT use TypeScript.

```javascript
/**
 * @typedef {Object} WorkoutSet
 * @property {number} set_number - The sequential set number.
 * @property {number} weight_kg - Weight ALWAYS stored in kg in DB/JSON. UI converts to lbs.
 * @property {number} reps - Reps completed.
 * @property {number} rpe - Rate of Perceived Exertion (1-10).
 * @property {string} timestamp - ISO 8601 string of when set was logged.
 */

/**
 * @typedef {Object} WorkoutLog
 * @property {string} session_id - ISO Date e.g., "2024-10-24"
 * @property {string} day_id - e.g., "D1_Push_A"
 * @property {string} exercise_id - e.g., "ex_001"
 * @property {WorkoutSet[]} sets - Array of completed sets.
 * @property {"pending" | "synced"} sync_status - Managed by the offline sync queue.
 */
 
 Constraints
Idempotency: The session_id must be tied to the calendar date. If a user restarts the app, Atlas (backend) and Marcus (frontend) must query by date to prevent duplicate entries.
Conversion: Atlas expects payloads in strictly metric (kg). If Elena/Aria configured the SettingsPanel.js to lbs, Marcus must convert it to kg before dispatching the sync event.

