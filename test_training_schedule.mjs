import assert from 'node:assert/strict';
import { dateKey, addDays, reconcileSchedule, proposeSchedule, scheduleEntries, nextScheduleCycleId, suggestedRunDate } from './src/core/TrainingSchedule.js';

const protocolData = ['Push A', 'Pull A', 'Push B', 'Pull B'].map(title => ({ title }));
const context = (today = '2026-11-03', extra = {}) => ({ today, cycleId: 'c1', workout: { cycleId: 'c1', done: {} }, protocolData, summaries: [], logs: [], ...extra });
const ctx = context();
const gyms = schedule => schedule.entries.filter(entry => entry.kind === 'gym').sort((a, b) => schedule.cycleIds.indexOf(a.cycleId) - schedule.cycleIds.indexOf(b.cycleId) || a.day - b.day);
const gymDates = schedule => gyms(schedule).map(entry => entry.date);
const act = (schedule, intent, current = ctx) => proposeSchedule(schedule, intent, current).schedule;
const summary = (day, date, cycleId = 'c1') => ({ id: `${cycleId}:${day}`, cycleId, day, sessionId: date, completedAt: `${date}T18:00:00Z`, title: protocolData[day].title });
let base = reconcileSchedule(null, ctx);
assert.deepEqual(gymDates(base).slice(0, 12), ['2026-11-03', '2026-11-04', '2026-11-06', '2026-11-07', '2026-11-10', '2026-11-11', '2026-11-13', '2026-11-14', '2026-11-17', '2026-11-18', '2026-11-20', '2026-11-21']);
assert.deepEqual(reconcileSchedule(base, ctx), base, 'Reconciliation is idempotent and does not turn the weekly target into extra workouts');
assert.equal(nextScheduleCycleId(base, 'c1'), 'c1~1');
base = act(base, { type: 'add', kind: 'run', date: '2026-11-01', performed: true });
const recordedRun = base.entries.find(entry => entry.kind === 'run');
assert.equal(suggestedRunDate(base, ctx), '2026-11-08', 'Run suggestion leaves gym appointments in place');
base = act(base, { type: 'add', kind: 'run', date: '2026-11-08' });
const runId = base.entries.find(entry => entry.kind === 'run' && entry.status === 'planned').id;
assert.equal(suggestedRunDate(base, ctx), null, 'An existing run appointment does not generate another suggestion');
const untouched = structuredClone(base);

