/**
 * @typedef {Object} WorkoutSet
 * @property {number} set_number - The sequential set number.
 * @property {number} weight_kg - Load stored and displayed in kilograms.
 * @property {number} reps - Reps completed.
 * @property {number} rpe - Rate of Perceived Exertion (1-10).
 * @property {string} timestamp - ISO 8601 string of when set was logged.
 */

/**
 * @typedef {Object} WorkoutLog
 * @property {string} session_id - Stable cycle:day ID; legacy logs use calendar dates.
 * @property {string} day_id - e.g., "D1_Push_A"
 * @property {string} exercise_id - e.g., "ex_001"
 * @property {WorkoutSet[]} sets - Array of completed sets.
 * @property {"pending" | "synced"} sync_status - Managed by the offline sync queue.
 */

const DB_NAME = 'HypertrophyDB';
const DB_VERSION = 3;

/**
 * StorageManager
 * Implements a dual-tier storage system:
 * - standard localStorage for light state (like hv2_memory)
 * - a lightweight, promise-based IndexedDB wrapper for heavy states (hv3_logs, hv3_archive)
 */
export class StorageManager {
    constructor() {
        this.db = null;
        this.initPromise = null;
    }

    /**
     * Initializes the IndexedDB database.
     * @returns {Promise<void>}
     */
    async init() {
        if (this.db) return Promise.resolve();
        if (this.initPromise) return this.initPromise;

        this.initPromise = new Promise((resolve, reject) => {
            const request = window.indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = (event) => {
                console.error("StorageManager: IndexedDB error:", event.target.error);
                this.initPromise = null;
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                this.db.onversionchange = () => { this.db.close(); this.db = null; this.initPromise = null; };
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                if (!db.objectStoreNames.contains('hv3_sets')) {
                    db.createObjectStore('hv3_sets', { keyPath: ['session_id', 'day_id', 'exercise_id'] });
                }

                // hv3_logs: Current session data
                if (!db.objectStoreNames.contains('hv3_logs')) {
                    // Create an object store with a composite key path of session_id and exercise_id
                    db.createObjectStore('hv3_logs', { keyPath: ['session_id', 'exercise_id'] });
                }

                // hv3_archive: Historical logs
                if (!db.objectStoreNames.contains('hv3_archive')) {
                    db.createObjectStore('hv3_archive', { keyPath: ['session_id', 'exercise_id'] });
                }

                // One durable record for the resumable program cycle, plus immutable
                // summaries for days the user explicitly finishes.
                if (!db.objectStoreNames.contains('hv3_active_workout')) {
                    db.createObjectStore('hv3_active_workout', { keyPath: 'id' });
                }

                if (!db.objectStoreNames.contains('hv3_completed_workouts')) {
                    db.createObjectStore('hv3_completed_workouts', { keyPath: 'id' });
                }
            };
        });

        return this.initPromise;
    }

