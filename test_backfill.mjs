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
    assert.throws(() => a.previewSchedule({ type: 'recordGym', id: `${cycle}:3`, date: '2026-10-24' }), /preceding/);

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

    // Explicit workout choices continue the rolling split after the recorded workout.
    const futureDays = instance => instance.getScheduleView().entries.filter(entry => entry.kind === 'gym' && entry.status === 'planned').map(entry => entry.day);
    for (const day of [0, 1, 2, 3]) {
        environment(); a = await engine();
        const original = structuredClone(a.state);
        const picked = a.previewSchedule({ type: 'recordGym', day, date: '2026-11-02' });
        assert.deepEqual(a.state, original, 'Choosing a workout only previews changes');
        assert.equal(picked.recordedGym.title, a.protocolData[day].title);
        assert.equal(await a.applySchedule(picked), true);
        assert.equal(a.state.activeDay, (day + 1) % 4);
        assert.deepEqual(futureDays(a).slice(0, 8), Array.from({ length: 8 }, (_, i) => (day + 1 + i) % 4));
        assert.equal(a.summaries.length, 1, 'Replaced plans are not fabricated completions');
        assert.equal(a.summaries[0].day, day);
        assert.deepEqual(a.state.done, {});
        assert.equal(a.logs.length, 0);
        assert.equal(a.getScheduleView().averages[0].gym.count, 1);
        a = await engine();
        assert.equal(a.state.activeDay, (day + 1) % 4);
        assert.equal((await a.exportHistory()).workouts[0].day, day);
        assert.equal(await a.undoSchedule(), true);
        assert.equal(a.summaries.length, 0);
        assert.deepEqual(a.state.schedule, original.schedule);
        assert.equal(a.state.activeDay, original.activeDay);
    }

    environment(); a = await engine();
    assert.throws(() => a.previewSchedule({ type: 'recordGym', day: null, date: '2026-11-02' }), /Choose the workout/);
    assert.throws(() => a.previewSchedule({ type: 'recordGym', day: 4, date: '2026-11-02' }), /Choose the workout/);
    assert.throws(() => a.previewSchedule({ type: 'recordGym', day: 1, date: '2026-11-03' }), /past date/);
    await a.applySchedule(a.previewSchedule({ type: 'add', kind: 'rest', date: '2026-11-04' }));
    await a.applySchedule(a.previewSchedule({ type: 'add', kind: 'run', date: '2026-11-06' }));
    await a.applySchedule(a.previewSchedule({ type: 'recordGym', day: 0, date: '2026-11-02' }));
    const actual = structuredClone(a.summaries[0]);
    const appointments = structuredClone(a.state.schedule.entries.filter(entry => entry.kind !== 'gym'));
    // An older or repeated workout is a distinct actual record, never an overwrite.
    await a.applySchedule(a.previewSchedule({ type: 'recordGym', day: 0, date: '2026-11-01' }));
    assert.equal(a.summaries.length, 2);
    assert.deepEqual(a.summaries.find(summary => summary.id === actual.id), actual);
    assert.deepEqual(a.state.schedule.entries.filter(entry => entry.kind !== 'gym'), appointments);
    assert.equal(a.state.activeDay, 1);
    assert.throws(() => a.previewSchedule({ type: 'recordGym', day: 2, date: '2026-11-01' }), /already/);
    assert.ok(a.getScheduleView().entries.filter(entry => entry.kind === 'gym' && entry.status === 'planned')
        .every(entry => !['2026-11-04', '2026-11-05', '2026-11-06', '2026-11-09'].includes(entry.date)));

    const stable = structuredClone(a.state);
    const durable = a.storage.mutateWorkout.bind(a.storage);
    a.storage.mutateWorkout = reducer => durable((...args) => { reducer(...args); throw new Error('Injected restart failure'); });
    assert.equal(await a.applySchedule(a.previewSchedule({ type: 'recordGym', day: 3, date: '2026-10-31' })), false);
    a = await engine();
    assert.equal(a.summaries.length, 2);
    assert.deepEqual(a.state.schedule, stable.schedule);
    const staleChoice = a.previewSchedule({ type: 'recordGym', day: 3, date: '2026-10-31' });
    const other = await engine();
    await other.toggleComplete('ex-1-0', 1);
    assert.equal(await a.applySchedule(staleChoice), false);
    await a.refresh();
    assert.throws(() => a.previewSchedule({ type: 'recordGym', day: 3, date: '2026-10-31' }), /already started/);
    assert.equal(a.state.done[1]['ex-1-0'], true);

    // A rotated cycle must continue correctly through Finish, Undo and midnight.
    environment(); a = await engine();
    await a.applySchedule(a.previewSchedule({ type: 'recordGym', day: 1, date: '2026-11-02' }));
    const rotated = a.cycleId;
    for (const [index, day] of [2, 3, 0, 1].entries()) {
        now = `2026-11-${String(3 + index).padStart(2, '0')}T18:00:00`;
        await a.refresh();
        assert.equal(a.state.activeDay, day);
        await a.continueWorkout();
        assert.equal(await a.finishSession(), true);
    }
    assert.notEqual(a.cycleId, rotated);
    assert.equal(a.state.activeDay, 2, 'The next cycle starts at Push B, not a duplicate Push A');
    assert.equal(await a.reopenLastDay(), true);
    assert.equal(a.cycleId, rotated);
    assert.equal(a.state.activeDay, 1);
    assert.equal(await a.finishSession(), true);
    a = await engine();
    assert.equal(a.state.activeDay, 2);
    now = '2026-11-07T18:00:00';
    await a.refresh();
    assert.equal(a.state.activeDay, 2);

    now = '2026-11-03T18:00:00';
    environment(); a = await engine();
    await a.applySchedule(a.previewSchedule({ type: 'recordGym', day: 1, date: '2026-10-26' }));
    for (const [index, day] of [2, 3, 0].entries()) {
        await a.applySchedule(a.previewSchedule({ type: 'recordGym', day, date: `2026-10-${27 + index}` }));
    }
    await a.toggleComplete('ex-1-0', 1);
    await a.toggleComplete('ex-1-1', 1);
    await a.toggleComplete('ex-1-2', 1);
    assert.equal(a.state.autoCompletedDays[1], true);
    now = '2026-11-04T18:00:00';
    await a.refresh();
    assert.equal(a.state.activeDay, 2, 'Automatic completion also preserves the rotated order at midnight');

    console.log('Backfill: explicit choices, future split restart, protected history, atomic writes, cycles, reload and Undo OK');
} finally { globalThis.Date = RealDate; }
