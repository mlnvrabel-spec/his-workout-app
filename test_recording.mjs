import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';
import { effortLabel, describeSet } from './src/core/SetRecord.js';

environment();
let a = await engine();
const exercise = a.protocolData[0].exercises[0];
const session = a.currentSession.session_id;
assert.equal(await a.logExercise(exercise.name, '20', '8'), true);
const first = structuredClone(a.getExerciseLogs(exercise._exerciseId)[0]);
assert.equal(first.rpe, null);
assert.equal(first.rpe_source, 'unreported');
assert.equal(effortLabel(first), 'Effort unreported');
assert.equal(effortLabel({ rpe: 9 }), 'RPE 9 · unverified');
assert.equal(describeSet({ weight_kg: 20, reps: 8, rpe: 9 }), '20 kg × 8 · RPE 9 · unverified');
assert.equal(a.getSessionStatus(), 'In progress');
await a.logSet(exercise._exerciseId, 20, 7, 8);
const sent = structuredClone(a.logs.find(log => log.session_id === session));
const second = structuredClone(a.getExerciseLogs(exercise._exerciseId)[1]);
assert.equal(effortLabel(second), 'RPE 8 · reported');

// Correct an earlier set. The last set and timestamp do not change.
assert.equal(await a.editSet(exercise._exerciseId, 1, 22, 9, first, session), true);
assert.equal(a.getExerciseLogs(exercise._exerciseId).length, 2);
assert.equal(a.getExerciseLogs(exercise._exerciseId)[0].timestamp, first.timestamp);
assert.equal(a.getExerciseLogs(exercise._exerciseId)[0].rpe, null);
await a.storage.markWorkoutLogSynced(sent);
assert.equal((await a.storage.getWorkoutLogs()).find(log => log.session_id === session).sync_status, 'pending');
const current = structuredClone(a.logs.find(log => log.session_id === session));
await a.storage.markWorkoutLogSynced(current);
assert.equal((await a.storage.getWorkoutLogs()).find(log => log.session_id === session).sync_status, 'synced');
assert.equal(await a.editSet(exercise._exerciseId, 1, 90, 9, first, session), false, 'Stale same-set edit is rejected');

// Another window may append/edit another set without invalidating this correction.
const b = await engine();
await b.logExercise(exercise.name, '24', '6');
assert.equal(await a.editSet(exercise._exerciseId, 2, 21, 8, second, session), true);
assert.equal(a.getExerciseLogs(exercise._exerciseId).length, 3);
assert.equal(a.getExerciseLogs(exercise._exerciseId)[2].weight_kg, 24);
const corrected = structuredClone(a.getExerciseLogs(exercise._exerciseId)[0]);
const mutate = a.storage.mutateWorkout.bind(a.storage);
a.storage.mutateWorkout = () => Promise.reject(new Error('simulated abort'));
assert.equal(await a.editSet(exercise._exerciseId, 1, 99, 9, corrected, session), false);
a.storage.mutateWorkout = mutate;
a = await engine();
assert.equal(a.getExerciseLogs(exercise._exerciseId)[0].weight_kg, 22);
assert.equal(await a.editSet(exercise._exerciseId, 1, -1, 9, corrected, session), false);
assert.equal(await a.editSet(exercise._exerciseId, 1, 20, 1.5, corrected, session), false);
assert.equal(await a.editSet(exercise._exerciseId, 1, 20, 9, corrected, 'another-session'), false);

await a.toggleComplete('ex-0-0', 0);
await a.toggleComplete('ex-0-1', 0);
await a.toggleComplete('ex-0-2', 0);
assert.equal(a.getSessionStatus(), 'Counted toward training · Still editable today');
assert.equal(a.summaries[0].completionType, 'counted');
await a.finishSession();
assert.equal(a.getSessionStatus(), 'Finished');
assert.equal(await a.editSet(exercise._exerciseId, 1, 30, 9, corrected, session), false);
await a.reopenLastDay();
assert.equal(a.getCompletionSummary().completed, 0);
assert.equal(a.getExerciseLogs(exercise._exerciseId).length, 3);
assert.equal(a.getSessionStatus(), 'In progress');
await a.editSet(exercise._exerciseId, 1, 23, 9, corrected, session);
const exported = await a.exportHistory();
assert.equal(exported.logs.find(log => log.session_id === session).sets[0].weight_kg, 23);
assert.equal(exported.logs.find(log => log.session_id === session).sets[0].rpe_source, 'unreported');
// Legacy effort remains intact and is explicitly unverified when exported.
await a.storage.mutateWorkout((workout, summaries, logs) => {
    delete logs[0].sets[0].rpe_source;
    logs[0].sets[0].rpe = 9;
    return { workout, summaries, logs, log: logs[0] };
});
const legacyExport = await a.exportHistory();
assert.equal(legacyExport.logs[0].sets[0].rpe, 9);
assert.equal(legacyExport.logs[0].sets[0].rpe_source, 'unknown');
console.log('Recording: truthful effort, corrections, concurrent edits, rollback, sync acknowledgments and completion labels OK');