// Same five product cases for either UI concept: office change, run insertion, cycle move, hike, missed gym.
const offices = act(base, { type: 'officeDays', days: [2, 5] });
assert.deepEqual(gymDates(offices).slice(0, 12), ['2026-11-04', '2026-11-05', '2026-11-07', '2026-11-09', '2026-11-11', '2026-11-12', '2026-11-14', '2026-11-15', '2026-11-18', '2026-11-19', '2026-11-21', '2026-11-22']);
assert.deepEqual(offices.entries.find(entry => entry.id === recordedRun.id), recordedRun, 'Office changes preserve the previously completed run');
const insertedRun = proposeSchedule(base, { type: 'move', id: runId, date: '2026-11-10' }, ctx);
assert.deepEqual(gymDates(insertedRun.schedule).slice(4, 12), ['2026-11-11', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-17', '2026-11-18', '2026-11-20', '2026-11-21']);
assert.equal(insertedRun.changes.filter(change => change.kind === 'gym').length, 4, 'Only the necessary chain shifts');
assert.ok(!insertedRun.changes.some(change => change.id === 'c1~2:0'), 'Propagation stops when an existing gap absorbs it');
const crossed = act(base, { type: 'move', id: 'c1:3', date: '2026-11-10' });
assert.equal(crossed.entries.find(entry => entry.id === 'c1:3').date, '2026-11-10');
assert.deepEqual(gymDates(crossed).slice(4, 8), ['2026-11-11', '2026-11-13', '2026-11-14', '2026-11-15']);
assert.deepEqual(gyms(crossed).map(entry => entry.id), gyms(base).map(entry => entry.id), 'Cycle boundaries retain workout identities and order');
const runOn11 = act(base, { type: 'move', id: runId, date: '2026-11-11' });
const hike = proposeSchedule(runOn11, { type: 'add', kind: 'activity', title: 'Demanding hike', demanding: true, date: '2026-11-07' }, ctx);
assert.deepEqual(gymDates(hike.schedule).slice(3, 9), ['2026-11-08', '2026-11-10', '2026-11-13', '2026-11-14', '2026-11-15', '2026-11-17']);
assert.ok(hike.warnings.some(warning => warning.includes('no rest day is added automatically')));
const missedContext = context('2026-11-07', { summaries: [summary(0, '2026-11-03'), summary(1, '2026-11-04')], workout: { cycleId: 'c1', done: {}, activeDay: 2 } });
const missed = reconcileSchedule(base, missedContext);
assert.deepEqual(gymDates(missed).slice(0, 8), ['2026-11-03', '2026-11-04', '2026-11-07', '2026-11-10', '2026-11-11', '2026-11-13', '2026-11-14', '2026-11-15']);
assert.equal(missed.entries.find(entry => entry.id === 'c1:2').originalDate, '2026-11-06', 'Missed workout retains its original reference date');
assert.equal(missed.entries.find(entry => entry.id === 'c1:2').status, 'planned');
assert.equal(missed.entries.find(entry => entry.id === 'c1:2').missedDate, '2026-11-06', 'Agenda can explain the carried workout');
assert.deepEqual(reconcileSchedule(missed, missedContext), missed);

// Tap and drag dispatch the same move intent. No action mutates the caller's snapshot.
assert.deepEqual(base, untouched);
assert.deepEqual(act(base, { type: 'move', id: runId, date: '2026-11-10' }), insertedRun.schedule);
assert.throws(() => act(base, { type: 'move', id: 'c1:3', date: '2026-11-04' }), /before an unfinished/);
assert.throws(() => act(base, { type: 'move', id: 'c1:0', date: '2026-11-08' }), /occupies/);
assert.throws(() => act(base, { type: 'add', kind: 'rest', date: '2026-11-08' }), /occupies/);
const deletedGym = act(base, { type: 'remove', id: 'c1:0' });
assert.ok(deletedGym.skippedSessionIds.includes('c1:0'));
assert.ok(!reconcileSchedule(deletedGym, ctx).entries.some(entry => entry.id === 'c1:0'), 'Deleted plans stay deleted after reconciliation');
const freed = act(insertedRun.schedule, { type: 'remove', id: runId });
assert.deepEqual(gymDates(freed), gymDates(insertedRun.schedule), 'Removing a blocker does not silently pull sessions earlier');

// Recurring office moves/removal affect a single occurrence; past office history is not regenerated.
const officeMoved = act(base, { type: 'move', id: 'office:2026-11-05', date: '2026-11-06' });
assert.ok(officeMoved.officeExceptions.includes('2026-11-05'));
assert.ok(!scheduleEntries(officeMoved, ctx).some(entry => entry.id === 'office:2026-11-05'));
assert.ok(scheduleEntries(officeMoved, ctx).some(entry => entry.id === 'office:2026-11-12'));
assert.ok(officeMoved.entries.some(entry => entry.kind === 'rest' && entry.date === '2026-11-06'));
const officeRemoved = act(base, { type: 'remove', id: 'office:2026-11-05' });
assert.equal(officeRemoved.entries.find(entry => entry.id === 'c1:2').date, '2026-11-05', 'The next unstarted gym uses the freed REST date');
assert.ok(!scheduleEntries(officeRemoved, ctx).some(entry => entry.id === 'office:2026-11-05'));
const changedLater = act(base, { type: 'officeDays', days: [2, 5] }, context('2026-11-06'));
assert.ok(scheduleEntries(changedLater, context('2026-11-06')).some(entry => entry.id === 'office:2026-11-05'), 'A future office change retains an elapsed Thursday');
const olderRules = structuredClone(base);
olderRules.officeRules[0].from = '2026-10-19';
assert.ok(scheduleEntries(olderRules, { ...ctx, since: '2026-10-19' }).some(entry => entry.kind === 'rest' && entry.date === '2026-10-26'), 'Expanded history includes recurring Rest');
const legacyRest = structuredClone(base);
legacyRest.entries.push({ id: 'office:legacy', kind: 'office', title: 'Office', date: '2026-11-09', status: 'planned' });
const normalizedRest = reconcileSchedule(legacyRest, ctx);
assert.equal(normalizedRest.entries.find(entry => entry.id === 'office:legacy').kind, 'rest', 'Old saved entries retain identity but become Rest');
assert.throws(() => act(base, { type: 'add', kind: 'office', date: '2026-11-09' }), /activity type/, 'New Office entries are unavailable');
const laterRecurring = act(officeMoved, { type: 'officeDays', days: [1, 5], effectiveDate: '2026-11-06' });
assert.equal(scheduleEntries(laterRecurring, ctx).filter(entry => entry.kind === 'rest' && entry.date === '2026-11-06').length, 1, 'Moved Rest and a new weekly rule never duplicate the same date');

// Backdating either moves the same occurrence or adds a distinct actual record.
const actualContext = context('2026-11-16', { summaries: [summary(0, '2026-11-03'), summary(1, '2026-11-04'), summary(2, '2026-11-06'), summary(3, '2026-11-07')] });
let late = reconcileSchedule(base, actualContext);
late = act(late, { type: 'move', id: runId, date: '2026-11-18' }, actualContext);
const lateBefore = gymDates(late);
const backdated = proposeSchedule(late, { type: 'move', id: runId, date: '2026-11-14', performed: true }, actualContext);
assert.equal(backdated.schedule.entries.find(entry => entry.id === runId).status, 'completed');
assert.equal(backdated.schedule.entries.find(entry => entry.id === runId).date, '2026-11-14');
assert.deepEqual(gyms(backdated.schedule).filter(entry => entry.status === 'completed'), gyms(late).filter(entry => entry.status === 'completed'), 'Recalculation preserves completed gym history');
assert.ok(backdated.changes.some(change => change.kind === 'gym'), 'Retrospective activity recalculates unfinished dates');
assert.equal(backdated.schedule.entries.filter(entry => entry.id === runId).length, 1);
const addedPast = proposeSchedule(late, { type: 'add', kind: 'run', date: '2026-11-14', performed: true }, actualContext);
assert.ok(addedPast.schedule.entries.some(entry => entry.id === runId && entry.date === '2026-11-18'));
assert.ok(addedPast.warnings.some(warning => warning.includes('4 days')));
assert.throws(() => act(late, { type: 'move', id: runId, date: '2026-11-14' }, actualContext), /record an activity/);
assert.throws(() => act(base, { type: 'add', kind: 'run', date: '2026-11-08', performed: true }), /future activity/);
const expired = reconcileSchedule(base, context('2026-11-09'));
assert.equal(expired.entries.find(entry => entry.id === runId).status, 'planned', 'Passing midnight never completes a run');
const recorded = act(expired, { type: 'complete', id: runId }, context('2026-11-09'));
assert.equal(recorded.entries.find(entry => entry.id === runId).status, 'completed');

// Completed/started gyms and actual activity history remain fixed, including conflicting truth.
const protectedContext = context('2026-11-04', { workout: { cycleId: 'c1', done: { 1: { 'ex-1-0': true } }, workoutDate: '2026-11-04' }, summaries: [summary(0, '2026-11-03')] });
const protectedPlan = reconcileSchedule(base, protectedContext);
assert.equal(protectedPlan.entries.find(entry => entry.id === 'c1:1').status, 'started');
assert.throws(() => act(protectedPlan, { type: 'move', id: 'c1:1', date: '2026-11-06' }, protectedContext), /has started/);
assert.throws(() => act(protectedPlan, { type: 'move', id: 'c1:0', date: '2026-11-06' }, protectedContext), /Completed/);
assert.throws(() => act(protectedPlan, { type: 'move', id: recordedRun.id, date: '2026-11-06' }, protectedContext), /Completed/);
const truth = proposeSchedule(protectedPlan, { type: 'add', kind: 'run', date: '2026-11-03', performed: true }, protectedContext);
assert.equal(truth.schedule.entries.filter(entry => entry.date === '2026-11-03' && entry.status === 'completed').length, 2);
assert.ok(truth.warnings.some(warning => warning.includes('Both actual records are preserved')));
const nowOffice = proposeSchedule(protectedPlan, { type: 'officeDays', days: [2, 3] }, protectedContext);
assert.equal(nowOffice.schedule.entries.find(entry => entry.id === 'c1:1').date, '2026-11-04');
assert.ok(nowOffice.warnings.some(warning => warning.includes('now a REST day')));
const setContext = context('2026-11-04', { logs: [{ session_id: 'c1:1', sets: [{ timestamp: '2026-11-04T18:00:00' }] }] });
assert.equal(reconcileSchedule(base, setContext).entries.find(entry => entry.id === 'c1:1').status, 'started', 'A logged set alone protects its workout');
const resumed = reconcileSchedule(base, context('2026-11-07', {
    summaries: [summary(0, '2026-11-03')],
    logs: [{ session_id: 'c1:1', sets: [{ timestamp: '2026-11-04T18:00:00' }] }]
}));
assert.equal(resumed.entries.find(entry => entry.id === 'c1:1').date, '2026-11-04', 'Started history stays on its actual start date');
assert.equal(resumed.entries.find(entry => entry.id === 'c1:2').date, '2026-11-10', 'An unfinished started workout gets the opportunity to resume before the next split');

// The projected cycle identity is adopted, not duplicated; history stays stable at rollover.
const nextContext = context('2026-11-10', { cycleId: 'c1~1', workout: { cycleId: 'c1~1', done: {} }, summaries: [summary(0, '2026-11-03'), summary(1, '2026-11-04'), summary(2, '2026-11-06'), summary(3, '2026-11-07')] });
const next = reconcileSchedule(base, nextContext);
assert.equal(next.entries.find(entry => entry.id === 'c1~1:0').date, '2026-11-10');
assert.equal(nextScheduleCycleId(next, 'c1~1'), 'c1~2');
assert.equal(new Set(next.entries.map(entry => entry.id)).size, next.entries.length);
assert.ok(gyms(next).filter(entry => entry.status === 'planned').length >= 12);
assert.deepEqual(reconcileSchedule(next, nextContext), next);
const historical = reconcileSchedule(base, context('2026-11-03', { summaries: [summary(0, '2026-10-25', 'older2'), summary(0, '2026-10-19', 'older1')] }));
assert.deepEqual(historical.cycleIds.slice(0, 3), ['older1', 'older2', 'c1']);

// Calendar arithmetic survives DST/month boundaries; failures do not return a partial cascade.
assert.equal(addDays('2026-10-25', 1), '2026-10-26');
assert.equal(addDays('2028-02-28', 1), '2028-02-29');
assert.throws(() => dateKey('2026-02-29'), /valid calendar/);
assert.throws(() => act(base, { type: 'add', kind: 'run', date: '2026-13-01' }), /valid calendar/);
assert.throws(() => act(base, { type: 'officeDays', days: [0, 1, 2, 3, 4, 5, 6] }), /available weekday/);
assert.throws(() => act(base, { type: 'move', id: 'c1:3', date: addDays(ctx.today, 729) }), /two years/);
const duplicate = structuredClone(base); duplicate.entries.push({ ...duplicate.entries[0] });
assert.throws(() => reconcileSchedule(duplicate, ctx), /duplicate sessions/);
assert.deepEqual(base, untouched, 'Rejected changes preserve the original schedule');
console.log('Training schedule: five scenarios, cycles, protected history, backdating, office exceptions, deterministic proposals and bounds OK');

// Backfilled rest is a record, not a request to rearrange current training.
const restBase = reconcileSchedule(null, ctx);
const backfilledRest = proposeSchedule(restBase, { type: 'add', kind: 'rest', date: '2026-11-02', performed: true }, ctx);
assert.deepEqual(gyms(backfilledRest.schedule), gyms(restBase));
assert.equal(backfilledRest.schedule.entries.find(entry => entry.kind === 'rest').status, 'completed');
assert.throws(() => proposeSchedule(backfilledRest.schedule, { type: 'add', kind: 'rest', date: '2026-11-02', performed: true }, ctx), /already/);
const withPastRun = act(restBase, { type: 'add', kind: 'run', date: '2026-11-01', performed: true });
assert.throws(() => proposeSchedule(withPastRun, { type: 'add', kind: 'rest', date: '2026-11-01', performed: true }, ctx), /already/);
assert.throws(() => proposeSchedule(restBase, { type: 'add', kind: 'rest', date: '2026-11-04', performed: true }, ctx), /future/);
const recurringPast = structuredClone(restBase);
recurringPast.officeRules = [{ from: '2026-10-01', days: [1, 4] }];
const pastRestOnWeeklyDay = act(recurringPast, { type: 'add', kind: 'rest', date: '2026-11-02', performed: true });
assert.equal(scheduleEntries(pastRestOnWeeklyDay, ctx).filter(entry => entry.date === '2026-11-02').length, 1, 'Recorded rest does not duplicate the weekly constraint');
