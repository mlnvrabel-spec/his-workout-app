/**
 * WorkoutEngine.js
 * 
 * The Single Source of Truth for Hypertrophy Protocol.
 * Acts as the State Machine containing no UI rendering logic.
 */
import { StorageManager } from './StorageManager.js?v=2';

export class WorkoutEngine {
    constructor() {
        this.storage = new StorageManager();
        this.protocolData = null;
        /** @type {Object} Raw exercise_library from core_protocol.json */
        this.exerciseLibrary = null;
        /** @type {Object} swap_group_id → [exerciseId, ...] */
        this.swapGroupMap = {};
        /** @type {Object} exerciseId → swap_group_id */
        this.exerciseToGroup = {};
        /** @type {Object} Raw workout definitions from core_protocol.json */
        this.rawWorkouts = null;
        this.currentSession = {
            session_id: null,
            day_id: null,
            logs: {} // Mapping of exerciseId -> WorkoutLog
        };
        this.state = {
            day: 0,
            done: {},
            completedDays: {}
        };
        this.cycleId = null;
        this.syncQueued = false;

        window.addEventListener('workout:sync_completed', async (event) => {
            for (const acknowledgedLog of event.detail.logs || []) {
                await this.storage.markWorkoutLogSynced(acknowledgedLog);

                const currentLog = this.currentSession.logs[acknowledgedLog.exercise_id];
                const currentLastSet = currentLog?.sets?.at(-1);
                const acknowledgedLastSet = acknowledgedLog.sets?.at(-1);
                if (currentLastSet?.timestamp === acknowledgedLastSet?.timestamp) {
                    currentLog.sync_status = 'synced';
                }
            }
        });
    }

    get StorageManager() {
        return this.storage;
    }

    /**
     * Fetches the core protocol and initializes the storage manager.
     */
    async init() {
        await this.storage.init();
        try {
            const response = await fetch('/src/data/core_protocol.json');
            const data = await response.json();

            // Store raw reference data for swap operations
            this.exerciseLibrary = data.exercise_library;
            this.rawWorkouts = data.workouts;

            // Build swap group lookup maps
            (data.swap_groups || []).forEach(sg => {
                this.swapGroupMap[sg.id] = sg.options;
                sg.options.forEach(exId => {
                    this.exerciseToGroup[exId] = sg.id;
                });
            });
            
            // Reconstruct the payload Kai.js expects
            this._buildProtocolData(data);
            
            // Restore any persisted exercise swaps
            this._restoreSwaps();
            
            await this._restoreWorkoutCycle();
            
            console.log('[WorkoutEngine] Protocol loaded');
            window.dispatchEvent(new CustomEvent('engine:ready', { detail: { state: this.state, session: this.currentSession } }));
        } catch (e) {
            console.error('[WorkoutEngine] Failed to load protocol:', e);
        }
    }

    /**
     * Builds protocolData from raw data, resolving exercise library lookups.
     * @param {Object} data - raw core_protocol.json content
     */
    _buildProtocolData(data) {
        this.protocolData = data.workouts.map(w => {
            return {
                id: w.id,
                title: w.title,
                subtitle: w.subtitle,
                exercises: w.exercises.map(ex => {
                    return this._resolveExercise(ex);
                })
            };
        });
    }

    /**
     * Resolves a single exercise slot into the full UI-ready object.
     * @param {Object} ex - exercise slot from workout definition { id, sets, reps, rir, swap_group }
     * @returns {Object} UI-ready exercise object
     */
    _resolveExercise(ex) {
        const lib = this.exerciseLibrary[ex.id];
        if (!lib) {
            console.warn(`[WorkoutEngine] Missing library entry for exercise: ${ex.id}`);
            return {
                _exerciseId: ex.id,
                _swapGroup: ex.swap_group,
                name: ex.id,
                sets: ex.sets,
                reps: ex.reps,
                rir: ex.rir,
                rirClass: ex.rir == "0" ? "0" : "1",
                rest: "90s",
                technique: [],
                mistakes: [],
                visualization: '',
                vizText: '',
                proTip: ''
            };
        }
        return {
            _exerciseId: ex.id,
            _swapGroup: ex.swap_group,
            name: lib.name,
            sets: ex.sets,
            reps: ex.reps,
            rir: ex.rir,
            rirClass: ex.rir == "0" ? "0" : "1",
            rest: (lib.garmin.cat === "SQUAT" || lib.garmin.cat === "DEADLIFT") ? "3m" : "90s",
            technique: lib.technique,
            mistakes: lib.mistakes,
            visualization: lib.visualization.split(':')[0],
            vizText: lib.visualization.split(':')[1] ? lib.visualization.split(':')[1].trim() : '',
            proTip: lib.proTip
        };
    }

