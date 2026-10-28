/** Convert protocol prescriptions into the exercise data consumed by the UI. */
export function buildProtocolData(data) {
    return data.workouts.map(workout => ({
        id: workout.id,
        title: workout.title,
        subtitle: workout.subtitle,
        exercises: workout.exercises.map(slot => resolveExercise(slot, data.exercise_library))
    }));
}

/** A substitution changes the library entry while retaining the slot's prescription. */
export function resolveExercise(slot, exerciseLibrary) {
    const entry = exerciseLibrary[slot.id];
    const prescription = {
        _exerciseId: slot.id,
        _swapGroup: slot.swap_group,
        name: entry ? entry.name : slot.id,
        sets: slot.sets,
        reps: slot.reps,
        rir: slot.rir,
        rirClass: slot.rir == '0' ? '0' : '1',
        rest: formatRest(slot.rest_sec)
    };

    if (!entry) {
        console.warn(`[WorkoutEngine] Missing library entry for exercise: ${slot.id}`);
        return {
            ...prescription, technique: [], mistakes: [],
            visualization: '', vizText: '', proTip: ''
        };
    }

    const [visualization, vizText] = entry.visualization.split(':');
    return {
        ...prescription,
        technique: entry.technique,
        mistakes: entry.mistakes,
        visualization,
        vizText: vizText ? vizText.trim() : '',
        proTip: entry.proTip
    };
}

function formatRest(seconds) {
    const restSeconds = Number.isFinite(seconds) ? seconds : 90;
    return restSeconds % 60 === 0 ? `${restSeconds / 60}m` : `${restSeconds}s`;
}
