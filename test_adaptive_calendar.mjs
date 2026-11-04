import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';
import { reconcileSchedule, proposeSchedule, planningSummary, scheduleEntries, addDays } from './src/core/TrainingSchedule.js';

const context = { today: '2026-11-03', cycleId: 'c1', workout: { cycleId: 'c1', done: {} },
    protocolData: ['Push A', 'Pull A', 'Push B', 'Pull B'].map(title => ({ title })), summaries: [], logs: [] };
const act = (schedule, intent, ctx = context) => proposeSchedule(schedule, intent, ctx).schedule;
const initial = reconcileSchedule(null, context);
assert.equal(planningSummary(initial, context).lastRunDate, null);
assert.equal(planningSummary(initial, context).overdue, false, 'Unknown history must not become overdue');
const low = act(initial, { type: 'add', kind: 'run', date: '2026-10-31', performed: true });
assert.equal(planningSummary(low, context).nextRunDate, '2026-11-08', 'With a low gym average, Sunday run uses existing Monday rest');
const summaries = Array.from({ length: 14 }, (_, i) => ({ id: `old${i}:0`, cycleId: `old${i}`, day: 0, sessionId: addDays(context.today, -i - 1), title: 'Push A' }));
const richContext = { ...context, summaries };
const rich = reconcileSchedule(low, richContext);
assert.equal(planningSummary(rich, richContext).gymAverage, 3.5);
assert.equal(planningSummary(rich, richContext).nextRunDate, '2026-11-07', 'When the gym target is met, the run can use the earlier eligible date');
const boundary = reconcileSchedule(low, { ...context, summaries: [
    { ...summaries[0], sessionId: addDays(context.today, -27) },
    { ...summaries[1], sessionId: addDays(context.today, -28) },
] });
assert.equal(planningSummary(boundary, context).gymAverage, .25, '28-day count includes today minus 27, excludes minus 28');
const deadline = act(initial, { type: 'add', kind: 'run', date: '2026-10-30', performed: true });
assert.ok(planningSummary(deadline, context).nextRunDate <= '2026-11-08', 'Reserve a run before day-ten Monday rest');
const unrecorded = act(low, { type: 'add', kind: 'run', date: '2026-11-06' });
assert.equal(planningSummary(unrecorded, context).lastRunDate, '2026-10-31', 'Planning does not reset actual cadence');
for (const values of [{ runTargetDays: 0 }, { runLatestDays: 6 }, { gymTargetPerWeek: NaN }]) {
    assert.throws(() => act(initial, { type: 'preferences', preferences: { runTargetDays: 7, runLatestDays: 10, gymTargetPerWeek: 3.5, ...values } }), /Choose a run target/);
}
const manualEarly = act(low, { type: 'add', kind: 'run', date: '2026-11-04' });
assert.ok(manualEarly.entries.some(e => e.kind === 'run' && e.date === '2026-11-04' && e.source === 'manual'), 'Before day seven remains a user choice');
const protectedGym = act(initial, { type: 'move', id: 'c1:2', date: '2026-11-07' });
assert.throws(() => act(protectedGym, { type: 'add', kind: 'run', date: '2026-11-06' }), /day after.*fixed/);
const todayPlan = act(initial, { type: 'change', id: 'c1:0', kind: 'run', date: context.today });
assert.equal(todayPlan.entries.find(e => e.kind === 'run' && e.date === context.today).status, 'planned');
const recordedToday = act(initial, { type: 'change', id: 'c1:0', kind: 'run', date: context.today, performed: true });
assert.equal(recordedToday.entries.find(e => e.kind === 'run' && e.date === context.today).status, 'completed');
assert.ok(!recordedToday.entries.some(e => e.kind === 'gym' && e.date === '2026-11-04'));

const RealDate = Date;
globalThis.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : ['2026-11-03T18:00:00'])); }
    static now() { return new RealDate('2026-11-03T18:00:00').getTime(); }
};
try {
    environment(); let a = await engine();
    const save = async intent => assert.equal(await a.applySchedule(a.previewSchedule(intent)), true, JSON.stringify(intent));
    const on = date => a.getScheduleView().entries.filter(e => e.date === date);
    const fridayGym = on('2026-11-06').find(e => e.kind === 'gym');
    await save({ type: 'change', id: fridayGym.id, kind: 'run', date: '2026-11-06' });
    assert.ok(on('2026-11-07').some(e => e.recovery));
    assert.ok(on('2026-11-08').some(e => e.id === fridayGym.id));
    const runUndo = on('2026-11-06')[0].undo.id;
    await save({ type: 'change', id: fridayGym.id, kind: 'rest', date: '2026-11-08' });
    a = await engine();
    assert.equal(await a.undoSchedule(runUndo), true, 'Friday Undo remains valid after independent Sunday Rest');
    assert.ok(on('2026-11-06').some(e => e.kind === 'gym'));
    assert.ok(on('2026-11-07').some(e => e.kind === 'gym'));
    assert.ok(on('2026-11-08').some(e => e.kind === 'rest'));
    assert.ok(!on('2026-11-07').some(e => e.recovery));
    a = await engine();
    const sundayUndo = on('2026-11-08')[0].undo;
    assert.equal(sundayUndo.available, true);
    const transaction = a.storage.mutateWorkout.bind(a.storage);
    a.storage.mutateWorkout = reducer => transaction((...args) => { reducer(...args); throw new Error('Injected Undo failure'); });
    assert.equal(await a.undoSchedule(sundayUndo.id), false);
    a = await engine();
    assert.ok(on('2026-11-08').some(e => e.kind === 'rest'), 'Failed Undo cannot leak calendar changes');
    assert.equal(await a.undoSchedule(sundayUndo.id), true);
    assert.ok(on('2026-11-08').some(e => e.kind === 'gym'));
    await save({ type: 'preferences', preferences: { runTargetDays: 5, runLatestDays: 8, gymTargetPerWeek: 3 } });
    a = await engine();
    assert.equal(a.getScheduleView().preferences.runTargetDays, 5);
    assert.equal(await a.undoSchedule(a.getScheduleView().settingsUndo.id), true);
    assert.equal(a.getScheduleView().preferences.runTargetDays, 7);
    await save({ type: 'add', kind: 'activity', title: 'Walk', date: '2026-11-06' });
    const activity = on('2026-11-06').find(e => e.kind === 'activity');
    const firstUndo = activity.undo.id;
    await save({ type: 'change', id: activity.id, kind: 'activity', title: 'Hike', date: '2026-11-06' });
    assert.equal(await a.undoSchedule(firstUndo), false, 'Undo cannot overwrite a later edit of the same card');
    assert.equal(on('2026-11-06')[0].title, 'Hike');
    const latestUndo = on('2026-11-06')[0].undo.id;
    await a.toggleComplete('ex-0-0', 0);
    assert.equal(await a.undoSchedule(latestUndo), false, 'Saved training makes an old planning inverse unavailable');
    assert.equal(on('2026-11-06')[0].title, 'Hike');
} finally { globalThis.Date = RealDate; }
console.log('Adaptive calendar: rolling history, run windows, recovery, user choices, card Undo and durable rollback OK');