    /**
     * TIER 1: localStorage (Light State)
     * Retrieves a light state object from localStorage.
     * @param {string} key
     * @returns {any}
     */
    getLightState(key) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : null;
        } catch (error) {
            console.error(`StorageManager: Failed to parse light state for key "${key}"`, error);
            return null;
        }
    }

    /**
     * TIER 1: localStorage (Light State)
     * Saves a light state object to localStorage.
     * @param {string} key
     * @param {any} value
     */
    setLightState(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error(`StorageManager: Failed to save light state for key "${key}"`, error);
        }
    }

    /**
     * TIER 1: Synchronous UI Getters for Kai.js Rendering
     */
    loadMemory() {
        return this.getLightState('hv3_memory');
    }

    getWeeklyStats(date = new Date()) {
        const weekStart = this.getWeekStart(date);
        const weekDays = Array.from({ length: 7 }, (_, index) => {
            const date = new Date(`${weekStart}T00:00:00`);
            date.setDate(date.getDate() + index);
            return this.getDateKey(date);
        });
        const sessions = new Set(this.getLightState('hv3_completed_sessions') || []);
        const completedDates = new Set(weekDays.filter(date => sessions.has(date)));
        const target = 4;

        return {
            target,
            completed: completedDates.size,
            consistencyRatio: Math.min(completedDates.size / target, 1),
            weekStart,
            days: weekDays.map(date => ({ date, completed: completedDates.has(date) }))
        };
    }

    /**
     * Returns a local YYYY-MM-DD key so training weeks respect the user's locale.
     * @param {Date} date
     */
    getDateKey(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    /**
     * Returns the Monday date key for the calendar week containing the supplied date.
     * @param {Date} date
     */
    getWeekStart(date = new Date()) {
        const start = new Date(date);
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
        return this.getDateKey(start);
    }

    /**
     * Records a completed training day and derives calendar-week progress.
     * The four planned weekly sessions represent the target.
     * @param {string} sessionId - ISO date string for the completed session.
     */
    recordCompletedSession(sessionId) {
        const sessions = new Set(this.getLightState('hv3_completed_sessions') || []);
        sessions.add(sessionId);

        this.setLightState('hv3_completed_sessions', [...sessions].sort());
        const weeklyStats = this.getWeeklyStats();
        this.setLightState('hv3_weekly', weeklyStats);
        return weeklyStats;
    }

    loadLog(dayId, exName) {
        return this.getLightState(`hv3_quicklog_${dayId}_${exName}`) || { weight: '', reps: '', isGhost: true };
    }

    saveLightLog(dayId, exName, weight, reps) {
        this.setLightState(`hv3_quicklog_${dayId}_${exName}`, { weight, reps, isGhost: false });
    }

    async loadActiveWorkout() {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.db.transaction(['hv3_active_workout'], 'readonly')
                .objectStore('hv3_active_workout').get('current');
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = event => reject(event.target.error);
        });
    }

    async saveActiveWorkout(workout) {
        return this._put('hv3_active_workout', { ...workout, id: 'current' });
    }

    async _put(store, value) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction([store], 'readwrite');
            tx.objectStore(store).put(value);
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () => reject(tx.error || new Error('Local save failed'));
        });
    }

    // The reducer is synchronous and runs inside the serialized IDB transaction.
    // Every window reads the latest record before applying its own intent.
    async mutateWorkout(reducer) {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['hv3_active_workout', 'hv3_completed_workouts', 'hv3_sets', 'hv3_logs'], 'readwrite');
            const active = tx.objectStore('hv3_active_workout');
            const history = tx.objectStore('hv3_completed_workouts');
            const a = active.get('current');
            const h = history.getAll();
            const legacy = tx.objectStore('hv3_logs').getAll();
            const l = tx.objectStore('hv3_sets').getAll();
            let result, failure;
            l.onsuccess = () => {
                try {
                    result = reducer(a.result || null, h.result || [], [...(legacy.result || []), ...(l.result || [])]);
                    if (!result) return;
                    if (result.workout) {
                        result.workout.revision = (a.result?.revision || 0) + 1;
                        active.put({ ...result.workout, id: 'current' });
                    }
                    if (result.summary) history.put(result.summary);
                    if (result.deleteSummary) history.delete(result.deleteSummary);
                    if (result.log) tx.objectStore('hv3_sets').put(result.log);
                } catch (error) { failure = error; tx.abort(); }
            };
            tx.oncomplete = () => resolve(result);
            tx.onabort = tx.onerror = () => reject(failure || tx.error || new Error('Local save failed'));
        });
    }

    async exportSnapshot() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['hv3_active_workout', 'hv3_completed_workouts', 'hv3_sets', 'hv3_logs'], 'readonly');
            const active = tx.objectStore('hv3_active_workout').get('current');
            const workouts = tx.objectStore('hv3_completed_workouts').getAll();
            const sets = tx.objectStore('hv3_sets').getAll();
            const legacy = tx.objectStore('hv3_logs').getAll();
            tx.oncomplete = () => resolve({
                version: 1, exportedAt: new Date().toISOString(), active: active.result || null,
                workouts: workouts.result.sort((a,b) => b.completedAt.localeCompare(a.completedAt)),
                logs: [...legacy.result, ...sets.result]
            });
            tx.onerror = tx.onabort = () => reject(tx.error || new Error('Could not read history'));
        });
    }

    async getCompletedWorkouts() {
        await this.init();
        return new Promise((resolve, reject) => {
            const req = this.db.transaction('hv3_completed_workouts').objectStore('hv3_completed_workouts').getAll();
            req.onsuccess = () => resolve(req.result.sort((a,b) => b.completedAt.localeCompare(a.completedAt)));
            req.onerror = () => reject(req.error);
        });
    }

    rebuildCompletionViews(summaries, legacyDates = []) {
        const ordered = [...summaries].sort((a,b) => b.completedAt.localeCompare(a.completedAt));
        const latest = ordered[0];
        this.setLightState('hv3_memory', latest ? {
            time: new Date(latest.completedAt).getTime(), title: latest.title,
            subtitle: latest.subtitle, dayIndex: latest.day
        } : null);
        this.setLightState('hv3_completed_sessions', [...new Set([...legacyDates, ...ordered.map(s => s.sessionId)])].sort());
    }

    /**
     * Writes the completed-day history and next resumable state in one IndexedDB transaction.
     */
    async completeWorkoutDay(summary, nextWorkout) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ['hv3_active_workout', 'hv3_completed_workouts'],
                'readwrite'
            );
            transaction.objectStore('hv3_completed_workouts').put(summary);
            transaction.objectStore('hv3_active_workout').put({ ...nextWorkout, id: 'current' });
            transaction.oncomplete = () => resolve();
            transaction.onerror = event => reject(event.target.error);
            transaction.onabort = event => reject(event.target.error);
        });
    }

    async findLatestCompletedWorkout(cycleId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.db.transaction(['hv3_completed_workouts'], 'readonly')
                .objectStore('hv3_completed_workouts').getAll();
            request.onsuccess = () => {
                const summaries = request.result
                    .filter(summary => summary.cycleId === cycleId)
                    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt));
                resolve(summaries[0] || null);
            };
            request.onerror = event => reject(event.target.error);
        });
    }

    async reopenWorkoutDay(summaryId, restoredWorkout, sessionId) {
        await this.init();
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(
                ['hv3_active_workout', 'hv3_completed_workouts'],
                'readwrite'
            );
            const completedWorkouts = transaction.objectStore('hv3_completed_workouts');
            let hasAnotherSessionOnDate = false;
            let previousCompletion = null;
            const summariesRequest = completedWorkouts.getAll();

            summariesRequest.onsuccess = () => {
                const remainingSummaries = summariesRequest.result.filter(summary => summary.id !== summaryId);
                hasAnotherSessionOnDate = remainingSummaries.some(summary => summary.sessionId === sessionId);
                previousCompletion = remainingSummaries
                    .sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0] || null;
                transaction.objectStore('hv3_active_workout').put({ ...restoredWorkout, id: 'current' });
                completedWorkouts.delete(summaryId);
            };
            summariesRequest.onerror = event => reject(event.target.error);

            transaction.oncomplete = () => {
                const sessions = new Set(this.getLightState('hv3_completed_sessions') || []);
                if (!hasAnotherSessionOnDate) sessions.delete(sessionId);
                this.setLightState('hv3_completed_sessions', [...sessions].sort());
                this.setLightState('hv3_weekly', this.getWeeklyStats());
                this.setLightState('hv3_memory', previousCompletion ? {
                    time: new Date(previousCompletion.completedAt).getTime(),
                    title: previousCompletion.title,
                    subtitle: previousCompletion.subtitle,
                    dayIndex: previousCompletion.day
                } : null);
                resolve();
            };
            transaction.onerror = event => reject(event.target.error);
            transaction.onabort = event => reject(event.target.error);
        });
    }

    /**
     * TIER 2: IndexedDB (Heavy State)
     * Saves a WorkoutLog to IndexedDB.
     * @param {WorkoutLog} log
     * @returns {Promise<void>}
     */
    async saveWorkoutLog(log) { return this._put('hv3_logs', log); }

    /**
     * Method to fulfill direct pushes of sets to the StorageManager.
     * @param {WorkoutLog} log
     * @returns {Promise<void>}
     */
    async saveSet(log) {
        return this.saveWorkoutLog(log);
    }

    /**
     * Retrieves all workout logs from the current session state.
     * @returns {Promise<WorkoutLog[]>}
     */
    async getWorkoutLogs() {
        await this.init();
        return new Promise((resolve, reject) => {
            const tx = this.db.transaction(['hv3_logs', 'hv3_sets']);
            const old = tx.objectStore('hv3_logs').getAll();
            const current = tx.objectStore('hv3_sets').getAll();
            tx.oncomplete = () => resolve([...old.result, ...current.result]);
            tx.onabort = tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Marks a locally saved log as acknowledged by the bridge, provided no newer set
     * has been saved for the same exercise since that acknowledgement was sent.
     * @param {WorkoutLog} log
     * @returns {Promise<void>}
     */
    async markWorkoutLogSynced(log) {
        await this.init();
        return new Promise((resolve, reject) => {
            const storeName = log.workout_id ? 'hv3_sets' : 'hv3_logs';
            const tx = this.db.transaction(storeName, 'readwrite');
            const store = tx.objectStore(storeName);
            const req = store.get(log.workout_id
                ? [log.session_id, log.day_id, log.exercise_id] : [log.session_id, log.exercise_id]);
            req.onsuccess = () => {
                const saved = req.result;
                if (saved && saved.sets.length === log.sets.length && saved.sets.at(-1)?.timestamp === log.sets.at(-1)?.timestamp) {
                    store.put({ ...saved, sync_status: 'synced' });
                }
            };
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () => reject(tx.error);
        });
    }

    /**
     * Archives a workout log to historical persistence.
     * @param {WorkoutLog} log
     * @returns {Promise<void>}
     */
    async archiveLog(log) { return this._put('hv3_archive', log); }

    /**
     * Retrieves the most recent log for a specific exercise from the archive.
     * @param {string} exerciseId
     * @returns {Promise<WorkoutLog|null>}
     */
    async getLastArchiveLog(exerciseId) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['hv3_archive'], 'readonly');
            const store = transaction.objectStore('hv3_archive');
            const request = store.getAll();

            request.onsuccess = (event) => {
                const logs = event.target.result || [];
                const exerciseLogs = logs.filter(l => l.exercise_id === exerciseId);

                if (exerciseLogs.length === 0) {
                    resolve(null);
                    return;
                }

                // Sort by session_id (which is an ISO date string) descending
                exerciseLogs.sort((a, b) => b.session_id.localeCompare(a.session_id));
                resolve(exerciseLogs[0]);
            };

            request.onerror = (event) => {
                console.error("StorageManager: Failed to get archive logs", event.target.error);
                reject(event.target.error);
            };
        });
    }
}
