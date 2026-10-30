import assert from 'node:assert/strict';
import { TrainingAgenda } from './src/ui/TrainingAgenda.js';

const realTimeout = globalThis.setTimeout, realClear = globalThis.clearTimeout;
const timers = new Map();
let timerId = 0;
globalThis.setTimeout = fn => { timers.set(++timerId, fn); return timerId; };
globalThis.clearTimeout = id => timers.delete(id);
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
globalThis.window = new EventTarget();
window.matchMedia = () => ({ matches: false });
globalThis.document = new EventTarget();
const app = { scrollTop: 0, getBoundingClientRect: () => ({ top: 0, bottom: 800 }) };
document.getElementById = () => app;
const classes = () => {
    const values = new Set();
    return { add: (...names) => names.forEach(name => values.add(name)), remove: (...names) => names.forEach(name => values.delete(name)),
        toggle: (name, set) => set ? values.add(name) : values.delete(name), contains: name => values.has(name) };
};
const row = (date, top, bottom) => ({ dataset: { date }, classList: classes(), getBoundingClientRect: () => ({ top, bottom, left: 0, right: 400 }) });
const days = [row('2026-11-04', 200, 300), row('2026-11-05', 300, 400)];
let captured = false, embeddedControl = false, movable = true;
const card = { dataset: { entryId: 'c1:0' }, classList: classes(), setPointerCapture() { captured = true; },
    hasPointerCapture: () => captured, releasePointerCapture() { captured = false; } };