    /**
     * Returns the swap alternatives for a given exercise (excludes the current one).
     * @param {string} exerciseId - e.g., "PENDULUM_SQUAT"
     * @returns {{ id: string, name: string }[]} array of alternatives, or [] if none
     */
    getSwapOptions(exerciseId) {
        const groupId = this.exerciseToGroup[exerciseId];
        if (!groupId) return [];
        const options = this.swapGroupMap[groupId] || [];
        return options
            .filter(id => id !== exerciseId)
            .map(id => ({
                id,
                name: this.exerciseLibrary[id]?.name || id
            }));
    }

    /**
     * Returns the full swap group and current position for a given exercise.
     * Used by the UI to render position indicators.
     * @param {string} exerciseId
     * @returns {{ options: string[], currentIndex: number } | null}
     */
    getSwapGroupInfo(exerciseId) {
        const groupId = this.exerciseToGroup[exerciseId];
        if (!groupId) return null;
        const options = this.swapGroupMap[groupId] || [];
        return {
            options,
            currentIndex: options.indexOf(exerciseId)
        };
    }

    /**
     * Cycles through the swap group for a given exercise slot by +1 or -1, wrapping around.
     * @param {number} dayIndex
     * @param {number} exerciseSlot
     * @param {number} direction - +1 for next, -1 for previous
     */
    cycleSwap(dayIndex, exerciseSlot, direction) {
        const ex = this.protocolData[dayIndex]?.exercises[exerciseSlot];
        if (!ex) return;
        const info = this.getSwapGroupInfo(ex._exerciseId);
        if (!info || info.options.length < 2) return;
        const nextIdx = (info.currentIndex + direction + info.options.length) % info.options.length;
        this.swapExercise(dayIndex, exerciseSlot, info.options[nextIdx]);
    }


    /**
     * Swaps an exercise at a given day/slot to a new exercise from the same swap group.
     * Persists the swap to localStorage and dispatches an event.
     * @param {number} dayIndex - index into protocolData
     * @param {number} exerciseSlot - index into exercises array
     * @param {string} newExerciseId - the new exercise ID from the swap group
     */
    swapExercise(dayIndex, exerciseSlot, newExerciseId) {
        const dayData = this.protocolData[dayIndex];
        if (!dayData) return;
        const oldExercise = dayData.exercises[exerciseSlot];
        if (!oldExercise) return;

        // Build the new exercise using the original slot's sets/rir/swap_group
        const rawSlot = this.rawWorkouts[dayIndex]?.exercises[exerciseSlot];
        if (!rawSlot) return;

        const newSlot = { ...rawSlot, id: newExerciseId };
        dayData.exercises[exerciseSlot] = this._resolveExercise(newSlot);

        // Persist swap to localStorage
        this._saveSwap(dayIndex, exerciseSlot, newExerciseId);

        window.dispatchEvent(new CustomEvent('engine:state_updated', {
            detail: {
                type: 'exercise_swap',
                state: this.state,
                session: this.currentSession,
                dayIndex,
                exerciseSlot
            }
        }));

        console.log(`[WorkoutEngine] Swapped slot ${exerciseSlot} on day ${dayIndex}: ${oldExercise._exerciseId} → ${newExerciseId}`);
    }

    /**
     * Persists the current swap configuration to localStorage.
     */
    _saveSwap(dayIndex, exerciseSlot, newExerciseId) {
        const key = 'hv3_swaps';
        const swaps = JSON.parse(localStorage.getItem(key) || '{}');
        const slotKey = `${dayIndex}_${exerciseSlot}`;
        swaps[slotKey] = newExerciseId;
        localStorage.setItem(key, JSON.stringify(swaps));
    }

