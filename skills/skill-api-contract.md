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