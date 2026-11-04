/** Undo user inputs, then let the scheduler recompute derived dates. Never restore a whole old calendar. */
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function inputs(schedule) {
    const values = new Map();
    values.set('preferences', schedule.preferences);
    values.set('officeRules', schedule.officeRules);
    for (const date of schedule.officeExceptions || []) values.set(`exception:${date}`, true);
    for (const date of schedule.clearedDates || []) values.set(`clear:${date}`, true);
    for (const entry of schedule.entries) {
        if (entry.kind === 'gym') {
            if (entry.status === 'planned' && entry.pinnedDate) values.set(`pin:${entry.id}`, entry.pinnedDate);
        } else if (entry.status === 'planned' && entry.source !== 'planner') values.set(`entry:${entry.id}`, entry);
    }
    return values;
}

export function recordCalendarEdit(schedule, before, intent, trainingToken, today) {
    if (!['add', 'move', 'remove', 'change', 'preferences', 'officeDays'].includes(intent.type) || intent.performed) return;
    const previous = before.entries.find(entry => entry.id === intent.id);
    const from = previous?.date || (intent.id?.startsWith('office:') ? intent.id.slice(7) : null);
    if ((intent.date || from) && (intent.date || from) < today) return;
    const old = inputs(before), current = inputs(schedule);
    const patches = [...new Set([...old.keys(), ...current.keys()])].filter(key => !same(old.get(key), current.get(key)))
        .map(key => ({ key, before: structuredClone(old.get(key)), after: structuredClone(current.get(key)) }));
    if (!patches.length) return;
    const scopes = [intent.date, from].filter(Boolean).map(date => `date:${date}`);
    for (const patch of patches) if (patch.key.startsWith('entry:')) scopes.push(patch.key);
    if (intent.type === 'move' && intent.id) scopes.push(`entry:${intent.id}`);
    if (intent.type === 'preferences') scopes.push('settings');
    if (intent.type === 'officeDays') scopes.push('recurrence');
    schedule.editSequence = (schedule.editSequence || 0) + 1;
    schedule.editHistory = [...(schedule.editHistory || []), { id: `edit:${schedule.editSequence}`, scopes: [...new Set(scopes)], patches, trainingToken }].slice(-40);
}

function conflict(schedule, edit, trainingToken) {
    if (edit.trainingToken !== trainingToken) return 'Saved training changed after this edit. Undo is unavailable to protect its records.';
    const current = inputs(schedule);
    if (edit.patches.some(patch => !same(current.get(patch.key), patch.after))) return 'A later edit changed this activity or rule. Undo that edit first.';
    return '';
}

export function calendarUndoFor(schedule, trainingToken, { id, date, scope } = {}) {
    const scopes = [id && `entry:${id}`, date && `date:${date}`, scope].filter(Boolean);
    const edit = (schedule.editHistory || []).filter(value => value.scopes.some(key => scopes.includes(key))).at(-1);
    if (!edit) return null;
    const reason = conflict(schedule, edit, trainingToken);
    return { id: edit.id, available: !reason, reason };
}

export function undoCalendarEdit(saved, editId, trainingToken) {
    const schedule = structuredClone(saved);
    const edit = schedule.editHistory?.find(value => value.id === editId);
    if (!edit) throw new Error('This card no longer has an edit to undo.');
    const reason = conflict(schedule, edit, trainingToken);
    if (reason) throw new Error(reason);
    for (const patch of edit.patches) {
        const [kind, ...parts] = patch.key.split(':');
        const key = parts.join(':');
        if (kind === 'preferences' || kind === 'officeRules') schedule[kind] = structuredClone(patch.before);
        if (kind === 'clear' || kind === 'exception') {
            const field = kind === 'clear' ? 'clearedDates' : 'officeExceptions';
            schedule[field] = schedule[field].filter(value => value !== key);
            if (patch.before) schedule[field].push(key);
        }
        if (kind === 'entry') {
            schedule.entries = schedule.entries.filter(entry => entry.id !== key);
            if (patch.before) schedule.entries.push(structuredClone(patch.before));
        }
        if (kind === 'pin') {
            const entry = schedule.entries.find(value => value.id === key && value.kind === 'gym' && value.status === 'planned');
            if (!entry) throw new Error('The workout changed. Its saved training cannot be undone here.');
            if (patch.before) entry.pinnedDate = patch.before;
            else delete entry.pinnedDate;
        }
    }
    schedule.editHistory = schedule.editHistory.filter(value => value.id !== editId);
    return schedule;
}
