import assert from 'node:assert/strict';
import fs from 'node:fs';

const rawProtocol = fs.readFileSync('src/data/core_protocol.json', 'utf8');
const protocol = JSON.parse(rawProtocol);

assert.equal(protocol.protocol_metadata.version, '1.1.0');
assert.deepEqual(
    protocol.workouts.map(workout => workout.id),
    ['PUSH_A', 'PULL_A', 'PUSH_B', 'PULL_B']
);
assert.deepEqual(
    protocol.workouts[0].exercises.map(exercise => exercise.id),
    ['LOW_INC_DB_PRESS', 'REVERSE_HACK_SQUAT', 'CABLE_FLY', 'MACH_LATERAL', 'LEG_EXTENSION', 'CABLE_OH_EXT']
);
assert.deepEqual(
    protocol.workouts[2].exercises.map(exercise => exercise.id),
    ['HIGH_INC_SMITH', 'LEG_EXTENSION', 'SEATED_DB_OHP', 'CABLE_FLY', 'MACH_LATERAL', 'TRI_PUSHDOWN']
);
assert.equal(protocol.workouts[3].exercises[3].id, 'STANDING_CALF_RAISE');

for (const workout of protocol.workouts) {
    for (const exercise of workout.exercises) {
        assert.equal(typeof exercise.sets, 'number', `${workout.id}/${exercise.id} sets must be numeric`);
        assert.equal(typeof exercise.reps, 'string', `${workout.id}/${exercise.id} reps must be a range`);
        assert.equal(typeof exercise.rir, 'string', `${workout.id}/${exercise.id} must include a target RIR`);
        assert.equal(typeof exercise.rest_sec, 'number', `${workout.id}/${exercise.id} must include rest seconds`);
        assert.ok(protocol.exercise_library[exercise.id], `${exercise.id} is missing from exercise_library`);
    }
}

for (const group of protocol.swap_groups) {
    assert.ok(group.options.length > 1, `${group.id} should not exist without a genuine alternative`);
    for (const exerciseId of group.options) {
        assert.ok(protocol.exercise_library[exerciseId], `${group.id} references missing ${exerciseId}`);
    }
}

assert.ok(protocol.global_logic.ordering_rule.includes('alternate non-competing regions'));
assert.ok(protocol.global_logic.tempo_rule.includes('no fixed eccentric duration'));

console.log('Protocol data: OK');
