import assert from 'node:assert/strict';
import { buildProtocolData, resolveExercise } from './src/core/ProtocolData.js';
import { environment, engine, protocol } from './test_helpers.mjs';

// Lock the existing UI payload, including serialized key order: completion
// reconciliation compares snapshots with JSON.stringify.
const slot = { id: 'PRESS', swap_group: 'presses', sets: 3, reps: '8-12', rir: '0', rest_sec: 120 };
const library = {
    PRESS: {
        name: 'Press', technique: ['Brace'], mistakes: ['Rushing'],
        visualization: 'Path: Drive upward', proTip: 'Stay controlled'
    }
};
const expected = {
    _exerciseId: 'PRESS', _swapGroup: 'presses', name: 'Press',
    sets: 3, reps: '8-12', rir: '0', rirClass: '0', rest: '2m',
    technique: ['Brace'], mistakes: ['Rushing'],
    visualization: 'Path', vizText: 'Drive upward', proTip: 'Stay controlled'
};
assert.equal(JSON.stringify(resolveExercise(slot, library)), JSON.stringify(expected));
for (const [seconds, label] of [[90, '90s'], [180, '3m'], [undefined, '90s'], [NaN, '90s'], ['120', '90s']]) {
    assert.equal(resolveExercise({ ...slot, rest_sec: seconds }, library).rest, label);
}
const warn = console.warn;
try {
    console.warn = () => {};
    assert.deepEqual(resolveExercise(slot, {}), {
        ...expected, name: 'PRESS', technique: [], mistakes: [], visualization: '', vizText: '', proTip: ''
    });
} finally {
    console.warn = warn;
}

const source = structuredClone(protocol);
const converted = buildProtocolData(protocol);
assert.deepEqual(protocol, source, 'Protocol conversion must not mutate the source data');
assert.equal(converted.length, protocol.workouts.length);
for (const [day, workout] of converted.entries()) {
    assert.equal(workout.id, protocol.workouts[day].id);
    assert.equal(workout.exercises.length, protocol.workouts[day].exercises.length);
}

// Automatic and explicit completion must both resolve another window's saved
// substitution, while preserving the original slot's training prescription.
for (const completion of ['counted', 'finished']) {
    environment();
    const stale = await engine();
    const other = await engine();
    const original = structuredClone(stale.protocolData[0].exercises[0]);
    const alternative = stale.getSwapOptions(original._exerciseId)[0].id;
    assert.equal(await other.swapExercise(0, 0, alternative), true);
    assert.equal(stale.protocolData[0].exercises[0]._exerciseId, original._exerciseId);

    if (completion === 'finished') {
        assert.equal(await stale.finishSession(), true);
    } else {
        const threshold = Math.ceil(stale.protocolData[0].exercises.length / 2);
        for (let index = 0; index < threshold; index++) await stale.toggleComplete(`ex-0-${index}`, 0);
    }
    const summary = stale.getDaySummary(0);
    assert.equal(summary.completionType, completion);
    assert.equal(summary.exercises[0]._exerciseId, alternative);
    for (const field of ['sets', 'reps', 'rir', 'rest', '_swapGroup']) {
        assert.equal(summary.exercises[0][field], original[field], `Substitution must preserve ${field}`);
    }
    const snapshot = structuredClone(summary.exercises);
    stale.protocolData[0].exercises[0].name = 'Unsaved view change';
    stale.protocolData[0].exercises[0].technique.push('Unsaved guidance');
    assert.deepEqual(summary.exercises, snapshot, 'History must not share mutable exercise data with the UI');
    const reloaded = await engine();
    assert.deepEqual(reloaded.getDaySummary(0).exercises, snapshot);
}

console.log('Protocol conversion, fallback formatting, concurrent substitutions and independent history snapshots: OK');