    /**
     * Restores saved exercise swaps from localStorage on init.
     */
    _restoreSwaps() {
        const key = 'hv3_swaps';
        const swaps = JSON.parse(localStorage.getItem(key) || '{}');
        Object.entries(swaps).forEach(([slotKey, newExId]) => {
            const [dayIdx, exSlot] = slotKey.split('_').map(Number);
            const dayData = this.protocolData[dayIdx];
            if (!dayData || !dayData.exercises[exSlot]) return;

            const rawSlot = this.rawWorkouts[dayIdx]?.exercises[exSlot];
            if (!rawSlot) return;

            // Verify the swap is valid (exercise exists in library)
            if (!this.exerciseLibrary[newExId]) return;

            const newSlot = { ...rawSlot, id: newExId };
            dayData.exercises[exSlot] = this._resolveExercise(newSlot);
        });
        console.log(`[WorkoutEngine] Restored ${Object.keys(swaps).length} saved swaps`);
    }

    /**
     * Initializes a session payload based on the WorkoutLog schema.
     * @param {string} day_id - The ID of the workout day (e.g., "D1_Push_A")
     */
    startWorkout(day_id) {
        // Session dates use the user's local calendar day for weekly commitment tracking.
        const session_id = this.storage.getDateKey();
        
        this.currentSession = {
            session_id: session_id,
            day_id: day_id,
            logs: {}
        };
        this.syncQueued = false;
        console.log(`[WorkoutEngine] Started workout session: ${session_id} for day: ${day_id}`);
    }