const target = { closest: selector => selector.startsWith('.agenda-entry') ? (movable ? card : null) : embeddedControl ? {} : null };
const element = new EventTarget();
element.querySelectorAll = selector => selector === '.agenda-day' ? days : [card, ...days];
const entry = { id: 'c1:0', cycleId: 'c1', day: 0, kind: 'gym', title: 'Push A', date: '2026-11-03', status: 'planned', movable: true };
const ui = Object.create(TrainingAgenda.prototype);
ui.element = element;
ui.view = { today: '2026-11-03', currentCycleId: 'c1', entries: [entry] };
const proposals = [], reviews = [], notices = [];
ui.engine = { pending: false, previewSchedule(intent) { proposals.push(intent); if (intent.date === '2026-11-05') throw new Error('Office occupies this date.'); return {}; } };
ui.commitChange = intent => reviews.push(intent);
ui.announce = text => notices.push(text);
ui.attachDrag();
function pointer(type, y = 100, x = 20) {
    const event = new Event(type, { cancelable: true });
    Object.defineProperty(event, 'target', { value: target });
    Object.assign(event, { button: 0, pointerId: 1, isPrimary: true, clientX: x, clientY: y });
    element.dispatchEvent(event);
    return event;
}
const hold = () => { const fn = timers.get(ui.holdTimer); timers.delete(ui.holdTimer); fn?.(); };
try {
    pointer('pointerdown');
    assert.equal(captured, false, 'Native scrolling stays available before pickup');
    pointer('pointermove', 120);
    hold();
    assert.equal(ui.drag, null, 'Movement before the hold cancels pickup');
    assert.equal(reviews.length, 0);

    embeddedControl = true; pointer('pointerdown'); assert.equal(ui.drag, null, 'Buttons keep normal behavior'); embeddedControl = false;
    movable = false; pointer('pointerdown'); assert.equal(ui.drag, null, 'Protected entries cannot start a drag'); movable = true;
    pointer('pointerdown'); hold();
    assert.equal(captured, true);
    assert.equal(card.classList.contains('is-moving'), true);
    const touch = new Event('touchmove', { cancelable: true }); element.dispatchEvent(touch);
    assert.equal(touch.defaultPrevented, true);
    pointer('pointermove', 250); ui.dragTick();
    assert.equal(ui.dropDate, '2026-11-04');
    assert.equal(days[0].classList.contains('is-drop-target'), true);
    pointer('pointerup', 250);
    assert.deepEqual(reviews, [{ type: 'move', id: 'c1:0', date: '2026-11-04' }], 'Drop requests one direct calendar save');
    assert.equal(captured, false);
    assert.equal(ui.suppressClick, true);

    pointer('pointerdown'); hold(); pointer('pointermove', 350); ui.dragTick();
    assert.match(ui.dropError, /Office/);
    assert.equal(days[1].classList.contains('is-drop-invalid'), true, 'Invalid date is visible before release');
    pointer('pointerup', 350);
    assert.equal(reviews.length, 1, 'Invalid drop never reaches the save');
    assert.match(notices.at(-1), /Office/);
    for (const cancel of ['pointercancel', 'lostpointercapture']) {
        pointer('pointerdown'); hold(); pointer(cancel);
        assert.equal(ui.drag, null);
    }
    pointer('pointerdown'); hold();
    const escape = new Event('keydown'); Object.assign(escape, { key: 'Escape' }); document.dispatchEvent(escape);
    assert.equal(ui.drag, null);
    pointer('pointerdown'); hold(); window.dispatchEvent(new Event('blur')); assert.equal(ui.drag, null);
    pointer('pointerdown'); document.dispatchEvent(new Event('scroll')); hold(); assert.equal(ui.drag, null);

    const normal = ui.entryHTML(entry);
    assert.match(normal, /<button[^>]+data-agenda-action="details"/);
    assert.match(normal, /aria-label="Push A/);
    assert.doesNotMatch(normal, />Planned<|>Open<|>Move<|>Fixed</);
    const fixed = ui.entryHTML({ ...entry, movable: false, status: 'started', movableReason: 'Workout has started' });
    assert.match(fixed, /data-agenda-action="details"/);
    assert.match(fixed, /Workout has started/);
    const hostileTitle = ui.entryHTML({ ...entry, title: '<img src=x onerror=alert(1)>' });
    assert.doesNotMatch(hostileTitle, /<img/);
    assert.match(hostileTitle, /&lt;img/);
    assert.doesNotMatch(ui.entryHTML({ ...entry, cycleId: 'next' }), /data-agenda-action="open"/, 'Future cycles cannot open the current cycle by mistake');
    assert.match(ui.entryHTML({ ...entry, kind: 'run', date: '2026-11-02' }), /data-agenda-action="details"/);
    assert.doesNotMatch(ui.entryHTML({ ...entry, kind: 'run', date: '2026-11-06' }), /data-agenda-action="record"/);
    let focused = false;
    const replacement = { dataset: { agendaAction: 'add', date: '2026-11-02' }, focus() { focused = true; } };
    ui.modal = { previousFocus: { dataset: replacement.dataset }, close() {} };
    element.querySelectorAll = () => [replacement];
    ui.closeDialog();
    assert.equal(focused, true, 'Focus returns even after the engine replaces the originating row');
    focused = false;
    ui.modal.previousFocus.dataset = { agendaAction: 'rest-options', date: '2026-11-02' };
    element.querySelectorAll = () => [{ dataset: { agendaAction: 'add', date: '2026-11-01' }, focus() { throw new Error('Focus must stay on the saved Rest date'); } }, replacement];
    ui.closeDialog();
    assert.equal(focused, true, 'Saving an available-day Rest returns focus to the same date');
    const calendar = Object.create(TrainingAgenda.prototype);
    calendar.element = { contains: () => false, querySelectorAll: () => [], querySelector: () => ({ scrollIntoView() {} }) };
    calendar.daysBefore = 2; calendar.daysAfter = 9;
    calendar.engine = { getScheduleView: () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry] }) };
    calendar.render();
    assert.match(calendar.element.innerHTML, /aria-label="Push A ·/);
    assert.doesNotMatch(calendar.element.innerHTML, /agenda-today|agenda-add|>Nothing recorded</);
    assert.equal((calendar.element.innerHTML.match(/data-agenda-action="add" data-date="2026-11-03"/g) || []).length, 1, 'The date has one Add action');
    assert.doesNotMatch(calendar.element.innerHTML, /data-agenda-action="undo"/, 'Unavailable Undo does not occupy the toolbar');
    const office = { id: 'office-1', kind: 'rest', title: 'REST', date: '2026-11-03', recurring: true, movable: false, movableReason: 'Past calendar constraints stay in history.' };
    calendar.engine.getScheduleView = () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry, office] });
    calendar.render();
    assert.match(calendar.element.innerHTML, /agenda-items is-grouped/);
    assert.equal((calendar.element.innerHTML.match(/<button[^>]*data-entry-id="office-1"/g) || []).length, 1, 'One office occurrence stays under its existing date');
    const contextOffice = calendar.entryHTML(office, false, true);
    assert.match(contextOffice, /agenda-entry--context/);
    assert.doesNotMatch(contextOffice, /agenda-fixed|<p>/, 'Shared-date context does not repeat the full office card');
    assert.match(calendar.entryHTML({ ...office, movable: true }, false, true), /data-agenda-action="details"/, 'Compact context keeps its accessible editing entry point');
    let opened;
    calendar.entryDialog = value => { opened = value; };
    await calendar.onClick({ target: { closest: () => ({ dataset: { agendaAction: 'details', entryId: 'c1:0' } }) } });
    assert.equal(opened.id, entry.id, 'Tapping the item opens its own details');
    calendar.engine.getScheduleView = () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry] });
    const select = { dataset: { agendaAction: 'select', date: '2026-11-04' } };
    await calendar.onClick({ target: { closest: () => select } });
    assert.equal(calendar.selectedDate, '2026-11-04');
    assert.match(calendar.element.innerHTML, />Rest</);
    calendar.engine.getScheduleView = () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry], restExceptions: ['2026-11-04'] });
    calendar.render();
    assert.match(calendar.element.innerHTML, /agenda-empty">Available</, 'A deleted recurring REST is visibly free');
    assert.match(calendar.element.innerHTML, /data-agenda-action="add" data-date="2026-11-04"/);
    assert.doesNotMatch(calendar.element.innerHTML, /agenda-primary" data-agenda-action="open"/);
    assert.match(calendar.element.innerHTML, /aria-label="Select [^"]+" aria-pressed="true"/);
    await calendar.onClick({ target: { closest: () => ({ dataset: { agendaAction: 'today' } }) } });
    assert.equal(calendar.selectedDate, '2026-11-03');
    assert.match(calendar.element.innerHTML, /aria-label="Push A ·/);
    const averages = [2, 4].map(weeks => ({ weeks, gym: { count: 7, perWeek: 7 / weeks }, run: { count: 1, perWeek: 1 / weeks } }));
    calendar.engine.getScheduleView = () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry], averages, canUndo: true });
    calendar.render();
    assert.match(calendar.element.innerHTML, /<section class="agenda-averages"/);
    assert.match(calendar.element.innerHTML, /data-agenda-action="undo"/);
    assert.doesNotMatch(calendar.element.innerHTML, /<details|<summary/);
    assert.match(calendar.element.innerHTML, />3.5<.*>1.8</s);
    // PRODUCT_SPEC §8.1: earlier dates can expand repeatedly and return to the recent range.
    const range = Object.create(TrainingAgenda.prototype);
    const rangeButtons = Object.fromEntries(['earlier', 'hide-earlier'].map(action => [action, {
        dataset: { agendaAction: action }, focus() { document.activeElement = this; }
    }]));
    range.element = {
        contains: button => Object.values(rangeButtons).includes(button),
        querySelectorAll: () => Object.values(rangeButtons).filter(button => range.element.innerHTML.includes(`data-agenda-action="${button.dataset.agendaAction}"`)),
        querySelector: () => rangeButtons.earlier
    };
    range.daysBefore = 2; range.daysAfter = 9;
    const requestedRanges = [];
    const savedSchedule = { today: '2026-11-03', entries: [entry], currentCycleId: 'c1' };
    range.engine = { getScheduleView: since => { requestedRanges.push(since); return structuredClone(savedSchedule); } };
    const rangeClick = action => range.onClick({ target: { closest: () => rangeButtons[action] } });
    const visibleDays = () => (range.element.innerHTML.match(/<section class="agenda-day /g) || []).length;
    range.render();
    assert.equal(visibleDays(), 12);
    assert.match(range.element.innerHTML, /data-agenda-action="earlier"[^>]*aria-expanded="false"/);
    assert.doesNotMatch(range.element.innerHTML, /data-agenda-action="hide-earlier"/);
    document.activeElement = rangeButtons.earlier;
    await rangeClick('earlier');
    assert.equal(visibleDays(), 19);
    assert.equal(requestedRanges.at(-1), '2026-10-25', 'Earlier recurrence is requested from the engine');
    assert.match(range.element.innerHTML, /data-agenda-action="hide-earlier"[^>]*>Hide earlier days</);
    assert.match(range.element.innerHTML, /data-agenda-action="earlier"[^>]*aria-expanded="true"/);
    assert.equal(document.activeElement, rangeButtons.earlier, 'Expansion retains keyboard focus');
    await rangeClick('earlier');
    assert.equal(visibleDays(), 26, 'Existing incremental access to older weeks is preserved');
    range.selectedDate = '2026-10-20';
    range.daysAfter = 16;
    range.show();
    assert.equal(range.daysBefore, 16, 'Navigation and state rerenders preserve the expanded range');
    document.activeElement = rangeButtons['hide-earlier'];
    await rangeClick('hide-earlier');
    assert.equal(visibleDays(), 19);
    assert.equal(range.daysBefore, 2);
    assert.equal(range.daysAfter, 16, 'Collapsing history preserves future expansion');
    assert.equal(range.selectedDate, savedSchedule.today, 'A hidden selection returns to today');
    assert.equal(requestedRanges.at(-1), '2026-11-01');
    assert.equal(document.activeElement, rangeButtons.earlier, 'Focus returns to the remaining range control');
    assert.doesNotMatch(range.element.innerHTML, /data-agenda-action="hide-earlier"/);
    await rangeClick('earlier');
    range.selectedDate = '2026-11-02';
    await rangeClick('hide-earlier');
    assert.equal(range.selectedDate, '2026-11-02', 'A still-visible selected date is preserved');
    assert.deepEqual(savedSchedule, { today: '2026-11-03', entries: [entry], currentCycleId: 'c1' }, 'Range controls only project the saved schedule');
    delete document.activeElement;
    // All Rest rows share the entry title, while details distinguish available/manual/recurring days.
    calendar.view = { today: '2026-11-03', entries: [] };
    const emptyRest = calendar.emptyDayHTML('2026-11-03', calendar.view.today);
    assert.match(emptyRest, /class="agenda-entry agenda-entry--rest"/);
    assert.match(emptyRest, /class="agenda-entry-title">Rest</);
    assert.match(emptyRest, /data-agenda-action="rest-options"/);
    assert.match(emptyRest, /Available day, no saved Rest/);
    assert.doesNotMatch(calendar.emptyDayHTML('2026-11-02', calendar.view.today), /rest-options|agenda-entry-title/);
    const restUI = Object.create(TrainingAgenda.prototype);
    const restHandlers = {};
    let restBody, restIntent, recurringOpened = false;
    restUI.dialogHTML = (title, body) => { assert.equal(title, 'Rest'); restBody = body; };
    restUI.dialog = { querySelector: selector => ({ addEventListener(type, callback) { restHandlers[selector] = callback; } }) };
    restUI.commitChange = intent => { restIntent = intent; };
    restUI.officeDialog = () => { recurringOpened = true; };
    restUI.restOptionsDialog('2026-11-03');
    assert.equal(restIntent, undefined, 'Opening an available day never saves a Rest record');
    assert.match(restBody, /This day is available/);
    restHandlers['[data-agenda-save-rest]']();
    assert.deepEqual(restIntent, { type: 'add', kind: 'rest', date: '2026-11-03' });
    restHandlers['[data-agenda-recurring]']();
    assert.equal(recurringOpened, true);
    restUI.engine = {};
    restUI.view = { today: '2026-11-03' };
    restUI.dialog = { querySelector: () => null };
    restUI.entryDialog({ kind: 'rest', date: '2026-11-03', status: 'planned', recurring: true });
    assert.match(restBody, /Recurring Rest\. Repeats weekly/);
    restUI.entryDialog({ kind: 'rest', date: '2026-11-03', status: 'planned' });
    assert.match(restBody, /Manual Rest\. Reserved for this date only/);
    assert.doesNotMatch(restBody, /Repeats weekly/);

    // The form submits the user's workout selection, never the planned entry ID.
    const form = new EventTarget();
    const fields = { activity: {}, gym: {}, help: {}, submit: {}, error: {} };
    form.elements = { kind: { value: '' }, workoutDay: { value: '' }, date: { value: '2026-11-02' }, title: { value: '' }, demanding: { checked: false } };
    form.querySelector = selector => selector === '.agenda-activity-fields' ? fields.activity : selector === '.agenda-gym-fields' ? fields.gym : fields.help;
    const add = Object.create(TrainingAgenda.prototype);
    add.view = { today: '2026-11-03', currentCycleId: 'c1', entries: [entry], workouts: ['Push A', 'Pull A', 'Push B', 'Pull B'].map((title, day, titles) => ({ day, title, nextTitle: titles[(day + 1) % 4] })) };
    let dialogBody, selectedIntent;
    add.dialogHTML = (title, body) => { dialogBody = body; };
    add.dialog = { querySelector: selector => selector === 'form' ? form : selector === '.agenda-dialog-error' ? fields.error : fields.submit };
    add.commitChange = intent => { selectedIntent = intent; };
    add.saveWorkout = intent => { selectedIntent = intent; };
    add.addDialog('2026-11-02');
    assert.match(dialogBody, /Workout performed/);
    assert.equal(form.elements.workoutDay.value, '', 'An actual workout requires an explicit choice');
    assert.equal(fields.gym.hidden, false);
    assert.equal(fields.submit.textContent, 'Save workout');
    form.elements.workoutDay.value = '3';
    form.dispatchEvent(new Event('change'));
    assert.match(fields.help.textContent, /future split recalculates.*Pull B.*Undo/);
    add.commitChange = () => { throw new Error('Backfilling must not open a second screen'); };
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    assert.deepEqual(selectedIntent, { type: 'recordGym', day: 3, date: '2026-11-02' });
    add.commitChange = intent => { selectedIntent = intent; };
    form.elements.kind.value = 'run';
    form.dispatchEvent(new Event('change'));
    assert.equal(fields.gym.hidden, true);
    assert.equal(form.elements.workoutDay.disabled, true, 'Hidden workout selection cannot block other activities');
    assert.equal(fields.submit.textContent, 'Record activity', 'Past activities explicitly record without another confirmation');
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    assert.equal(selectedIntent.kind, 'run');

    // One save validates and commits atomically; failed writes remain in the form.
    delete add.saveWorkout;
    let commitCount = 0, closeCount = 0, renderCount = 0, resolveSave, announcement;
    const intent = { type: 'recordGym', day: 3, date: '2026-11-02' };
    const proposal = { intent, token: 'validated' };
    add.engine = { state: {}, previewSchedule(value) { assert.deepEqual(value, intent); return proposal; },
        applySchedule(value) { assert.equal(value, proposal); commitCount++; return new Promise(resolve => { resolveSave = resolve; }); } };
    add.closeDialog = () => closeCount++;
    add.render = () => renderCount++;
    add.announce = value => { announcement = value; };
    const saving = add.saveWorkout(intent, fields.submit);
    assert.equal(fields.submit.disabled, true);
    await add.saveWorkout(intent, fields.submit);
    assert.equal(commitCount, 1, 'Repeated submits cannot create duplicate records');
    resolveSave(false);
    await saving;
    assert.equal(closeCount, 0);
    assert.equal(fields.submit.disabled, false);
    assert.match(fields.error.textContent, /could not be saved/);
    assert.equal(form.elements.workoutDay.value, '3', 'Failed saving retains the workout selection');
    add.engine.previewSchedule = () => { throw new Error('This date already has recorded training.'); };
    await add.saveWorkout(intent, fields.submit);
    assert.match(fields.error.textContent, /already has recorded/);
    assert.equal(commitCount, 1, 'Validation errors never attempt a write');
    add.engine.previewSchedule = () => proposal;
    const retry = add.saveWorkout(intent, fields.submit);
    resolveSave(true);
    await retry;
    assert.equal(closeCount, 1);
    assert.equal(renderCount, 1);
    assert.match(announcement, /Workout saved.*Undo/);

    // A date collision asks once; cancellation preserves the Add form and history.
    const duplicate = Object.create(TrainingAgenda.prototype);
    duplicate.view = add.view;
    const duplicateError = {}, duplicateButton = {};
    duplicate.dialog = { querySelector: () => duplicateError };
    duplicate.closeDialog = () => {};
    duplicate.render = () => {};
    duplicate.announce = value => { announcement = value; };
    let replacementWrites = 0, prompts = 0, acceptReplacement = false;
    const collision = Object.assign(new Error('A workout is already recorded on this date.'), {
        code: 'WORKOUT_EXISTS', replaceable: true, entry: { id: 'old:0', title: 'Push A', date: intent.date }
    });
    duplicate.engine = {
        previewSchedule(value) {
            if (!value.replaceId) throw collision;
            assert.deepEqual(value, { ...intent, replaceId: 'old:0' });
            return { intent: value };
        },
        async applySchedule() { replacementWrites++; return true; }
    };
    window.confirm = message => {
        prompts++;
        assert.match(message, /Push A is already recorded on .*Replace it with Pull B\?/);
        return acceptReplacement;
    };
    await duplicate.saveWorkout(intent, duplicateButton);
    assert.equal(prompts, 1);
    assert.equal(replacementWrites, 0);
    assert.equal(duplicateButton.disabled, false);
    assert.equal(form.elements.workoutDay.value, '3');
    acceptReplacement = true;
    await duplicate.saveWorkout(intent, duplicateButton);
    assert.equal(prompts, 2);
    assert.equal(replacementWrites, 1);
    assert.match(announcement, /Workout replaced.*Undo/);
    duplicateButton.disabled = false;
    collision.replaceable = false;
    await duplicate.saveWorkout(intent, duplicateButton);
    assert.equal(prompts, 2, 'Saved training cannot be replaced through confirmation');
    assert.equal(replacementWrites, 1);
    assert.match(duplicateError.textContent, /already recorded/);
    delete window.confirm;

    delete add.commitChange;
    fields.submit.disabled = false;
    const directEdit = { type: 'remove', id: 'office:2026-11-05' };
    add.engine = { pending: false, state: {}, previewSchedule(value) { assert.deepEqual(value, directEdit); return { intent: value, changes: [{ kind: 'gym', action: 'moved', title: 'Push A', to: '2026-11-05' }] }; },
        async applySchedule() { commitCount++; return true; } };
    await add.commitChange(directEdit);
    assert.equal(commitCount, 3, 'A calendar edit commits directly from its existing action');
    assert.equal(closeCount, 2, 'No review dialog replaces the existing edit form');
    assert.match(announcement, /Push A moved to.*Undo|Undo.*Push A moved to/, 'The saved result describes changed workout dates');
    // Manual past entries expose correction rather than the protected-session dialog.
    const record = Object.create(TrainingAgenda.prototype);
    const recordForm = new EventTarget(), removeRecord = new EventTarget(), saveRecord = {};
    recordForm.elements = { workoutDay: { value: '2' } };
    record.view = add.view;
    let recordBody, recordFooter, recordIntent;
    record.dialogHTML = (title, body, footer) => { recordBody = body; recordFooter = footer; };
    record.dialog = { querySelector: selector => selector === 'form' ? recordForm : selector === '.agenda-remove' ? removeRecord : saveRecord };
    record.saveChange = intent => { recordIntent = intent; };
    record.entryDialog({ ...entry, date: '2026-11-02', status: 'completed', movable: false, correctable: true });
    assert.match(recordBody, /Workout performed/);
    assert.match(recordBody, /Unstarted future workouts will follow the corrected record/);
    assert.match(recordFooter, />Delete</);
    assert.doesNotMatch(recordFooter, /Open workout|Save date/);
    recordForm.dispatchEvent(new Event('submit', { cancelable: true }));
    assert.deepEqual(recordIntent, { type: 'correctGym', id: entry.id, day: 2 });
    removeRecord.dispatchEvent(new Event('click'));
    assert.deepEqual(recordIntent, { type: 'removeGymRecord', id: entry.id });
    console.log('Agenda pointer lifecycle, pre-drop conflicts, accessible controls, escaping and focus: OK');
} finally { globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClear; }
