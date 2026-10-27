/** Pure calendar rules. WorkoutEngine owns persistence and transaction/Undo boundaries. */
const DAY_MS = 86400000;
const MAX_FORWARD_DAYS = 730;
const DEFAULT_OFFICE_DAYS = [1, 4];
const ACTIVITY_KINDS = new Set(['office', 'rest', 'run', 'activity']);
const TITLES = { office: 'REST', rest: 'REST', run: 'Norwegian 4×4', activity: 'Activity' };

export function dateKey(value = new Date()) {
    if (typeof value === 'string') {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Choose a valid calendar date.');
        const parsed = new Date(`${value}T12:00:00Z`);
        if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Choose a valid calendar date.');
        return value;
    }
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) throw new Error('Choose a valid calendar date.');
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function addDays(value, days) {
    const date = dateKey(value);
    if (!Number.isInteger(days)) throw new Error('Calendar offsets must be whole days.');
    return new Date(new Date(`${date}T12:00:00Z`).getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

const weekday = date => new Date(`${date}T12:00:00Z`).getUTCDay();
const monday = date => addDays(date, -((weekday(date) + 6) % 7));
const latest = (...dates) => dates.filter(Boolean).sort().at(-1);
const sessionId = (cycleId, day) => `${cycleId}:${day}`;
const isProtected = entry => entry.status === 'started' || entry.status === 'completed';

function contextValues(context) {
    const today = dateKey(context.today);
    const cycleId = context.cycleId || context.workout?.cycleId;
    if (!cycleId) throw new Error('A workout cycle is required to plan training.');
    const protocol = context.protocolData || [];
    if (!protocol.length) throw new Error('Load the training protocol before planning.');
    return { today, cycleId, protocol };
}

function officeOn(schedule, date) {
    if (schedule.officeExceptions.includes(date)) return false;
    const rule = schedule.officeRules.filter(value => value.from <= date).sort((a, b) => a.from.localeCompare(b.from)).at(-1);
    return Boolean(rule?.days.includes(weekday(date)));
}

function blockedDate(schedule, date, ignoredId = null) {
    if (officeOn(schedule, date)) return 'REST';
    const occupied = schedule.entries.find(entry => entry.id !== ignoredId && entry.date === date && (entry.kind !== 'gym' || isProtected(entry)));
    return occupied?.title || '';
}

function blankSchedule(context) {
    const { today, cycleId } = contextValues(context);
    return {
        version: 1, baseCycleId: cycleId, cycleIds: [cycleId], nextCycleNumber: 1,
        officeRules: [{ from: today, days: [...DEFAULT_OFFICE_DAYS] }], officeExceptions: [], entries: []
    };
}

function nextCycle(schedule) {
    let id;
    do { id = `${schedule.baseCycleId}~${schedule.nextCycleNumber++}`; } while (schedule.cycleIds.includes(id));
    const order = schedule.cycleOrders?.[schedule.cycleIds.at(-1)];
    if (order) schedule.cycleOrders[id] = [...order];
    schedule.cycleIds.push(id);
    return id;
}

export function nextScheduleCycleId(schedule, currentCycleId) {
    const index = schedule?.cycleIds?.indexOf(currentCycleId) ?? -1;
    return index >= 0 ? schedule.cycleIds[index + 1] || null : null;
}

export function firstScheduleDay(schedule, cycleId) {
    return schedule?.cycleOrders?.[cycleId]?.[0] ?? 0;
}

export function scheduleDaySkipped(schedule, cycleId, day) {
    return Boolean(schedule?.skippedSessionIds?.includes(sessionId(cycleId, day)));
}

function gymOrder(schedule, a, b) {
    const position = entry => schedule.cycleOrders?.[entry.cycleId]?.indexOf(entry.day) ?? entry.day;
    return schedule.cycleIds.indexOf(a.cycleId) - schedule.cycleIds.indexOf(b.cycleId) || position(a) - position(b);
}

function gymEntries(schedule) {
    return schedule.entries.filter(entry => entry.kind === 'gym').sort((a, b) => gymOrder(schedule, a, b));
}

function addPlannedCycles(schedule, cycleId, protocol) {
    const current = schedule.cycleIds.indexOf(cycleId);
    while (schedule.cycleIds.length < current + 4) nextCycle(schedule);
    const newIds = new Set();
    for (const id of schedule.cycleIds.slice(current)) {
        protocol.forEach((day, index) => {
            const key = sessionId(id, index);
            if (scheduleDaySkipped(schedule, id, index)) return;
            if (!schedule.entries.some(entry => entry.id === key)) {
                schedule.entries.push({ id: key, kind: 'gym', cycleId: id, day: index, title: day.title, status: 'planned', source: 'dashboard' });
                newIds.add(key);
            }
        });
    }
    return newIds;
}

function earliestDate(schedule, requested, ignoredId, weekCounts = null) {
    let date = dateKey(requested);
    for (let offset = 0; offset <= MAX_FORWARD_DAYS; offset++, date = addDays(date, 1)) {
        if (blockedDate(schedule, date, ignoredId)) continue;
        if (weekCounts && (weekCounts.get(monday(date)) || 0) >= 4) continue;
        return date;
    }
    throw new Error('No available date within two years. Change the rest or activity dates first.');
}

/** Move only the necessary future chain. A freed date never pulls later sessions backward. */
function placeGyms(schedule, today, { newIds = new Set(), exactId = null, exactDate = null, strict = false } = {}) {
    const counts = new Map();
    for (const entry of schedule.entries.filter(entry => entry.kind === 'gym' && (!newIds.has(entry.id) || isProtected(entry)) && entry.date)) {
        counts.set(monday(entry.date), (counts.get(monday(entry.date)) || 0) + 1);
    }
    let previous = null;
    for (const entry of gymEntries(schedule)) {
        if (isProtected(entry)) {
            // Actual history may contain legacy sessions completed out of order. Never rewrite it.
            // An unfinished session begun earlier still needs today's opportunity
            // to resume; do not schedule its successor ahead of that work.
            previous = latest(previous, entry.date, entry.status === 'started' ? today : null);
            continue;
        }
        if (entry.date && entry.date < today) entry.missedDate ||= entry.date;
        const requested = entry.id === exactId ? exactDate : latest(entry.date, today);
        const floor = latest(requested, previous && addDays(previous, 1), today);
        if (entry.id === exactId && floor !== exactDate) throw new Error('This date would put the workout before an unfinished earlier session.');
        const date = earliestDate(schedule, floor, entry.id, newIds.has(entry.id) ? counts : null);
        if (date > addDays(today, MAX_FORWARD_DAYS)) throw new Error('This change moves training more than two years ahead. Change the blocking dates first.');
        if (entry.id === exactId && date !== exactDate) throw new Error(`${blockedDate(schedule, exactDate, entry.id) || 'Another session'} occupies this date. Move it first.`);
        // A started session later in the sequence is a fixed boundary for a requested move.
        if (strict && entry.date !== date) {
            const nextLocked = gymEntries(schedule).find(other => gymOrder(schedule, entry, other) < 0 && isProtected(other) && other.date >= today);
            if (nextLocked && date >= nextLocked.date) throw new Error('This change would move a workout across a started or completed session.');
        }
        entry.date = date;
        entry.originalDate ||= date;
        if (newIds.has(entry.id)) counts.set(monday(date), (counts.get(monday(date)) || 0) + 1);
        previous = date;
    }
}

/** Derive actual gym status from durable summaries, checks and sets; never trust a stale plan. */
function reconcileActuals(schedule, context) {
    const { today, cycleId, protocol } = contextValues(context);
    const summaries = context.summaries || [];
    const logs = context.logs || [];
    const historicalCycles = [...summaries].sort((a, b) => String(a.sessionId || a.completedAt).localeCompare(String(b.sessionId || b.completedAt)))
        .map(summary => summary.cycleId).filter((id, index, ids) => id && !schedule.cycleIds.includes(id) && ids.indexOf(id) === index);
    schedule.cycleIds.unshift(...historicalCycles);
    for (const summary of summaries) {
        if (!Number.isInteger(summary.day) || !summary.cycleId) continue;
        const id = sessionId(summary.cycleId, summary.day);
        if (!schedule.entries.some(entry => entry.id === id)) {
            schedule.entries.push({ id, kind: 'gym', cycleId: summary.cycleId, day: summary.day, title: summary.title || protocol[summary.day]?.title || 'Workout' });
        }
    }
    for (const entry of gymEntries(schedule)) {
        const summary = summaries.find(value => value.id === entry.id);
        const entryLogs = logs.filter(value => value.session_id === entry.id && value.sets?.length);
        const checked = entry.cycleId === cycleId && Object.values(context.workout?.done?.[entry.day] || {}).some(Boolean);
        if (summary) {
            entry.status = 'completed';
            entry.date = /^\d{4}-\d{2}-\d{2}$/.test(summary.sessionId || '') ? dateKey(summary.sessionId) : dateKey(new Date(summary.completedAt));
        } else if (entryLogs.length || checked) {
            const setDates = entryLogs.flatMap(log => log.sets.map(set => set.timestamp).filter(Boolean)).sort();
            const actualDate = setDates.length ? dateKey(new Date(setDates[0])) : (context.workout?.workoutDate || today);
            if (entry.status !== 'started' || !entry.date) entry.date = actualDate;
            entry.status = 'started';
        } else {
            entry.status = 'planned';
        }
        if (entry.date) entry.originalDate ||= entry.date;
    }
}

/** Safe to call repeatedly. Input objects are never mutated. */
export function reconcileSchedule(saved, context) {
    const { today, cycleId, protocol } = contextValues(context);
    const schedule = saved ? structuredClone(saved) : blankSchedule(context);
    schedule.officeRules ||= [{ from: today, days: [...DEFAULT_OFFICE_DAYS] }];
    schedule.officeExceptions ||= [];
    schedule.entries ||= [];
    schedule.cycleIds ||= [cycleId];
    schedule.baseCycleId ||= schedule.cycleIds[0];
    schedule.nextCycleNumber ||= 1;
    schedule.version = 1;
    if (new Set(schedule.entries.map(entry => entry.id)).size !== schedule.entries.length) throw new Error('The calendar contains duplicate sessions. Reload before changing it.');
    if (!schedule.cycleIds.includes(cycleId)) schedule.cycleIds.push(cycleId);
    // Starting a skipped split explicitly in Workout restores its planned identity.
    if (schedule.skippedSessionIds) schedule.skippedSessionIds = schedule.skippedSessionIds.filter(id =>
        !(context.summaries || []).some(summary => summary.id === id)
        && !(context.logs || []).some(log => log.session_id === id && log.sets?.length)
        && !protocol.some((_, day) => id === sessionId(cycleId, day) && Object.values(context.workout?.done?.[day] || {}).some(Boolean)));
    const newIds = addPlannedCycles(schedule, cycleId, protocol);
    reconcileActuals(schedule, context);
    placeGyms(schedule, today, { newIds });
    return schedule;
}

export function movableReason(entry, context) {
    if (entry.status === 'completed') return 'Completed sessions stay in history.';
    if (entry.status === 'started') return 'This workout has started. Its checks and sets stay on this date.';
    if ((entry.kind === 'office' || entry.kind === 'rest') && entry.date < context.today) return 'Past calendar constraints stay in history.';
    return '';
}

function correctableGymRecord(entry, context) {
    const summary = context.summaries?.find(value => value.id === entry.id);
    const checked = record => record?.cycleId === entry.cycleId && Object.values(record.done?.[entry.day] || {}).some(Boolean);
    return Boolean(entry.kind === 'gym' && entry.status === 'completed'
        && summary?.source === 'manual_backfill' && summary.completionType === 'recorded'
        && summary.completedExercises === 0 && !checked(summary) && !checked(context.workout)
        && !checked(context.workout?.nextCycleDraft)
        && !(context.logs || []).some(log => log.session_id === entry.id && log.sets?.length));
}

/** The agenda includes recurring office occurrences without persisting duplicate entries. */
export function scheduleEntries(schedule, context) {
    const { today } = contextValues(context);
    const entries = structuredClone(schedule.entries);
    const end = latest(context.until, addDays(today, 14), ...entries.filter(entry => entry.date >= today).map(entry => entry.date));
    let date = addDays(today, -3);
    const range = Math.min(MAX_FORWARD_DAYS, Math.round((new Date(`${end}T12:00:00Z`) - new Date(`${date}T12:00:00Z`)) / DAY_MS));
    for (let day = 0; day <= range; day++, date = addDays(date, 1)) {
        if (officeOn(schedule, date) && !entries.some(entry => entry.kind === 'rest' && entry.date === date)) entries.push({ id: `office:${date}`, kind: 'office', title: 'REST', date, status: 'planned', recurring: true });
    }
    return entries.map(entry => ({ ...entry, movable: !movableReason(entry, context), movableReason: movableReason(entry, context), correctable: correctableGymRecord(entry, context) }))
        .sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
}

function entryDiff(before, after, context) {
    const windowContext = { ...context, until: latest(...before.entries.map(entry => entry.date), ...after.entries.map(entry => entry.date)) };
    const oldEntries = new Map(scheduleEntries(before, windowContext).map(entry => [entry.id, entry]));
    const newEntries = new Map(scheduleEntries(after, windowContext).map(entry => [entry.id, entry]));
    const changes = [];
    for (const id of new Set([...oldEntries.keys(), ...newEntries.keys()])) {
        const old = oldEntries.get(id), next = newEntries.get(id);
        if (!old || !next || old.date !== next.date || old.status !== next.status) {
            changes.push({ id, kind: (next || old).kind, title: (next || old).title, from: old?.date || null, to: next?.date || null,
                status: next?.status, action: !old ? 'added' : !next ? 'removed' : old.date !== next.date ? 'moved' : 'completed' });
        }
    }
    return changes;
}

function assertDestination(schedule, entry, date, today, performed = false) {
    if (date > addDays(today, MAX_FORWARD_DAYS)) throw new Error('Choose a date within the next two years.');
    if (date < today && !performed) throw new Error('Choose today or a future date, or record an activity that already happened.');
    if (performed) {
        if (entry.kind === 'gym' || entry.kind === 'office') throw new Error('Use the workout checklist to record gym training.');
        if (entry.kind === 'rest' && schedule.entries.some(value => value.date === date && (value.kind === 'rest' || isProtected(value)))) throw new Error('This date already has recorded training or rest. Keep its history unchanged.');
        if (date > today) throw new Error('A future activity cannot be recorded as completed.');
        return; // Actual history can truthfully contain an office day, run and lifting together.
    }
    const reason = blockedDate(schedule, date, entry.id);
    if (reason) throw new Error(`${reason} occupies this date. Move or remove it first.`);
}

function resolveEntry(schedule, id, context) {
    const entry = scheduleEntries(schedule, context).find(value => value.id === id);
    if (!entry) throw new Error('This session is no longer in the calendar. Refresh and try again.');
    const reason = movableReason(entry, context);
    if (reason) throw new Error(reason);
    return entry;
}

function removeEntry(schedule, entry) {
    if (entry.recurring) schedule.officeExceptions.push(entry.date);
    else schedule.entries = schedule.entries.filter(value => value.id !== entry.id);
}

function activityId(schedule, kind, date) {
    let index = 1;
    while (schedule.entries.some(entry => entry.id === `${kind}:${date}:${index}`)) index++;
    return `${kind}:${date}:${index}`;
}

function warningsFor(schedule, context) {
    const warnings = [];
    const entries = schedule.entries;
    for (const entry of entries.filter(value => isProtected(value) && value.date >= context.today && officeOn(schedule, value.date))) {
        warnings.push(`${entry.title} is already recorded or started on ${entry.date}, now a REST day. Its history stays unchanged.`);
    }
    for (const entry of entries.filter(value => value.kind === 'run')) {
        const previous = entries.filter(value => value.kind === 'run' && value.status === 'completed' && value.date < entry.date).sort((a, b) => a.date.localeCompare(b.date)).at(-1);
        if (previous && entry.date >= context.today) {
            const gap = Math.round((new Date(`${entry.date}T12:00:00Z`) - new Date(`${previous.date}T12:00:00Z`)) / DAY_MS);
            if (gap < 7 || gap > 10) warnings.push(`The 4×4 on ${entry.date} is ${gap} days after the last recorded run. The 7–10 day aim is a preference.`);
        }
        if (entry.status === 'completed' && entries.some(other => other.kind === 'gym' && isProtected(other) && other.date === entry.date)) warnings.push(`Recorded gym training and a run share ${entry.date}. Both actual records are preserved.`);
    }
    for (const entry of entries.filter(value => value.kind === 'activity' && value.demanding)) {
        if (entries.some(other => other.kind === 'gym' && other.date === addDays(entry.date, 1))) warnings.push(`Gym training follows ${entry.title} on the next day. Keep or move it based on how you feel; no rest day is added automatically.`);
    }
    return [...new Set(warnings)];
}

/** A proposal is an isolated value; only the engine may commit it. */
export function proposeSchedule(saved, intent, context) {
    const before = reconcileSchedule(saved, context);
    const schedule = structuredClone(before);
    const today = dateKey(context.today);
    let exactId = null, exactDate = null;
    let recordedGym = null;
    let restartedCycleId = null;
    let removedGym = null;
    let removedRecord = null;
    let correctedGym = null;
    const notices = [];
    if (['correctGym', 'removeGymRecord'].includes(intent.type)) {
        const entry = schedule.entries.find(value => value.id === intent.id);
        if (!entry || !correctableGymRecord(entry, context)) throw new Error('Only manually entered workouts without saved checks or sets can be corrected here.');
        const { protocol } = contextValues(context);
        if (intent.type === 'correctGym' && (!Number.isInteger(intent.day) || !protocol[intent.day])) throw new Error('Choose the workout you performed.');
        if (intent.type === 'correctGym' && intent.day === entry.day) throw new Error('This is already the recorded workout.');
        removedRecord = structuredClone(context.summaries.find(value => value.id === entry.id));
        removeEntry(schedule, entry);
        // Retire the mistaken identity so reconciliation cannot recreate it as a plan.
        schedule.skippedSessionIds ||= [];
        if (!schedule.skippedSessionIds.includes(entry.id)) schedule.skippedSessionIds.push(entry.id);
        if (intent.type === 'correctGym') {
            const historyIndex = Math.min(schedule.cycleIds.indexOf(entry.cycleId), schedule.cycleIds.indexOf(context.cycleId));
            const historyCycleId = nextCycle(schedule);
            schedule.cycleIds.pop();
            schedule.cycleIds.splice(historyIndex, 0, historyCycleId);
            correctedGym = { id: sessionId(historyCycleId, intent.day), kind: 'gym', cycleId: historyCycleId, day: intent.day,
                title: protocol[intent.day].title, date: entry.date, originalDate: entry.date, status: 'completed', source: 'manual_backfill' };
            schedule.entries.push(correctedGym);
        }
    } else if (intent.type === 'recordGym') {
        const date = dateKey(intent.date);
        if (date >= today) throw new Error('Choose a past date. Use the workout checklist for today.');
        const next = gymEntries(schedule).find(entry => entry.status !== 'completed');
        if (schedule.entries.some(entry => entry.date === date && ((entry.kind === 'rest' && isProtected(entry)) || (entry.kind === 'gym' && isProtected(entry))))) throw new Error('This date already has recorded training or rest. Keep its history unchanged.');
        const { protocol } = contextValues(context);
        const chosen = Object.hasOwn(intent, 'day');
        if (chosen && (!Number.isInteger(intent.day) || !protocol[intent.day])) throw new Error('Choose the workout you performed.');
        const completed = gymEntries(schedule).filter(entry => entry.status === 'completed');
        const followsPlan = next?.status === 'planned' && next.cycleId === context.cycleId && next.day === intent.day
            && completed.every(entry => entry.date < date && gymOrder(schedule, entry, next) < 0);
        if (chosen && !followsPlan) {
            const draftStarted = Object.values(context.workout?.nextCycleDraft?.done || {}).some(checks => Object.values(checks).some(Boolean));
            if (draftStarted || gymEntries(schedule).some(entry => entry.status === 'started')) throw new Error('A workout has already started. Finish it before changing the future split; its saved checks and sets stay unchanged.');
            // Retire only unstarted plans. Actual records keep their identities and dates.
            schedule.entries = schedule.entries.filter(entry => entry.kind !== 'gym' || isProtected(entry));
            const historyCycleId = nextCycle(schedule);
            recordedGym = { id: sessionId(historyCycleId, intent.day), kind: 'gym', cycleId: historyCycleId, day: intent.day,
                title: protocol[intent.day].title, date, originalDate: date, status: 'completed', source: 'manual_backfill' };
            schedule.entries.push(recordedGym);
            restartedCycleId = nextCycle(schedule);
            schedule.cycleOrders ||= {};
            schedule.cycleOrders[restartedCycleId] = protocol.map((_, index) => (intent.day + 1 + index) % protocol.length);
            addPlannedCycles(schedule, restartedCycleId, protocol);
            notices.push(`Future gym training restarts with ${protocol[(intent.day + 1) % protocol.length].title}. Replaced plans are not counted as completed workouts. Recorded history stays unchanged.`);
        } else {
            if (!next || (!chosen && next.id !== intent.id) || next.status !== 'planned' || next.cycleId !== context.cycleId) throw new Error('Record the next unstarted workout in split order. Started workouts keep their saved checks and sets.');
            const previous = completed.filter(entry => gymOrder(schedule, entry, next) < 0);
            if (previous.some(entry => entry.date >= date)) throw new Error('Choose a date after the preceding recorded gym session.');
            next.date = date;
            next.status = 'completed';
            next.source = 'manual_backfill';
            recordedGym = structuredClone(next);
        }
    } else if (intent.type === 'officeDays') {
        if (!Array.isArray(intent.days) || intent.days.some(day => !Number.isInteger(day) || day < 0 || day > 6)) throw new Error('Choose valid rest weekdays.');
        const days = [...new Set(intent.days)].sort();
        if (days.length === 7) throw new Error('Leave at least one available weekday, or use individual rest dates.');
        const from = dateKey(intent.effectiveDate || today);
        if (from < today) throw new Error('Recurring rest changes apply from today or a future date.');
        schedule.officeRules = schedule.officeRules.filter(rule => rule.from < from);
        schedule.officeRules.push({ from, days });
        // A changed availability rule can coexist with actual training; never rewrite history.
    } else if (intent.type === 'add') {
        if (!ACTIVITY_KINDS.has(intent.kind)) throw new Error('Choose an activity type.');
        const date = dateKey(intent.date);
        const entry = { id: intent.id || activityId(schedule, intent.kind, date), kind: intent.kind, title: String(intent.title || TITLES[intent.kind]).trim().slice(0, 100) || TITLES[intent.kind], date, originalDate: date,
            status: intent.performed ? 'completed' : 'planned', source: 'manual', demanding: Boolean(intent.demanding) };
        if (schedule.entries.some(value => value.id === entry.id)) throw new Error('This activity already exists. Move the existing activity instead.');
        assertDestination(schedule, entry, date, today, Boolean(intent.performed));
        schedule.entries.push(entry);
    } else if (intent.type === 'move') {
        const entry = resolveEntry(schedule, intent.id, context);
        const date = dateKey(intent.date);
        if (entry.date !== date || intent.performed) {
            // Free the original occurrence before checking an office destination.
            removeEntry(schedule, entry);
            const moved = { ...entry, date, source: entry.source || 'manual' };
            delete moved.recurring; delete moved.movable; delete moved.movableReason;
            assertDestination(schedule, moved, date, today, Boolean(intent.performed));
            if (entry.recurring) moved.id = activityId(schedule, 'office', date);
            if (intent.performed) moved.status = 'completed';
            schedule.entries.push(moved);
            if (entry.kind === 'gym') { exactId = moved.id; exactDate = date; }
        }
    } else if (intent.type === 'remove') {
        const entry = resolveEntry(schedule, intent.id, context);
        if (entry.kind === 'gym') {
            schedule.skippedSessionIds ||= [];
            schedule.skippedSessionIds.push(entry.id);
            removedGym = structuredClone(entry);
        }
        removeEntry(schedule, entry);
    } else if (intent.type === 'complete') {
        const entry = resolveEntry(schedule, intent.id, context);
        if (entry.kind !== 'run' && entry.kind !== 'activity') throw new Error('Use the workout checklist to complete gym training.');
        if (entry.date > today) throw new Error('A future activity cannot be recorded as completed.');
        schedule.entries.find(value => value.id === entry.id).status = 'completed';
    } else throw new Error('Unknown calendar action.');
    const backfilled = intent.type === 'recordGym' || (['add', 'move'].includes(intent.type) && intent.performed && intent.date < today);
    if (backfilled) {
        const pending = gymEntries(schedule).filter(entry => !isProtected(entry));
        // The user explicitly requested recalculation, including bringing planned
        // sessions forward. Actual history and non-gym appointments stay fixed.
        for (const entry of pending) entry.date = today;
        placeGyms(schedule, today, { newIds: new Set(pending.map(entry => entry.id)), strict: true });
    } else {
        placeGyms(schedule, today, { exactId, exactDate, strict: true });
    }
    return { schedule, recordedGym, restartedCycleId, removedGym, removedRecord, correctedGym, changes: entryDiff(before, schedule, context), warnings: [...notices, ...warningsFor(schedule, context)] };
}

/** Suggestions respect gym dates. Selecting a run explicitly is a separate user action. */
export function suggestedRunDate(schedule, context) {
    const last = schedule.entries.filter(entry => entry.kind === 'run' && entry.status === 'completed').sort((a, b) => a.date.localeCompare(b.date)).at(-1);
    if (!last) return null;
    if (schedule.entries.some(entry => entry.kind === 'run' && entry.status === 'planned' && entry.date >= context.today)) return null;
    const first = latest(addDays(last.date, 7), context.today);
    let date = first;
    for (let offset = 0; offset <= MAX_FORWARD_DAYS; offset++, date = addDays(date, 1)) {
        if (!officeOn(schedule, date) && !schedule.entries.some(entry => entry.date === date)) return date;
    }
    return null;
}
