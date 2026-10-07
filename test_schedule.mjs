import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';

const RealDate = Date;
let now = '2026-10-01T12:00:00';
globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new RealDate(now).getTime(); }
};
const tomorrow = () => { now = '2026-10-06T12:00:00'; };
const qualify = async (a, day = 0) => {
    for (let i = 0; i < Math.ceil(a.protocolData[day].exercises.length / 2); i++) await a.toggleComplete(`ex-${day}-${i}`, day);
};
try {
    environment();
    let a = await engine();
    await a.toggleComplete('ex-0-0', 0);
    tomorrow();
    a = await engine();
    assert.equal(a.state.day, 0, 'Below 50% resumes even after several missed dates');
    assert.equal(a.isDayCompleted(0), false);
    now = '2026-10-01T12:00:00'; environment(); a = await engine();
    const required = Math.ceil(a.protocolData[0].exercises.length / 2);
    await qualify(a);
    assert.equal(a.isDayCompleted(0), true);
    assert.equal(a.state.day, 0, 'Threshold does not switch the displayed workout');
    assert.equal(a.isDaySealed(0), false, 'Same-day completion stays editable');
    assert.equal(a.summaries[0].completedExercises, required);
    a = await engine();
    assert.equal(a.state.day, 0, 'Same-day reload stays on the workout');
    await a.toggleComplete('ex-0-0', 0);
    assert.equal(a.isDayCompleted(0), false, 'Unchecking below threshold removes automatic completion');
    assert.equal((await a.storage.getCompletedWorkouts()).length, 0);
    await a.toggleComplete('ex-0-0', 0);
    await a.toggleComplete(`ex-0-${required}`, 0);
    assert.equal(a.summaries[0].completedExercises, required + 1);
    tomorrow(); await a.refresh();
    assert.equal(a.state.day, 1, 'Focus refresh advances exactly once on a new date');
    assert.equal(a.isDaySealed(0), true);
    assert.equal(await a.toggleComplete('ex-0-0', 0), false);
    a = await engine(); assert.equal(a.state.day, 1);
    assert.equal(a.isDayCompleted(0), true, 'Previous completion remains highlighted');
    assert.equal(a.summaries.length, 1);
    // Refreshes must not rebroadcast unchanged automatic summaries across windows.
    now = '2026-10-01T12:00:00'; environment(); a = await engine();
    let broadcasts = 0;
    a.channel = { postMessage() { broadcasts++; } };
    await qualify(a);
    const priorBroadcasts = broadcasts;
    await a.refresh(); await a.refresh();
    assert.equal(broadcasts, priorBroadcasts, 'No cross-window refresh feedback loop');
    // An aborted threshold transaction must not expose a completion or summary.
    environment(); a = await engine();
    await a.toggleComplete('ex-0-0', 0); await a.toggleComplete('ex-0-1', 0);
    const mutate = a.storage.mutateWorkout.bind(a.storage);
    a.storage.mutateWorkout = reducer => mutate((...args) => { reducer(...args); throw new Error('Injected automatic completion failure'); });
    assert.equal(await a.toggleComplete('ex-0-2', 0), false);
    assert.equal(a.isDayCompleted(0), false);
    assert.equal((await a.storage.getCompletedWorkouts()).length, 0);
    a.storage.mutateWorkout = mutate;
    await a.toggleComplete('ex-0-2', 0);
    assert.equal(a.isDayCompleted(0), true);
    // Pre-fix durable records have no workoutDate or automatic completion metadata.
    environment(); a = await engine(); await qualify(a);
    const legacy = structuredClone(a.state);
    delete legacy.workoutDate; delete legacy.autoCompletedDays;
    legacy.completedDays = {}; legacy.lastCompletedSummaryId = null;
    await a.storage.saveActiveWorkout(legacy);
    await a.storage.mutateWorkout((saved, summaries, logs) => ({ workout: saved, summaries: [], logs, deleteSummary: `${a.cycleId}:0` }));
    a = await engine(); assert.equal(a.state.day, 1, 'Reopening old qualified checklist recovers next split');
    assert.equal(a.isDayCompleted(0), true);
    now = '2026-10-01T12:00:00'; environment(); a = await engine();
    for (let day = 0; day < 4; day++) { await a.setDay(day); await qualify(a, day); }
    assert.equal(Object.keys(a.state.completedDays).length, 4);
    tomorrow(); a = await engine();
    assert.equal(a.state.day, 0); assert.deepEqual(a.state.done, {});
    assert.equal(a.summaries.length, 4);
    console.log('50% completion, edits, legacy recovery, calendar scheduling and cycle reset: OK');
} finally { globalThis.Date = RealDate; }
