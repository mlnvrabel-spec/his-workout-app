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

const DB_NAME = 'HypertrophyDB';
const DB_VERSION = 2;

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
                reject(event.target.error);
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
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
        await this.init();
        return new Promise((resolve, reject) => {
            const request = this.db.transaction(['hv3_active_workout'], 'readwrite')
                .objectStore('hv3_active_workout').put({ ...workout, id: 'current' });
            request.onsuccess = () => resolve();
            request.onerror = event => reject(event.target.error);
        });
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

    /**
     * TIER 2: IndexedDB (Heavy State)
     * Saves a WorkoutLog to IndexedDB.
     * @param {WorkoutLog} log 
     * @returns {Promise<void>}
     */
    async saveWorkoutLog(log) {
        await this.init();
        
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['hv3_logs'], 'readwrite');
            const store = transaction.objectStore('hv3_logs');
            const request = store.put(log);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = (event) => {
                console.error("StorageManager: Failed to save workout log.", event.target.error);
                reject(event.target.error);
            };
        });
    }

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
            const transaction = this.db.transaction(['hv3_logs'], 'readonly');
            const store = transaction.objectStore('hv3_logs');
            const request = store.getAll();

            request.onsuccess = (event) => resolve(event.target.result);
            request.onerror = (event) => reject(event.target.error);
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
            const transaction = this.db.transaction(['hv3_logs'], 'readwrite');
            const store = transaction.objectStore('hv3_logs');
            const request = store.get([log.session_id, log.exercise_id]);

            request.onsuccess = () => {
                const storedLog = request.result;
                const storedLastSet = storedLog?.sets?.at(-1);
                const acknowledgedLastSet = log.sets?.at(-1);

                if (storedLog && storedLastSet?.timestamp === acknowledgedLastSet?.timestamp) {
                    storedLog.sync_status = 'synced';
                    store.put(storedLog);
                }
                resolve();
            };
            request.onerror = (event) => reject(event.target.error);
        });
    }

    /**
     * Archives a workout log to historical persistence.
     * @param {WorkoutLog} log
     * @returns {Promise<void>}
     */
    async archiveLog(log) {
        await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['hv3_archive'], 'readwrite');
            const store = transaction.objectStore('hv3_archive');
            const request = store.put(log);

            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

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