    _newCycleId() {
        return `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    }

    _getActiveWorkout() {
        return {
            cycleId: this.cycleId,
            day: this.state.day,
            done: this.state.done,
            completedDays: this.state.completedDays,
            updatedAt: new Date().toISOString()
        };
    }

    async _restoreWorkoutCycle() {
        const savedWorkout = await this.storage.loadActiveWorkout();
        if (savedWorkout) {
            this.cycleId = savedWorkout.cycleId;
            this.state = {
                day: savedWorkout.day || 0,
                done: savedWorkout.done || {},
                completedDays: savedWorkout.completedDays || {}
            };
        } else {
            this.cycleId = this._newCycleId();
            await this.storage.saveActiveWorkout(this._getActiveWorkout());
        }

        const pLen = this.protocolData?.length || 1;
        this.startWorkout(this.protocolData[this.state.day % pLen]?.id || `Day_${this.state.day}`);
    }

    async persistActiveWorkout() {
        await this.storage.saveActiveWorkout(this._getActiveWorkout());
    }

    getCompletionSummary(dayName = this.state.day) {
        const exercises = this.protocolData?.[dayName]?.exercises || [];
        const completed = Object.values(this.state.done[dayName] || {}).filter(Boolean).length;
        const total = exercises.length;
        const required = total ? Math.ceil(total * 0.5) : 0;
        const isFinished = Boolean(this.state.completedDays?.[dayName]);
        return {
            completed,
            total,
            required,
            eligible: total > 0 && completed >= required,
            isFinished
        };
    }

    isDayCompleted(dayName = this.state.day) {
        return Boolean(this.state.completedDays?.[dayName]);
    }

    /**
     * Interface for the UI layer to log an exercise set by name.
     * Maps the exercise name to its structured ID, saves to quicklog (localStorage),
     * and appends a heavy set log to IndexedDB.
     * @param {string} exName - Display name of the exercise
     * @param {string} weight - Weight logged
     * @param {string} reps - Reps logged
     */
    logExercise(exName, weight, reps) {
        const pLen = this.protocolData?.length || 1;
        const currentDayExercises = this.protocolData[this.state.day % pLen]?.exercises || [];
        const exercise = currentDayExercises.find(e => e.name === exName);
        const exerciseId = exercise ? exercise._exerciseId : exName;

        // Save light log for instant retrieval (Ghost Data)
        const dayId = this.currentSession.day_id || `Day_${this.state.day}`;
        this.storage.saveLightLog(dayId, exName, weight, reps);

        // Convert inputs to numbers
        const wtNum = parseFloat(weight) || 0;
        const repsNum = parseInt(reps) || 0;
        
        // Target RIR implementation: Target RPE = 10 - target RIR
        const targetRir = exercise ? parseInt(exercise.rir) : 2;
        const rpe = 10 - (isNaN(targetRir) ? 2 : targetRir);

        // Log set to heavy IndexedDB logs
        this.logSet(exerciseId, wtNum, repsNum, rpe);
    }

    /**
     * Pushes a set to the current session and calls StorageManager.saveSet(...)
     * @param {string} exerciseId - e.g., "ex_001"
     * @param {number} weight - Weight in kg
     * @param {number} reps - Reps completed
     * @param {number} rpe - Rate of Perceived Exertion (1-10)
     */
    async logSet(exerciseId, weight, reps, rpe) {
        if (!this.currentSession.session_id) {
            console.warn("[WorkoutEngine] Attempted to log a set without an active session.");
            return;
        }

        // Initialize the log for this exercise if it doesn't exist in the current session
        if (!this.currentSession.logs[exerciseId]) {
            this.currentSession.logs[exerciseId] = {
                session_id: this.currentSession.session_id,
                day_id: this.currentSession.day_id,
                exercise_id: exerciseId,
                sets: [],
                sync_status: "pending"
            };
        }

        const log = this.currentSession.logs[exerciseId];
        log.sync_status = "pending";
        this.syncQueued = false;
        
        // Construct the new set according to the WorkoutSet schema
        const newSet = {
            set_number: log.sets.length + 1,
            weight_kg: weight,
            reps: reps,
            rpe: rpe,
            timestamp: new Date().toISOString()
        };

        // Push to current session
        log.sets.push(newSet);

        // Call the newly defined alias saveSet in StorageManager
        await this.storage.saveSet(log);

        // MUST dispatch CustomEvent window.dispatchEvent(new CustomEvent('set:logged', { detail: { exerciseId, weight, reps } }))
        window.dispatchEvent(new CustomEvent('set:logged', { 
            detail: { 
                exerciseId: exerciseId, 
                exerciseName: this.exerciseLibrary?.[exerciseId]?.name || exerciseId,
                weight: weight, 
                reps: reps 
            } 
        }));
    }

    // --- STATE MUTATION & EVENT BROADCASTING ---

    /**
     * Updates the current workout day index and broadcasts state change.
     */
    async setDay(dayIndex) {
        this.state.day = dayIndex;
        
        // Auto-start a new session when day changes
        const pLen = this.protocolData?.length || 1;
        this.startWorkout(this.protocolData[dayIndex % pLen]?.id || `Day_${dayIndex}`);
        await this.persistActiveWorkout();

        window.dispatchEvent(new CustomEvent('engine:state_updated', { 
            detail: { type: 'day_change', state: this.state, session: this.currentSession } 
        }));
    }

    /**
     * Toggles the completion status of an exercise and broadcasts state change.
     */
    async toggleComplete(id, dayName) {
        if (this.isDayCompleted(dayName)) return;
        if (!this.state.done[dayName]) {
            this.state.done[dayName] = {};
        }
        this.state.done[dayName][id] = !this.state.done[dayName][id];
        await this.persistActiveWorkout();

        window.dispatchEvent(new CustomEvent('engine:state_updated', { 
            detail: { type: 'exercise_complete', state: this.state, session: this.currentSession } 
        }));
    }

    /**
     * Toggles all exercises for a day to a specific state.
     */
    async toggleAll(dayName, isDone, exercises) {
        if (this.isDayCompleted(dayName)) return;
        if (!this.state.done[dayName]) {
            this.state.done[dayName] = {};
        }
        exercises.forEach((ex, index) => {
            this.state.done[dayName][`ex-${this.state.day}-${index}`] = isDone;
        });
        await this.persistActiveWorkout();

        window.dispatchEvent(new CustomEvent('engine:state_updated', { 
            detail: { type: 'exercise_complete', state: this.state, session: this.currentSession } 
        }));
    }

    /**
     * Resets the completion status for a specific day and broadcasts state change.
     */
    async resetDayLogs(dayName) {
        if (this.isDayCompleted(dayName)) return;
        this.state.done[dayName] = {};
        this.syncQueued = false;
        await this.persistActiveWorkout();
        window.dispatchEvent(new CustomEvent('engine:state_updated', { 
            detail: { type: 'readiness_shift', state: this.state, session: this.currentSession } 
        }));
    }

    queueCompletedSessionForSync(dayName) {
        const exercises = this.protocolData?.[this.state.day]?.exercises || [];
        const isComplete = exercises.length > 0 && exercises.every((_, index) => this.state.done[dayName]?.[`ex-${this.state.day}-${index}`]);
        const logs = Object.values(this.currentSession.logs);

        if (isComplete && logs.length > 0 && !this.syncQueued) {
            this.syncQueued = true;
            window.dispatchEvent(new CustomEvent('workout:sync_queued', { detail: logs }));
        }
    }

    /**
     * Explicitly completes the current day. Individual exercise checks are optional.
     */
    async finishSession() {
        const completion = this.getCompletionSummary();
        if (completion.isFinished) return false;

        const protocolLen = this.protocolData?.length || 1;
        const mappedDay = this.state.day % protocolLen;
        const workout = this.protocolData?.[mappedDay];
        const completedAt = new Date().toISOString();
        const sessionId = this.storage.getDateKey();
        this.state.completedDays ||= {};
        this.state.completedDays[this.state.day] = true;

        const allDaysFinished = Array.from({ length: protocolLen }, (_, index) => this.state.completedDays[index]).every(Boolean);
        const nextDay = allDaysFinished ? 0 : (this.state.day + 1) % protocolLen;
        const summary = {
            id: `${this.cycleId}-${this.state.day}`,
            cycleId: this.cycleId,
            day: this.state.day,
            sessionId,
            title: workout?.title || 'Workout',
            subtitle: workout?.subtitle || '',
            completedExercises: completion.completed,
            totalExercises: completion.total,
            completedAt
        };

        if (allDaysFinished) {
            this.cycleId = this._newCycleId();
            this.state = { day: nextDay, done: {}, completedDays: {} };
        } else {
            this.state.day = nextDay;
        }
        this.startWorkout(this.protocolData[nextDay]?.id || `Day_${nextDay}`);
        await this.storage.completeWorkoutDay(summary, this._getActiveWorkout());
        this.storage.setLightState('hv3_memory', {
            time: Date.now(),
            title: summary.title,
            subtitle: summary.subtitle,
            dayIndex: summary.day
        });
        this.storage.recordCompletedSession(sessionId);

        window.dispatchEvent(new CustomEvent('workout:finished', {
            detail: { session: summary, state: this.state }
        }));
        window.dispatchEvent(new CustomEvent('engine:state_updated', {
            detail: { type: 'workout_finished', state: this.state, session: this.currentSession }
        }));
        return true;
    }

    /**
     * The 90-Day Pruning Rule (3 Months): 
     * Scans the IndexedDB archive and aggressively deletes logs older than 60 days
     * to keep the app ultra-lightweight.
     */
    async pruneOldData() {
        await this.storage.init();
        const CUTOFF_MS = 60 * 24 * 60 * 60 * 1000; // 60 days
        const cutoffDate = new Date(Date.now() - CUTOFF_MS).toISOString();

        return new Promise((resolve, reject) => {
            if (!this.storage.db) return resolve();
            
            const transaction = this.storage.db.transaction(['hv3_archive'], 'readwrite');
            const store = transaction.objectStore('hv3_archive');
            const request = store.getAll();

            request.onsuccess = (event) => {
                const logs = event.target.result || [];
                let deletedCount = 0;
                logs.forEach(log => {
                    // session_id is typically an ISO date string like "2024-10-24"
                    if (log.session_id < cutoffDate) {
                        store.delete([log.session_id, log.exercise_id]);
                        deletedCount++;
                    }
                });
                
                if (deletedCount > 0) {
                    console.log(`[WorkoutEngine] Garbage Collection: Pruned ${deletedCount} old logs from archive.`);
                }
                resolve();
            };
            request.onerror = (event) => {
                console.error("[WorkoutEngine] Garbage Collection failed.", event.target.error);
                reject(event.target.error);
            };
        });
    }
}
