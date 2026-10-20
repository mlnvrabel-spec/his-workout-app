import assert from 'node:assert/strict';
import { trainingAverages } from './src/core/TrainingStats.js';

const actual = (id, date, kind = 'gym', status = 'completed') => ({ id, date, kind, status });
const entries = [actual('a', '2026-10-07'), actual('b', '2026-10-20'), actual('b', '2026-10-20'),
    actual('c', '2026-09-23'), actual('old', '2026-09-22'), actual('future', '2026-10-21'),
    actual('plan', '2026-10-18', 'gym', 'planned'), actual('start', '2026-10-19', 'gym', 'started'),
    actual('run1', '2026-10-18', 'run'), actual('run2', '2026-10-06', 'run'), actual('walk', '2026-10-19', 'activity')];
const [two, four] = trainingAverages(entries, '2026-10-20');
assert.deepEqual([two.start, four.start], ['2026-10-07', '2026-09-23']);
assert.deepEqual(two.gym, { count: 2, perWeek: 1 });
assert.deepEqual(four.gym, { count: 3, perWeek: .75 });
assert.deepEqual(two.run, { count: 1, perWeek: .5 });
assert.deepEqual(four.run, { count: 2, perWeek: .5 });
assert.equal(trainingAverages([], '2026-03-30')[0].start, '2026-03-17', 'Calendar windows cross DST without fractional days');
assert.equal(trainingAverages(entries.filter(e => e.id !== 'run1'), '2026-10-20')[0].run.count, 0, 'Removing/undoing a recorded run changes the actual average');
console.log('Recorded 14/28-day averages, boundaries, identity and exclusions: OK');
