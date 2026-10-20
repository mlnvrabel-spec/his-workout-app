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
ui.preview = intent => reviews.push(intent);
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
    assert.deepEqual(reviews, [{ type: 'move', id: 'c1:0', date: '2026-11-04' }], 'Drop requests a preview, not a direct save');
    assert.equal(captured, false);
    assert.equal(ui.suppressClick, true);

    pointer('pointerdown'); hold(); pointer('pointermove', 350); ui.dragTick();
    assert.match(ui.dropError, /Office/);
    assert.equal(days[1].classList.contains('is-drop-invalid'), true, 'Invalid date is visible before release');
    pointer('pointerup', 350);
    assert.equal(reviews.length, 1, 'Invalid drop never reaches Apply');
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
    assert.match(normal, /data-agenda-action="move"/);
    assert.match(normal, /aria-label="Move Push A/);
    const fixed = ui.entryHTML({ ...entry, movable: false, status: 'started', movableReason: 'Workout has started' });
    assert.doesNotMatch(fixed, /data-agenda-action="move"/);
    assert.match(fixed, /Workout has started/);
    const hostileTitle = ui.entryHTML({ ...entry, title: '<img src=x onerror=alert(1)>' });
    assert.doesNotMatch(hostileTitle, /<img/);
    assert.match(hostileTitle, /&lt;img/);
    assert.doesNotMatch(ui.entryHTML({ ...entry, cycleId: 'next' }), /data-agenda-action="open"/, 'Future cycles cannot open the current cycle by mistake');
    assert.match(ui.entryHTML({ ...entry, kind: 'run', date: '2026-11-02' }), /data-agenda-action="record"/);
    assert.doesNotMatch(ui.entryHTML({ ...entry, kind: 'run', date: '2026-11-06' }), /data-agenda-action="record"/);
    let focused = false;
    const replacement = { dataset: { agendaAction: 'add', date: '2026-11-02' }, focus() { focused = true; } };
    ui.modal = { previousFocus: { dataset: replacement.dataset }, close() {} };
    element.querySelectorAll = () => [replacement];
    ui.closeDialog();
    assert.equal(focused, true, 'Focus returns even after the engine replaces the originating row');
    const calendar = Object.create(TrainingAgenda.prototype);
    calendar.element = { contains: () => false, querySelectorAll: () => [], querySelector: () => ({ scrollIntoView() {} }) };
    calendar.daysBefore = 2; calendar.daysAfter = 9;
    calendar.engine = { getScheduleView: () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry] }) };
    calendar.render();
    assert.match(calendar.element.innerHTML, /Today ·[^<]+<\/p><h2>Push A/);
    const office = { id: 'office-1', kind: 'office', title: 'Office', date: '2026-11-03', recurring: true, movable: false, movableReason: 'Past calendar constraints stay in history.' };
    calendar.engine.getScheduleView = () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry, office] });
    calendar.render();
    assert.match(calendar.element.innerHTML, /agenda-items is-grouped/);
    assert.equal((calendar.element.innerHTML.match(/<article[^>]*data-entry-id="office-1"/g) || []).length, 1, 'One office occurrence stays under its existing date');
    const contextOffice = calendar.entryHTML(office, false, true);
    assert.match(contextOffice, /agenda-entry--context/);
    assert.doesNotMatch(contextOffice, /Weekly office day|agenda-fixed|<p>/, 'Shared-date context does not repeat the full office card');
    assert.match(calendar.entryHTML({ ...office, movable: true }, false, true), /aria-label="Move Office/, 'Compact context keeps the tap-based movement action');
    calendar.engine.getScheduleView = () => ({ today: '2026-11-03', currentCycleId: 'c1', currentDay: 0, entries: [entry] });
    const select = { dataset: { agendaAction: 'select', date: '2026-11-04' } };
    await calendar.onClick({ target: { closest: () => select } });
    assert.match(calendar.element.innerHTML, /Selected day ·[^<]+<\/p><h2>Rest/);
    assert.match(calendar.element.innerHTML, /data-agenda-action="add" data-date="2026-11-04"/);
    assert.doesNotMatch(calendar.element.innerHTML, /agenda-primary" data-agenda-action="open"/);
    assert.match(calendar.element.innerHTML, /aria-label="Select [^"]+" aria-pressed="true"/);
    await calendar.onClick({ target: { closest: () => ({ dataset: { agendaAction: 'today' } }) } });
    assert.equal(calendar.selectedDate, '2026-11-03');
    assert.match(calendar.element.innerHTML, /Today ·[^<]+<\/p><h2>Push A/);
    console.log('Agenda pointer lifecycle, pre-drop conflicts, accessible controls, escaping and focus: OK');
} finally { globalThis.setTimeout = realTimeout; globalThis.clearTimeout = realClear; }
