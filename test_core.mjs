import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';
import { StorageManager } from './src/core/StorageManager.js';

// Actual IndexedDB transactions via fake-indexeddb, rather than storage success stubs.
environment();
let a = await engine();
await a.toggleComplete('ex-0-0', 0);
assert.equal(a.isDayCompleted(), false);
const cycle = a.cycleId;
assert.equal(await a.finishSession(), true);
assert.equal(a.state.day, 1);
assert.equal(a.state.activeDay, 1);
assert.equal(a.summaries[0].completedExercises, 1);
await a.toggleComplete('ex-1-0', 1);
assert.equal(await a.reopenLastDay(), true);
assert.equal(a.state.done[1]['ex-1-0'], true, 'Undo preserves subsequent checks');
assert.equal(a.state.done[0]['ex-0-0'], true);
assert.equal(a.canUndoLastCompletion(), false);
assert.equal(a.storage.getWeeklyStats().completed, 0);
let reloaded = await engine();
assert.equal(reloaded.canUndoLastCompletion(), false, 'Undo must not resurrect on reload');
assert.equal(reloaded.state.done[1]['ex-1-0'], true);

// Viewing history does not redefine the active workout.
await a.finishSession();
await a.setDay(0);
assert.equal(a.state.activeDay, 1);
assert.equal(a.state.day, 0);
assert.equal(await a.finishSession(), false, 'Completed day cannot finish twice');
await a.continueWorkout();
assert.equal(a.state.day, 1);

// Cross-window check mutations merge against the latest stored record.
environment();
a = await engine();
let b = await engine();
await Promise.all([a.toggleComplete('ex-0-0', 0), b.toggleComplete('ex-0-1', 0)]);
reloaded = await engine();
assert.equal(reloaded.getCompletionSummary().completed, 2);
await Promise.all([a.finishSession(), b.finishSession()]);
reloaded = await engine();
assert.equal(reloaded.summaries.length, 1, 'Two windows can complete a workout only once');
assert.equal(reloaded.state.day, 1);
assert.equal(reloaded.summaries[0].completedExercises, 2);

// Two immediate calls never interpret the second as finishing the next day.
environment();
a = await engine();
await Promise.all([a.finishSession(), a.finishSession()]);
assert.equal(a.summaries.length, 1);
assert.equal(a.state.day, 1);

// Transaction abort preserves both durable records and engine state.
environment();
a = await engine();
await a.toggleComplete('ex-0-0', 0);
const before = structuredClone(a.state);
const mutate = a.storage.mutateWorkout.bind(a.storage);
a.storage.mutateWorkout = reducer => mutate((...args) => { reducer(...args); throw new Error('Injected transaction failure'); });
assert.equal(await a.finishSession(), false);
assert.equal(a.pending, false);
assert.deepEqual(a.state, before);
assert.equal((await a.storage.getCompletedWorkouts()).length, 0);
assert.deepEqual((await a.storage.loadActiveWorkout()).done, before.done);
a.storage.mutateWorkout = mutate;
assert.equal(await a.finishSession(), true, 'Retry succeeds after failed save');

// Out-of-order Finish skips completed days.
environment();
a = await engine();
await a.setDay(1); await a.finishSession();
await a.setDay(0); await a.finishSession();
assert.equal(a.state.day, 2);
assert.equal(a.isDayCompleted(), false);
assert.equal(a.storage.getWeeklyStats().completed, 1, 'Same-date completions count as one trained date');
await a.reopenLastDay();
assert.equal(a.storage.getWeeklyStats().completed, 1, 'Undo retains a date with another completed session');

// Cycle-boundary undo and redo keep the new cycle draft, including after reload.
environment();
a = await engine();
for (let day=0; day<4; day++) await a.finishSession();
const nextCycle = a.cycleId;
assert.deepEqual(a.state.completedDays, {});
await a.toggleComplete('ex-0-2', 0);
a = await engine();
await a.reopenLastDay();
assert.equal(a.state.day, 3);
assert.equal(Object.keys(a.state.completedDays).length, 3);
a = await engine();
await a.finishSession();
assert.equal(a.cycleId, nextCycle);
assert.equal(a.state.done[0]['ex-0-2'], true);
assert.equal(a.summaries.length, 4);

// Completed prescriptions are immutable; stale-window swaps cannot change history.
environment();
a = await engine(); b = await engine();
const original = a.protocolData[0].exercises[0]._exerciseId;
const option = a.getSwapOptions(original)[0].id;
await a.finishSession();
assert.equal(await b.swapExercise(0, 0, option), false);
assert.equal(a.summaries[0].exercises[0]._exerciseId, original);

// Set logging appends durably across navigation, reloads, and concurrent windows.
environment();
a = await engine();
const exercise = a.protocolData[0].exercises[0];
await a.logSet(exercise._exerciseId, 20, 10, 8);
await a.setDay(1); await a.setDay(0);
await a.logSet(exercise._exerciseId, 20, 9, 8);
b = await engine();
await Promise.all([a.logSet(exercise._exerciseId, 20, 8, 8), b.logSet(exercise._exerciseId, 20, 7, 8)]);
a = await engine();
assert.equal(a.getExerciseLogs(exercise._exerciseId).length, 4);
assert.deepEqual(a.getExerciseLogs(exercise._exerciseId).map(s => s.set_number), [1,2,3,4]);
assert.equal(await a.logSet(exercise._exerciseId, -1, 10, 8), false);
assert.equal(await a.logSet(exercise._exerciseId, 20, 1.5, 8), false);
await a.finishSession(); await a.setDay(0);
assert.equal(await a.logSet(exercise._exerciseId, 20, 10, 8), false);
const exported = await a.exportHistory();
assert.equal(exported.logs[0].sets.length, 4);
assert.equal(exported.workouts.length, 1);

// Acknowledgement of an older payload must not mark newly appended sets synced.
await a.reopenLastDay();
const oldLog = structuredClone((await a.storage.getWorkoutLogs())[0]);
await a.logSet(exercise._exerciseId, 20, 6, 8);
await a.storage.markWorkoutLogSynced(oldLog);
assert.equal((await a.storage.getWorkoutLogs())[0].sync_status, 'pending');
const latestLog = (await a.storage.getWorkoutLogs())[0];
await a.storage.markWorkoutLogSynced(latestLog);
assert.equal((await a.storage.getWorkoutLogs())[0].sync_status, 'synced');

// Hero projections recover from stale browser preferences on reload.
localStorage.setItem('hv3_memory', JSON.stringify({title:'Wrong'}));
a = await engine();
assert.equal(a.storage.loadMemory(), null);

// Monday–Sunday history uses local dates, including Sunday at a week boundary.
const storage = new StorageManager();
['2026-08-10','2026-08-11','2026-08-13','2026-08-16'].forEach(date => storage.recordCompletedSession(date));
assert.deepEqual(storage.getWeeklyStats(new Date('2026-08-13T12:00:00')).days.map(d=>d.completed), [true,true,false,true,false,false,true]);
assert.equal(storage.getWeekStart(new Date('2026-08-16T12:00:00')), '2026-08-10');
console.log('Core transactions, undo, cycles, concurrent windows, logging: OK');
