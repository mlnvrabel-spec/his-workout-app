// Pure sequencing policy. Slot identity never changes when display order changes.
export function sequenceConflict(a, b) {
    if (!a || !b) return 0;
    const shared = a.muscles.filter(muscle => b.muscles.includes(muscle));
    return shared.reduce((score, muscle) => score + (muscle === a.primary || muscle === b.primary ? 3 : 1), 0);
}

export function arrangeExercises(order, moved, destination, locked, relationships, priority = 0) {
    const requested = order.filter(slot => slot !== moved);
    requested.splice(destination, 0, moved);
    const fixed = new Map(order.flatMap((slot, index) => locked.has(slot) ? [[index, slot]] : []));
    if (fixed.has(destination)) return null;
    fixed.set(destination, moved);
    const remaining = order.filter(slot => ![...fixed.values()].includes(slot));
    let best, bestScore;
    function visit(candidate, available) {
        const index = candidate.length;
        if (index === order.length) {
            const conflict = candidate.slice(1).reduce((sum, slot, i) => sum + sequenceConflict(relationships[candidate[i]], relationships[slot]), 0);
            const distance = candidate.reduce((sum, slot, i) => sum + Math.abs(requested.indexOf(slot) - i), 0);
            const priorityPenalty = moved !== priority && destination !== 0 && order[0] === priority && candidate[0] !== priority ? 1 : 0;
            if (!bestScore || conflict < bestScore[0] || (conflict === bestScore[0] && (priorityPenalty < bestScore[1] || (priorityPenalty === bestScore[1] && distance < bestScore[2])))) {
                best = candidate; bestScore = [conflict, priorityPenalty, distance];
            }
            return;
        }
        if (fixed.has(index)) visit([...candidate, fixed.get(index)], available);
        else for (const slot of available) visit([...candidate, slot], available.filter(value => value !== slot));
    }
    visit([], remaining);
    return best;
}
