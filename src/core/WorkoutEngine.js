/**
 * WorkoutEngine.js
 *
 * The Single Source of Truth for Hypertrophy Protocol.
 * Acts as the State Machine containing no UI rendering logic.
 */
import { StorageManager } from './StorageManager.js';

export class WorkoutEngine {
    constructor() {
        this.storage = new StorageManager();
        this.protocolData = null;
        /** @type {Object} Raw exercise_library from core_protocol.json */
        this.exerciseLibrary = null;
        /** @type {Object} Swap group lookup. */
        this.swapGroupMap = {};
        /** @type {Object} Swap group lookup. */
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
        this.lastCompletedSummaryId = null;
        this.syncQueued = false;
        this.pending = false;
        this._operations = Promise.resolve();
        this.summaries = [];
        this.logs = [];
        if (typeof window.BroadcastChannel === 'function') {
            this.channel = new window.BroadcastChannel('hypertrophy-workout');
            this.channel.onmessage = () => this.refresh();
        }
        window.addEventListener('focus', () => this.refresh());

        window.addEventListener('workout:sync_completed', () => this.refresh());
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

            this.defaultProtocol = structuredClone(this.protocolData);
            await this._restoreWorkoutCycle();

            console.log('[WorkoutEngine] Protocol loaded');
            window.dispatchEvent(new CustomEvent('engine:ready', { detail: { state: this.state, session: this.currentSession } }));
        } catch (e) {
            console.error('[WorkoutEngine] Failed to load protocol:', e);
            this._error(e);
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
     * @param {Object} ex - exercise slot from workout definition { id, sets, reps, rir, rest_sec, swap_group }
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
                rest: this._formatRest(ex.rest_sec),
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
            rest: this._formatRest(ex.rest_sec),
            technique: lib.technique,
            mistakes: lib.mistakes,
            visualization: lib.visualization.split(':')[0],
            vizText: lib.visualization.split(':')[1] ? lib.visualization.split(':')[1].trim() : '',
            proTip: lib.proTip
        };
    }

    /**
     * Formats protocol-owned rest targets for the exercise-card UI.
     * @param {number} seconds
     * @returns {string}
     */
    _formatRest(seconds) {
        const restSeconds = Number.isFinite(seconds) ? seconds : 90;
        return restSeconds % 60 === 0 ? `${restSeconds / 60}m` : `${restSeconds}s`;
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
    async swapExercise(dayIndex, exerciseSlot, newExerciseId) {
        const expectedCycle = this.cycleId;
        const slot = this.rawWorkouts?.[dayIndex]?.exercises[exerciseSlot];
        if (!slot || !this.swapGroupMap[slot.swap_group]?.includes(newExerciseId)) return false;
        return this._commit('exercise_swap', (workout) => {
            if (workout.cycleId !== expectedCycle || workout.completedDays[dayIndex]) return false;
            workout.swaps ||= {};
            workout.swaps[`${dayIndex}_${exerciseSlot}`] = newExerciseId;
            // A substitution is a different exercise; don't carry over its check.
            if (workout.done[dayIndex]) delete workout.done[dayIndex][`ex-${dayIndex}-${exerciseSlot}`];
            return true;
        });
    }

    /**
     * Persists the current swap configuration to localStorage.
     */
    _saveSwap(dayIndex, exerciseSlot, newExerciseId) {
        const key = 'hv3_swaps';
        const swaps = this.storage.getLightState(key) || {};
        const slotKey = `${dayIndex}_${exerciseSlot}`;
        swaps[slotKey] = newExerciseId;
        localStorage.setItem(key, JSON.stringify(swaps));
    }

    /**
     * Restores saved exercise swaps from localStorage on init.
     */
    _restoreSwaps() {
        const key = 'hv3_swaps';
        const swaps = this.storage.getLightState(key) || {};
        Object.entries(swaps).forEach(([slotKey, newExId]) => {
            const [dayIdx, exSlot] = slotKey.split('_').map(Number);
            const dayData = this.protocolData[dayIdx];
            if (!dayData || !dayData.exercises[exSlot]) return;

            const rawSlot = this.rawWorkouts[dayIdx]?.exercises[exSlot];
            if (!rawSlot) return;

            // Ignore stale swaps from an earlier protocol order or an incompatible group.
            const expectedGroup = rawSlot.swap_group;
            const allowedOptions = this.swapGroupMap[expectedGroup] || [];
            if (!this.exerciseLibrary[newExId] || !allowedOptions.includes(newExId)) return;

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
        const session_id = `${this.cycleId}:${this.state.day}`;
        this.currentSession = {
            session_id, day_id,
            logs: Object.fromEntries(this.logs.filter(log => log.session_id === session_id).map(log => [log.exercise_id, log]))
        };
    }

    _newCycleId() {
        return `cycle-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    }

    _normalize(saved, summaries = []) {
        const count = this.protocolData.length;
        const workout = saved ? structuredClone(saved) : {
            cycleId: this._newCycleId(), day: 0, activeDay: 0, done: {}, completedDays: {}, lastCompletedSummaryId: null
        };
        workout.done ||= {};
        workout.completedDays ||= {};
        workout.day = Number.isInteger(workout.day) && workout.day >= 0 && workout.day < count ? workout.day : 0;
        workout.activeDay ??= workout.day;
        if (workout.completedDays[workout.activeDay]) {
            workout.activeDay = this._nextDay(workout, workout.activeDay);
        }
        if (!Object.hasOwn(workout, 'lastCompletedSummaryId')) {
            workout.lastCompletedSummaryId = summaries.filter(s => s.cycleId === workout.cycleId).sort((a,b) => b.completedAt.localeCompare(a.completedAt))[0]?.id || null;
        }
        if (!Array.isArray(workout.legacyDates)) {
            const represented = new Set(summaries.map(s => s.sessionId));
            workout.legacyDates = (this.storage.getLightState('hv3_completed_sessions') || []).filter(d => !represented.has(d));
        }
        return workout;
    }

    _nextDay(workout, from) {
        for (let offset = 1; offset <= this.protocolData.length; offset++) {
            const day = (from + offset) % this.protocolData.length;
            if (!workout.completedDays[day]) return day;
        }
        return 0;
    }

    _adopt(workout, summaries, logs = this.logs) {
        this.cycleId = workout.cycleId;
        this.lastCompletedSummaryId = workout.lastCompletedSummaryId;
        this.state = workout;
        this.summaries = summaries;
        this.logs = logs;
        if (this.defaultProtocol) {
            this.protocolData = structuredClone(this.defaultProtocol);
            for (const [key, id] of Object.entries(workout.swaps || {})) {
                const [day, slot] = key.split('_').map(Number);
                const raw = this.rawWorkouts?.[day]?.exercises[slot];
                if (raw && this.swapGroupMap[raw.swap_group]?.includes(id)) this.protocolData[day].exercises[slot] = this._resolveExercise({ ...raw, id });
            }
            for (const summary of summaries) {
                if (summary.cycleId === workout.cycleId && workout.completedDays[summary.day] && summary.exercises) {
                    this.protocolData[summary.day].exercises = structuredClone(summary.exercises);
                }
            }
        }
        this.storage.rebuildCompletionViews(summaries, workout.legacyDates);
        this.startWorkout(this.protocolData[workout.day].id);
    }

    _emit(type) {
        window.dispatchEvent(new CustomEvent('engine:state_updated', { detail: { type, state: this.state, session: this.currentSession } }));
        window.dispatchEvent(new CustomEvent('workoutStateUpdated', { detail: {
            title: this.protocolData[this.state.activeDay]?.title,
            logsText: this.logs.map(l => `${l.exercise_id}: ${l.sets.map(s => `${s.weight_kg}kg × ${s.reps}`).join(', ')}`).join('; ')
        } }));
    }

    _error(error) {
        window.dispatchEvent(new CustomEvent('engine:error', { detail: { message: error.message || 'Could not save. Please try again.' } }));
    }

    async _restoreWorkoutCycle() {
        const result = await this.storage.mutateWorkout((saved, summaries, logs) => ({ workout: this._normalize(saved, summaries), summaries, logs }));
        this._adopt(result.workout, result.summaries, result.logs);
    }

    async refresh() {
        if (!this.protocolData || this.pending) return;
        return this._commit('refresh', () => false);
    }

    _commit(type, change) {
        const operation = async () => {
            try {
                const result = await this.storage.mutateWorkout((saved, summaries, logs) => {
                    const workout = this._normalize(saved, summaries);
                    const changeResult = change(workout, summaries, logs);
                    const changes = typeof changeResult === 'object' && changeResult !== null ? changeResult : {};
                    return { workout, summaries, logs, changed: Boolean(changeResult), ...changes };
                });
                this._adopt(result.workout, result.summaries, result.logs);
                if (result.summary) {
                    window.dispatchEvent(new CustomEvent('workout:finished', { detail: { session: result.summary, state: this.state, cycleCompleted: result.cycleCompleted } }));
                }
                this._emit(type);
                if (result.changed) this.channel?.postMessage({ revision: result.workout.revision });
                return result.changed;
            } catch (error) {
                this._error(error);
                return false;
            }
        };
        this._operations = this._operations.then(operation, operation);
        return this._operations;
    }

    async setDay(day) {
        if (!Number.isInteger(day) || !this.protocolData[day] || this.pending) return false;
        return this._commit('day_change', workout => { workout.day = day; return true; });
    }

    async continueWorkout() { return this.setDay(this.state.activeDay); }

    async toggleComplete(id, day) {
        if (this.pending) return false;
        const cycle = this.cycleId;
        return this._commit('exercise_complete', workout => {
            if (workout.cycleId !== cycle || workout.completedDays[day] || !this.protocolData[day]?.exercises.some((_,i) => id === `ex-${day}-${i}`)) return false;
            workout.done[day] ||= {};
            workout.done[day][id] = !workout.done[day][id];
            workout.activeDay = day;
            return true;
        });
    }

    async toggleAll(day, isDone, exercises) {
        if (this.pending) return false;
        const cycle = this.cycleId;
        return this._commit('exercise_complete', workout => {
            if (workout.cycleId !== cycle || workout.completedDays[day]) return false;
            workout.done[day] = Object.fromEntries(exercises.map((_, i) => [`ex-${day}-${i}`, isDone]));
            workout.activeDay = day;
            return true;
        });
    }

    async resetDayLogs(day) {
        if (this.pending) return false;
        const cycle = this.cycleId;
        return this._commit('readiness_shift', workout => {
            if (workout.cycleId !== cycle || workout.completedDays[day]) return false;
            workout.done[day] = {};
            return true;
        });
    }

    getCompletionSummary(day = this.state.day) {
        const total = this.protocolData?.[day]?.exercises.length || 0;
        const completed = Array.from({length:total}, (_,i) => this.state.done[day]?.[`ex-${day}-${i}`]).filter(Boolean).length;
        return { total, completed, required: 0, eligible: total > 0, isFinished: this.isDayCompleted(day) };
    }

    isDayCompleted(day = this.state.day) { return Boolean(this.state.completedDays?.[day]); }
    getLastCompletion() { return this.summaries.find(s => s.id === this.lastCompletedSummaryId) || null; }
    canUndoLastCompletion() { return Boolean(this.getLastCompletion()); }
    getDaySummary(day = this.state.day) { return this.summaries.find(s => s.cycleId === this.cycleId && s.day === day) || null; }

    async finishSession() {
        if (this.pending) return false;
        const cycle = this.cycleId, day = this.state.day;
        this.pending = true;
        this._emit('saving');
        try {
            return await this._commit('workout_finished', (workout, summaries) => {
                if (workout.cycleId !== cycle || workout.completedDays[day]) return false;
                // Resolve the current persisted substitutions, not this window's stale view.
                const exercises = (this.defaultProtocol || this.protocolData)[day].exercises.map((ex, slot) => {
                    const id = workout.swaps?.[`${day}_${slot}`];
                    return id ? this._resolveExercise({ ...this.rawWorkouts[day].exercises[slot], id }) : structuredClone(ex);
                });
                const summary = {
                    id: `${cycle}:${day}`, cycleId: cycle, day,
                    sessionId: this.storage.getDateKey(), completedAt: new Date().toISOString(),
                    title: this.protocolData[day].title, subtitle: this.protocolData[day].subtitle,
                    exercises, totalExercises: exercises.length,
                    completedExercises: exercises.filter((_,i) => workout.done[day]?.[`ex-${day}-${i}`]).length,
                    done: structuredClone(workout.done), swaps: structuredClone(workout.swaps || {}),
                    completedDaysBefore: { ...workout.completedDays }
                };
                workout.completedDays[day] = true;
                const cycleCompleted = this.protocolData.every((_, i) => workout.completedDays[i]);
                if (cycleCompleted) {
                    const draft = workout.nextCycleDraft;
                    summary.nextCycleId = draft?.cycleId || this._newCycleId();
                    workout.cycleId = summary.nextCycleId;
                    workout.done = draft?.done || {};
                    workout.swaps = draft?.swaps || workout.swaps || {};
                    workout.completedDays = {};
                    delete workout.nextCycleDraft;
                    workout.activeDay = workout.day = 0;
                } else workout.activeDay = workout.day = this._nextDay(workout, day);
                workout.lastCompletedSummaryId = summary.id;
                summaries.push(summary);
                return { summary, cycleCompleted };
            });
        } finally { this.pending = false; this._emit('saved'); }
    }

    async reopenLastDay() {
        if (this.pending || !this.canUndoLastCompletion()) return false;
        const target = this.lastCompletedSummaryId;
        this.pending = true;
        this._emit('saving');
        try {
            return await this._commit('day_reopened', (workout, summaries) => {
                const index = summaries.findIndex(s => s.id === target);
                if (index < 0 || workout.lastCompletedSummaryId !== target) return false;
                const summary = summaries[index];
                if (summary.cycleId !== workout.cycleId) {
                    workout.nextCycleDraft = { cycleId: workout.cycleId, done: workout.done, swaps: workout.swaps || {} };
                    workout.cycleId = summary.cycleId;
                    workout.done = structuredClone(summary.done || {});
                    workout.swaps = structuredClone(summary.swaps || {});
                    workout.completedDays = { ...summary.completedDaysBefore };
                } else delete workout.completedDays[summary.day];
                workout.day = workout.activeDay = summary.day;
                workout.lastCompletedSummaryId = null;
                summaries.splice(index, 1);
                return { deleteSummary: target };
            });
        } finally { this.pending = false; this._emit('saved'); }
    }

    async logExercise(name, weight, reps) {
        const exercise = this.protocolData[this.state.day].exercises.find(ex => ex.name === name);
        if (!exercise) return false;
        const rir = parseInt(exercise.rir) || 0;
        return this.logSet(exercise._exerciseId, Number(weight), Number(reps), 10 - rir);
    }

    async logSet(exerciseId, weight, reps, rpe) {
        if (this.pending) return false;
        if (!Number.isFinite(weight) || weight < 0 || weight > 2000 || !Number.isInteger(reps) || reps < 1 || reps > 1000 || !Number.isFinite(rpe) || rpe < 0 || rpe > 10) {
            this._error(new Error('Enter a valid load and a whole number of reps.'));
            return false;
        }
        const cycle = this.cycleId, day = this.state.day;
        let savedLog;
        const success = await this._commit('set_saved', (workout, summaries, logs) => {
            if (workout.cycleId !== cycle || workout.completedDays[day]) return false;
            const slot = this.protocolData[day].exercises.findIndex(ex => ex._exerciseId === exerciseId);
            if (slot < 0 || (workout.swaps?.[`${day}_${slot}`] && workout.swaps[`${day}_${slot}`] !== exerciseId)) return false;
            const sessionId = `${cycle}:${day}`;
            savedLog = logs.find(l => l.session_id === sessionId && l.exercise_id === exerciseId) || {
                session_id: sessionId, workout_id: sessionId, day_id: this.protocolData[day].id,
                exercise_id: exerciseId, sets: [], sync_status: 'pending'
            };
            savedLog.sets.push({ set_number: savedLog.sets.length + 1, weight_kg: weight, reps, rpe, timestamp: new Date().toISOString() });
            savedLog.sync_status = 'pending';
            if (!logs.includes(savedLog)) logs.push(savedLog);
            workout.activeDay = day;
            return { log: savedLog };
        });
        if (success) {
            window.dispatchEvent(new CustomEvent('set:logged', { detail: { exerciseId, exerciseName: this.exerciseLibrary?.[exerciseId]?.name || exerciseId, weight, reps } }));
            window.dispatchEvent(new CustomEvent('workout:sync_queued', { detail: [savedLog] }));
        }
        return success;
    }

    getExerciseLogs(exerciseId) { return this.currentSession.logs[exerciseId]?.sets || []; }

    getPreviousLog(exerciseId) {
        return this.logs.filter(l => l.exercise_id === exerciseId && l.session_id !== this.currentSession.session_id && l.sets.length)
            .sort((a,b) => b.sets.at(-1).timestamp.localeCompare(a.sets.at(-1).timestamp))[0] || null;
    }

    async exportHistory() {
        return this.storage.exportSnapshot();
    }
}
