// Prescribed effort is not an observation. Missing provenance on older records
// must never be upgraded to a user report.
export function effortLabel(set) {
    if (!Number.isFinite(set.rpe)) return 'Effort unreported';
    return `RPE ${set.rpe} · ${set.rpe_source === 'reported' ? 'reported' : 'unverified'}`;
}

export function describeSet(set) {
    return `${set.weight_kg} kg × ${set.reps} · ${effortLabel(set)}`;
}
