import assert from 'node:assert/strict';

const listeners = new Map();
const localState = new Map();

globalThis.CustomEvent = class CustomEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.detail = options.detail;
    }
};
globalThis.window = {
    addEventListener(type, listener) {
        listeners.set(type, [...(listeners.get(type) || []), listener]);
    },
    dispatchEvent(event) {
        for (const listener of listeners.get(event.type) || []) listener(event);
    }
};
globalThis.localStorage = {
    getItem(key) { return localState.get(key) || null; },
    setItem(key, value) { localState.set(key, value); }
};

const { StorageManager } = await import('./src/core/StorageManager.js');
const { WorkoutEngine } = await import('./src/core/WorkoutEngine.js');
const { GarminSync } = await import('./src/core/GarminSync.js');

const storage = new StorageManager();
['2026-08-10', '2026-08-11', '2026-08-13', '2026-08-16'].forEach(date => storage.recordCompletedSession(date));
const weeklyStats = storage.getWeeklyStats(new Date('2026-08-13T12:00:00'));
assert.equal(weeklyStats.completed, 4);
assert.equal(weeklyStats.target, 4);
assert.equal(weeklyStats.consistencyRatio, 1);
assert.deepEqual(weeklyStats.days.map(day => day.completed), [true, true, false, true, false, false, true]);
assert.equal(storage.getWeekStart(new Date('2026-08-16T12:00:00')), '2026-08-10');

const archived = [];
const memory = [];
const finishedSessions = [];
window.addEventListener('workout:finished', event => finishedSessions.push(event.detail));
const engine = new WorkoutEngine();
engine.storage = {
    completeWorkoutDay: async (summary, nextWorkout) => archived.push([summary, nextWorkout]),
    setLightState: (key, value) => memory.push([key, value]),
    recordCompletedSession: () => {},
    getDateKey: () => '2026-08-11'
};
engine.protocolData = [{ id: 'push_a', title: 'Push A', exercises: [{}, {}] }];
engine.state = {
    day: 0,
    done: { 0: { 'ex-0-0': true, 'ex-0-1': true } }
};
engine.currentSession = {
    session_id: '2026-08-11',
    day_id: 'push_a',
    logs: {
        ex_001: { session_id: '2026-08-11', exercise_id: 'ex_001', sets: [] }
    }
};
engine.pruneOldData = async () => {};
await engine.finishSession();
assert.equal(archived.length, 1);
assert.ok(memory.some(([key]) => key === 'hv3_memory'));
assert.equal(engine.state.day, 0);
assert.equal(finishedSessions.length, 1);
assert.equal(finishedSessions[0].session.title, 'Push A');

const queuedSessions = [];
window.addEventListener('workout:sync_queued', event => queuedSessions.push(event.detail));
const syncEngine = new WorkoutEngine();
syncEngine.protocolData = [{ exercises: [{}, {}] }];
syncEngine.currentSession = {
    session_id: '2026-08-11',
    day_id: 'push_a',
    logs: { ex_001: { exercise_id: 'ex_001', sets: [] } }
};
syncEngine.persistActiveWorkout = async () => {};
await syncEngine.toggleComplete('ex-0-0', 0);
assert.equal(queuedSessions.length, 0);
await syncEngine.toggleComplete('ex-0-1', 0);
assert.equal(queuedSessions.length, 0);
await syncEngine.toggleAll(0, false, syncEngine.protocolData[0].exercises);
assert.equal(Object.values(syncEngine.state.done[0]).filter(Boolean).length, 0);
await syncEngine.toggleAll(0, true, syncEngine.protocolData[0].exercises);
assert.equal(Object.values(syncEngine.state.done[0]).filter(Boolean).length, 2);

const completionEngine = new WorkoutEngine();
completionEngine.protocolData = [{ exercises: [{}, {}, {}, {}, {}] }];
completionEngine.state = { day: 0, done: { 0: { 'ex-0-0': true, 'ex-0-1': true } }, completedDays: {} };
assert.equal(completionEngine.getCompletionSummary().required, 3);
assert.equal(completionEngine.getCompletionSummary().eligible, false);
completionEngine.state.done[0]['ex-0-2'] = true;
assert.equal(completionEngine.getCompletionSummary().eligible, true);

const manualFinishSummaries = [];
const manualFinishEngine = new WorkoutEngine();
manualFinishEngine.protocolData = [{ id: 'push_a', title: 'Push A', exercises: [{}, {}, {}, {}, {}] }];
manualFinishEngine.state = { day: 0, done: {}, completedDays: {} };
manualFinishEngine.currentSession = { session_id: null, day_id: null, logs: {} };
manualFinishEngine.storage = {
    completeWorkoutDay: async summary => manualFinishSummaries.push(summary),
    setLightState: () => {},
    recordCompletedSession: () => {},
    getDateKey: () => '2026-08-11'
};
assert.equal(await manualFinishEngine.finishSession(), true);
assert.equal(manualFinishSummaries[0].completedExercises, 0);

const stateUpdates = [];
window.addEventListener('engine:state_updated', event => stateUpdates.push(event.detail));
const swapEngine = new WorkoutEngine();
swapEngine.protocolData = [{ exercises: [{ _exerciseId: 'hack_squat' }] }];
swapEngine.rawWorkouts = [{ exercises: [{ id: 'hack_squat' }] }];
swapEngine.exerciseLibrary = { leg_press: { name: 'Leg Press' } };
swapEngine._resolveExercise = slot => ({ _exerciseId: slot.id });
swapEngine.swapExercise(0, 0, 'leg_press');
assert.equal(stateUpdates.at(-1).type, 'exercise_swap');
assert.equal(swapEngine.protocolData[0].exercises[0]._exerciseId, 'leg_press');

const garmin = new GarminSync();
garmin.storage = { getWeeklyStats: () => ({ consistencyRatio: 0.5 }) };
globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({ biometric_score: 80 })
});
const readiness = await garmin.fetchReadiness();
assert.equal(readiness.readiness_score, 68);

const flowElements = new Map();
['day-title', 'day-sub', 'flow-last-title', 'flow-current-title', 'week-rhythm']
    .forEach(id => flowElements.set(id, {
        innerText: '',
        children: [],
        replaceChildren(...children) { this.children = children; },
        append(...children) { this.children.push(...children); },
        setAttribute() {}
    }));
globalThis.document = {
    getElementById(id) { return flowElements.get(id) || null; },
    createElement() {
        return {
            className: '',
            textContent: '',
            children: [],
            append(...children) { this.children.push(...children); },
            setAttribute() {}
        };
    }
};
const { HeroHeader } = await import('./src/ui/HeroHeader.js');
const hero = new HeroHeader();
hero.renderTrainingFlow({
    loadMemory: () => ({ title: 'Pull A' }),
    getWeeklyStats: () => ({
        days: ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16']
            .map((date, index) => ({ date, completed: index === 0 || index === 2 }))
    })
}, [
    { title: 'Push A', subtitle: 'Quads + chest' },
    { title: 'Pull A', subtitle: 'Back + biceps' },
    { title: 'Push B', subtitle: 'Chest + triceps' }
], 1);
assert.equal(flowElements.get('flow-last-title').innerText, 'Pull A');
assert.equal(flowElements.get('flow-current-title').innerText, 'Pull A');
assert.equal(flowElements.get('week-rhythm').children.length, 7);

console.log('Core behavior: OK');
