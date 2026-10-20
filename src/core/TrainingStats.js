import { addDays, dateKey } from './TrainingSchedule.js';

/** Recorded sessions per calendar week, never planned or inferred activity. */
export function trainingAverages(entries, today) {
    const end = dateKey(today);
    const actuals = new Map();
    for (const entry of entries) {
        if (entry.status !== 'completed' || !['gym', 'run'].includes(entry.kind) || !entry.date || entry.date > end) continue;
        actuals.set(`${entry.kind}:${entry.id}`, entry);
    }
    return [2, 4].map(weeks => {
        const start = addDays(end, 1 - weeks * 7);
        const counts = { gym: 0, run: 0 };
        for (const entry of actuals.values()) if (entry.date >= start) counts[entry.kind]++;
        return { weeks, start, end, gym: { count: counts.gym, perWeek: counts.gym / weeks }, run: { count: counts.run, perWeek: counts.run / weeks } };
    });
}
