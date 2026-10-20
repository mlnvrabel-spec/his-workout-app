import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';

const RealDate = Date;
let now = '2026-11-03T18:00:00';
globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return new RealDate(now).getTime(); }
};
try {
    environment();
    let a = await engine();
    const original = structuredClone(a.state.schedule);
    const preview = a.previewSchedule({ type: 'add', kind: 'run', id: 'run-test', date: '2026-11-06' });
    assert.deepEqual(a.state.schedule, original, 'Preview must not write or shift the current plan');
    assert.equal(await a.applySchedule(preview), true);
    assert.ok(a.getScheduleView().entries.some(entry => entry.id === 'run-test'));
    assert.equal(a.getScheduleView().canUndo, true);
    a = await engine();
    assert.ok(a.getScheduleView().entries.some(entry => entry.id === 'run-test'), 'Schedule survives reopening');
    assert.equal(await a.undoSchedule(), true);
    assert.deepEqual(a.state.schedule, original, 'Undo restores the whole displaced chain');

    const mutate = a.storage.mutateWorkout.bind(a.storage);
    a.storage.mutateWorkout = reducer => mutate((...args) => { reducer(...args); throw new Error('Injected calendar write failure'); });
    assert.equal(await a.applySchedule(a.previewSchedule({ type: 'add', kind: 'rest', date: '2026-11-06' })), false);
    assert.deepEqual(a.state.schedule, original, 'Aborted writes cannot expose calendar changes');
    a.storage.mutateWorkout = mutate;

    const stale = a.previewSchedule({ type: 'officeDays', days: [2, 5] });
    const b = await engine();
    await b.toggleComplete('ex-0-0', 0);
    assert.equal(await a.applySchedule(stale), false, 'A second window starting a workout invalidates a preview');
    await a.refresh();
    const started = a.getScheduleView().entries.find(entry => entry.id === `${a.cycleId}:0`);
    assert.equal(started.status, 'started');
    assert.throws(() => a.previewSchedule({ type: 'move', id: started.id, date: '2026-11-07' }));

    const pastRun = a.previewSchedule({ type: 'add', kind: 'run', id: 'past-run', date: '2026-11-01', performed: true });
    assert.equal(await a.applySchedule(pastRun), true);
    await a.logSet(a.protocolData[0].exercises[0]._exerciseId, 20, 10, 8);
    assert.equal(await a.undoSchedule(), false, 'Calendar Undo cannot erase intervening training progress');
    assert.ok(a.getScheduleView().entries.some(entry => entry.id === 'past-run'));
    const exported = await a.exportHistory();
    assert.ok(exported.active.schedule.entries.some(entry => entry.id === 'past-run'), 'Export includes manual activity history');

    // IDB key ordering differs from the order in which exercises were logged.
    await a.logSet(a.protocolData[0].exercises[2]._exerciseId, 10, 12, 9);
    assert.equal(await a.applySchedule(a.previewSchedule({ type: 'add', kind: 'run', date: '2026-11-08' })), true,
        'A freshly created preview must not become stale just because IDB returns logs in key order');
    assert.equal(await a.undoSchedule(), true);

    environment(); a = await engine();
    const next = a.state.schedule.cycleIds[1];
    for (let day = 0; day < 4; day++) { await a.setDay(day); await a.finishSession(); }
    assert.equal(a.cycleId, next, 'Finishing a cycle adopts the already scheduled next cycle identity');
    assert.equal(new Set(a.getScheduleView().entries.map(entry => entry.id)).size, a.getScheduleView().entries.length);
    await a.reopenLastDay();
    assert.equal(a.state.nextCycleDraft.cycleId, next);
    await a.finishSession();
    assert.equal(a.cycleId, next, 'Completion Undo and redo retain future schedule identity');

    environment(); a = await engine();
    const autoNext = a.state.schedule.cycleIds[1];
    for (let day = 0; day < 4; day++) {
        await a.setDay(day);
        for (let i = 0; i < 3; i++) await a.toggleComplete(`ex-${day}-${i}`, day);
    }
    now = '2026-11-04T18:00:00';
    await a.refresh();
    assert.equal(a.cycleId, autoNext, 'Calendar-day automatic rollover uses the same planned identity');
    console.log('Scheduler transactions, preview guards, Undo, export and cycle integration: OK');
} finally { globalThis.Date = RealDate; }
