import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';

const RealDate = Date;
globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-11-03T18:00:00'])); }
    static now() { return new RealDate('2026-11-03T18:00:00').getTime(); }
};
try {
    environment();
    let a = await engine();
    const id = `${a.cycleId}:0`;
    await a.applySchedule(a.previewSchedule({ type: 'move', id, date: '2026-11-06' }));
    const before = structuredClone(a.state.schedule);
    const preview = a.previewSchedule({ type: 'recordGym', id, date: '2026-11-02' });
    assert.deepEqual(a.state.schedule, before, 'Preview is read-only');
    assert.equal(preview.schedule.entries.find(entry => entry.id === id).status, 'completed');
    assert.equal(preview.schedule.entries.find(entry => entry.id === `${a.cycleId}:1`).date, '2026-11-03');
    assert.ok(preview.changes.filter(change => change.kind === 'gym').length > 1);
    assert.equal(await a.applySchedule(preview), true);
    assert.equal(a.state.activeDay, 1);
    assert.equal(a.state.completedDays[0], true);
    assert.equal(a.summaries.find(summary => summary.id === id).source, 'manual_backfill');
    assert.equal(a.logs.length, 0, 'Backfilling must not invent sets');
    assert.deepEqual(a.state.done, {}, 'Backfilling must not invent checks');
    a = await engine();
    assert.equal(a.state.activeDay, 1);
    assert.equal(a.getScheduleView().canUndo, true);
    assert.equal((await a.exportHistory()).workouts.find(summary => summary.id === id).sessionId, '2026-11-02');
    assert.equal(await a.undoSchedule(), true);
    assert.equal(a.summaries.some(summary => summary.id === id), false);
    assert.deepEqual(a.state.schedule, before);
    a = await engine();
    assert.equal(a.summaries.some(summary => summary.id === id), false, 'Undo deletion is durable');
    assert.equal(a.state.activeDay, 0);

    // Transaction failure cannot persist half a backfill.
    const mutate = a.storage.mutateWorkout.bind(a.storage);
    a.storage.mutateWorkout = reducer => mutate((...args) => { reducer(...args); throw new Error('Injected failure'); });
    assert.equal(await a.applySchedule(a.previewSchedule({ type: 'recordGym', id, date: '2026-11-02' })), false);
    assert.equal(a.summaries.length, 0);
    a.storage.mutateWorkout = mutate;
    a = await engine();
    assert.equal(a.summaries.length, 0);

    assert.throws(() => a.previewSchedule({ type: 'recordGym', id, date: '2026-11-03' }), /past date/);
    assert.throws(() => a.previewSchedule({ type: 'recordGym', id: `${a.cycleId}:1`, date: '2026-11-02' }), /split order/);
    const stale = a.previewSchedule({ type: 'recordGym', id, date: '2026-11-02' });
    const b = await engine();
    await b.toggleComplete('ex-0-0', 0);
    assert.equal(await a.applySchedule(stale), false, 'Concurrent progress invalidates backfill');
    await a.refresh();
    assert.throws(() => a.previewSchedule({ type: 'recordGym', id, date: '2026-11-02' }), /Started workouts/);

    // Runs, rest and other past activity all reflow the unfinished plan.
    for (const kind of ['run', 'rest', 'activity']) {
        environment(); a = await engine();
        const first = `${a.cycleId}:0`;
        await a.applySchedule(a.previewSchedule({ type: 'move', id: first, date: '2026-11-06' }));
        const result = a.previewSchedule({ type: 'add', kind, date: '2026-11-01', performed: true, title: kind });
        assert.equal(result.schedule.entries.find(entry => entry.id === first).date, '2026-11-03');
        assert.equal(await a.applySchedule(result), true);
        assert.equal(await a.undoSchedule(), true);
        assert.equal(a.state.schedule.entries.find(entry => entry.id === first).date, '2026-11-06');
    }

    // Record a whole split chronologically; the next cycle is ready immediately.
    environment(); a = await engine();
    const cycle = a.cycleId, nextCycle = a.state.schedule.cycleIds[1];
    for (let day = 0; day < 4; day++) {
        assert.equal(await a.applySchedule(a.previewSchedule({ type: 'recordGym', id: `${cycle}:${day}`, date: `2026-10-${25 + day}` })), true);
    }
    assert.equal(a.cycleId, nextCycle);
    assert.equal(a.state.activeDay, 0);
    assert.equal(a.summaries.length, 4);
    a = await engine();
    assert.equal(a.cycleId, nextCycle);
    assert.equal(a.getScheduleView().canUndo, true);
    assert.equal(await a.undoSchedule(), true);
    assert.equal(a.cycleId, cycle);
    assert.equal(a.state.activeDay, 3);
    assert.equal(a.summaries.length, 3);
    assert.throws(() => a.previewSchedule({ type: 'recordGym', id: `${cycle}:3`, date: '2026-10-26' }), /preceding/);

    environment(); a = await engine();
    await a.applySchedule(a.previewSchedule({ type: 'recordGym', id: `${a.cycleId}:0`, date: '2026-11-02' }));
    await a.toggleComplete('ex-1-0', 1);
    assert.equal(await a.undoSchedule(), false, 'Undo cannot overwrite subsequent training');
    assert.equal(a.summaries.length, 1);
    environment(); a = await engine();
    const protectedCycle = a.cycleId;
    await a.setDay(1); await a.toggleComplete('ex-1-0', 1);
    const protectedEntry = structuredClone(a.state.schedule.entries.find(entry => entry.id === `${protectedCycle}:1`));
    await a.applySchedule(a.previewSchedule({ type: 'recordGym', id: `${protectedCycle}:0`, date: '2026-11-02' }));
    assert.deepEqual(a.state.schedule.entries.find(entry => entry.id === protectedEntry.id), protectedEntry);
    assert.equal(a.state.done[1]['ex-1-0'], true, 'Later started checks survive recalculation');
    assert.throws(() => a.previewSchedule({ type: 'recordGym', id: `${protectedCycle}:0`, date: '2026-11-01' }), /split order/);

    environment(); a = await engine();
    await a.applySchedule(a.previewSchedule({ type: 'add', kind: 'rest', date: '2026-11-02', performed: true }));
    assert.throws(() => a.previewSchedule({ type: 'recordGym', id: `${a.cycleId}:0`, date: '2026-11-02' }), /already/);

    console.log('Backfill: chronology, atomic history/plan writes, reflow, cycles, reload, Undo and stale guards OK');
} finally { globalThis.Date = RealDate; }
