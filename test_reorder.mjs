import assert from 'node:assert/strict';
import { environment, engine, protocol } from './test_helpers.mjs';
import { arrangeExercises, sequenceConflict } from './src/core/ExerciseOrder.js';
import { ExerciseReorder } from './src/ui/ExerciseReorder.js';
import { Kai } from './src/ui/Kai.js';

const chest = { primary: 'chest', muscles: ['chest', 'triceps'] };
const legs = { primary: 'quads', muscles: ['quads'] };
assert.deepEqual(arrangeExercises([0, 1, 2], 2, 0, new Set(), [chest, legs, chest]), [2, 1, 0]);
assert.deepEqual(arrangeExercises([0, 1, 2, 3], 2, 1, new Set(), [chest, legs, chest, legs]), [1, 2, 3, 0], 'Separation takes precedence over an unmoved priority opener');
assert.ok(sequenceConflict(chest, { primary: 'shoulders', muscles: ['shoulders', 'triceps'] }) > 0);
assert.equal(arrangeExercises([0, 1, 2], 2, 1, new Set([1]), [chest, legs, chest]), null);
assert.deepEqual(arrangeExercises([0, 1, 2], 2, 0, new Set(), [chest, chest, chest]), [2, 0, 1]);
for (const ex of Object.values(protocol.exercise_library)) {
    assert.ok(ex.sequencing.muscles.includes(ex.sequencing.primary));
}
environment();
let a = await engine();
const original = a.getExerciseOrder(0);
await a.logSet(a.protocolData[0].exercises[0]._exerciseId, 20, 8, 8);
await a.swapExercise(0, 1, 'LEG_PRESS');
assert.equal(await a.reorderExercise(0, 2, 0), true);
const changed = a.getExerciseOrder(0);
assert.equal(changed[0], 2);
assert.notEqual(changed[1], 0, 'Chest exercises stay separated');
assert.equal(a.protocolData[0].exercises[1]._exerciseId, 'LEG_PRESS');
assert.equal(a.getExerciseLogs(a.protocolData[0].exercises[0]._exerciseId).length, 1);
a = await engine();
assert.deepEqual(a.getExerciseOrder(0), changed, 'Reload retains order');
assert.equal(await a.undoExerciseOrder(0), true);
assert.deepEqual(a.getExerciseOrder(0), original);
assert.equal(await a.reorderExercise(0, 2, 0), true);
await a.toggleComplete('ex-0-1', 0);
const lockedPosition = a.getExerciseOrder(0).indexOf(1);
assert.equal(await a.reorderExercise(0, 1, 0), false);
assert.equal(await a.reorderExercise(0, 4, lockedPosition), false);
assert.equal(await a.reorderExercise(0, 4, 0), true);
assert.equal(a.getExerciseOrder(0).indexOf(1), lockedPosition);
assert.equal(a.state.done[0]['ex-0-1'], true);
const b = await engine();
await b.toggleComplete('ex-0-3', 0);
await a.reorderExercise(0, 5, 0);
assert.equal(a.state.done[0]['ex-0-3'], true, 'Concurrent checks survive');
const actual = a.getExerciseOrder(0);
await a.finishSession();
assert.deepEqual(a.getDaySummary(0).order, actual);
assert.equal(await a.reorderExercise(0, 2, 0), false);
await a.reopenLastDay();
assert.deepEqual(a.getExerciseOrder(0), actual);
for (let day = 0; day < 4; day++) { await a.setDay(day); await a.finishSession(); }
assert.deepEqual(a.getExerciseOrder(0), original, 'New cycle restores prescribed order');
await a.reopenLastDay();
assert.deepEqual(a.getExerciseOrder(0), actual, 'Cycle undo restores prior session orders');
environment(); a = await engine();
const mutate = a.storage.mutateWorkout.bind(a.storage);
a.storage.mutateWorkout = reducer => mutate((...args) => { reducer(...args); throw new Error('Injected reorder failure'); });
assert.equal(await a.reorderExercise(0, 2, 0), false);
assert.deepEqual(a.getExerciseOrder(0), original, 'Failed save leaves order intact');
assert.equal(await a.reorderExercise(0, 2, NaN), false);
// Bug Hub #14 / PRODUCT_SPEC §§3.1, 7: partial and counted sessions remain reorderable today.
environment(); a = await engine();
await a.logSet(a.protocolData[0].exercises[0]._exerciseId, 20, 8);
await a.finishSession();
const priorHistory = structuredClone(a.getDaySummary(0));
await a.setDay(1);
const pullOrder = a.getExerciseOrder(1);
await a.logSet(a.protocolData[1].exercises[0]._exerciseId, 40, 8);
await a.logSet(a.protocolData[1].exercises[5]._exerciseId, 12, 10);
const sortedLogs = () => structuredClone(a.logs).sort((left, right) => `${left.session_id}:${left.exercise_id}`.localeCompare(`${right.session_id}:${right.exercise_id}`));
const savedSets = sortedLogs();
for (const slot of [0, 1, 2]) {
    await a.toggleComplete(`ex-1-${slot}`, 1);
    assert.equal(a.isDayCompleted(1), slot === 2, 'Only the third of six checks counts Pull A');
    assert.equal(a.isDaySealed(1), false, 'Counting is not sealing');
    const checks = structuredClone(a.state.done);
    assert.equal(await a.reorderExercise(1, 5, 3), true, `Unfinished move after ${slot + 1} checks`);
    assert.deepEqual(a.getExerciseOrder(1).slice(0, slot + 1), pullOrder.slice(0, slot + 1), 'Checked positions stay fixed');
    assert.deepEqual(a.state.done, checks, 'Reordering retains every check');
    assert.deepEqual(sortedLogs(), savedSets, 'Reordering retains checked and unfinished exercise sets');
    assert.deepEqual(a.getDaySummary(0), priorHistory, 'Earlier history stays unchanged');
    if (slot === 2) {
        assert.equal(a.getDaySummary(1).completedExercises, 3);
        assert.deepEqual(a.getDaySummary(1).order, a.getExerciseOrder(1), 'Counted history tracks the new order');
        const reordered = a.getExerciseOrder(1);
        a = await engine();
        assert.deepEqual(a.getExerciseOrder(1), reordered, 'Counted session order survives reload');
        assert.deepEqual(a.state.done, checks);
        assert.deepEqual(sortedLogs(), savedSets);
        assert.equal(a.isDaySealed(1), false);
    }
    assert.equal(await a.undoExerciseOrder(1), true);
    assert.deepEqual(a.getExerciseOrder(1), pullOrder);
}
assert.equal(await a.reorderExercise(1, 0, 4), false, 'A checked exercise remains fixed');
assert.equal(await a.reorderExercise(1, 5, 1), false, 'A checked destination remains protected');
await a.toggleComplete('ex-1-2', 1);
assert.equal(a.isDayCompleted(1), false);
assert.equal(await a.reorderExercise(1, 5, 3), true, 'Dropping below 50% retains ordering access');
assert.deepEqual(sortedLogs(), savedSets);
assert.deepEqual(a.getDaySummary(0), priorHistory);
// Exercise the actual pointer boundary, including hold, drop and cancellation.
const realTimer = globalThis.setTimeout;
let held;
globalThis.setTimeout = callback => { held = callback; return 1; };
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
const surface = new EventTarget();
surface.querySelectorAll = () => [];
surface.querySelector = () => null;
let captured = false;
let checked = false;
const card = { dataset: { idx: '2' }, classList: { add() {}, contains: () => checked }, getBoundingClientRect: () => ({ bottom: 200 }) };
surface.querySelectorAll = selector => selector === '.card-wrapper' ? [card] : [];
const cardSurface = { style: {}, closest: () => card, setPointerCapture() { captured = true; }, hasPointerCapture() { return captured; }, releasePointerCapture() { captured = false; } };
let control = null;
const target = { closest: selector => selector === '.card' ? cardSurface : selector === '.reorder-handle' ? null : control };
const calls = [];
const stubEngine = { state: { day: 0 }, cycleId: 'test-cycle', reorderExercise: async (...args) => { calls.push(args); return true; } };
const gestures = new ExerciseReorder(surface, stubEngine, () => {});
function pointer(type, y, x = 20) {
    const event = new Event(type);
    Object.assign(event, { button: 0, pointerId: 1, clientX: x, clientY: y });
    Object.defineProperty(event, 'target', { value: target });
    surface.dispatchEvent(event);
}
pointer('pointerdown', 100);
assert.ok(gestures.drag, 'Holding the card body must start pickup without a handle');
assert.equal(captured, false, 'A short tap must retain its original target');
held();
assert.equal(gestures.drag.active, true);
gestures.destination = 0;
pointer('pointermove', 50); pointer('pointerup', 50);
await Promise.resolve();
assert.deepEqual(calls, [[0, 2, 0]]);
assert.equal(captured, false);
pointer('pointerdown', 100); pointer('pointermove', 120);
assert.equal(gestures.drag, null, 'Movement before the hold cancels pickup');
pointer('pointerdown', 100); held(); pointer('pointercancel', 100);
assert.equal(gestures.drag, null);
assert.equal(calls.length, 1, 'Cancellation does not save a move');
pointer('pointerdown', 100); pointer('pointermove', 100, 40);
assert.equal(gestures.drag, null, 'Horizontal swipe before pickup cancels reorder');
for (const name of ['input', 'textarea', 'select', 'a', 'check', 'save', 'move']) {
    control = { matches: () => false };
    pointer('pointerdown', 100);
    assert.equal(gestures.drag, null, `${name} remains interactive without pickup`);
}
control = { matches: () => true };
pointer('pointerdown', 100); held();
assert.equal(gestures.drag.active, true, 'Exercise name/number also allows pickup');
const touchMove = () => { const event = new Event('touchmove', { cancelable: true }); surface.dispatchEvent(event); return event.defaultPrevented; };
assert.equal(touchMove(), true, 'Active touch drag prevents native scroll');
pointer('pointercancel', 100);
assert.equal(touchMove(), false, 'Scrolling remains native before pickup');
control = null;
checked = true;
pointer('pointerdown', 100);
assert.equal(gestures.drag, null, 'Checked card cannot be picked up');
checked = false;
stubEngine.isDaySealed = () => true;
pointer('pointerdown', 100);
assert.equal(gestures.drag, null, 'Sealed day cannot be picked up');
stubEngine.isDaySealed = () => false;
pointer('pointerdown', 100); held();
const escape = new Event('keydown');
Object.assign(escape, { key: 'Escape' });
Object.defineProperty(escape, 'target', { value: target });
surface.dispatchEvent(escape);
assert.equal(gestures.drag, null, 'Escape cancels the held card');
pointer('pointerdown', 100); held();
window.dispatchEvent(new Event('blur'));
assert.equal(gestures.drag, null, 'Window focus loss cancels pickup');
pointer('pointerdown', 100); held();
window.dispatchEvent(new Event('engine:state_updated'));
assert.equal(gestures.drag, null, 'Navigation/state refresh cancels pickup');
pointer('pointerdown', 100); held();
gestures.destination = 0;
pointer('pointerup', 100);
const click = new Event('click', { cancelable: true });
Object.defineProperty(click, 'target', { value: target });
surface.dispatchEvent(click);
assert.equal(click.defaultPrevented, true, 'Post-drag click cannot open details or activate controls');
assert.equal(calls.length, 2, 'Only completed drags save');
// Run the actual swipe and reorder listeners together, in their application order.
const combined = new EventTarget();
combined.querySelector = () => null;
combined.querySelectorAll = selector => selector === '.card-wrapper' ? [card] : [];
card.id = 'ex-0-2';
card.classList.remove = () => {};
card.querySelector = () => null;
let completionCalls = 0;
const swipeEngine = { ...stubEngine, toggleComplete: () => { completionCalls++; } };
Kai.prototype.setupEventDelegation.call({ els: { cards: combined }, engine: swipeEngine, memoryFoam: 'ease' });
const combinedGestures = new ExerciseReorder(combined, swipeEngine, () => {});
const bodyTarget = { closest: selector => selector === '.card' ? cardSurface : null };
function combinedPointer(type, x, y = 100) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { button: 0, pointerId: 1, clientX: x, clientY: y });
    Object.defineProperty(event, 'target', { value: bodyTarget });
    combined.dispatchEvent(event);
}
combinedPointer('pointerdown', 20);
assert.equal(captured, false, 'Swipe does not capture a short tap');
held();
assert.equal(combinedGestures.drag.active, true);
combinedPointer('pointermove', 120, 160);
assert.equal(cardSurface.style.transform, '', 'Active reorder has cleared competing swipe state');
combinedGestures.destination = 0;
combinedPointer('pointerup', 120, 160);
assert.equal(completionCalls, 0, 'Held drag cannot also complete the exercise');
combinedPointer('pointerdown', 20);
combinedPointer('pointermove', 120);
assert.equal(combinedGestures.drag, null, 'Quick horizontal movement still belongs to swipe');
assert.equal(captured, true, 'Horizontal swipe captures only after movement');
combinedPointer('pointerup', 120);
assert.equal(completionCalls, 1, 'Quick completion swipe still works');
// A phone can deliver the final move and release before the next animation frame.
// Dropping must use the release position, not the last painted target (initially itself).
const dropSurface = new EventTarget();
const dropCards = [0, 1, 2, 3, 4, 5].map(slot => ({
    dataset: { idx: String(slot) },
    classList: { add() {}, remove() {}, toggle() {}, contains: () => slot < 3 },
    getBoundingClientRect: () => ({ bottom: (slot + 1) * 100 })
}));
dropSurface.querySelectorAll = selector => selector === '.card-wrapper' ? dropCards : [];
dropSurface.querySelector = () => null;
const dropCardSurface = {
    style: {}, closest: () => dropCards[5],
    setPointerCapture() {}, hasPointerCapture: () => false
};
const dropTarget = { closest: selector => selector === '.card' ? dropCardSurface : null };
const dropCalls = [];
await a.undoExerciseOrder(1);
await a.toggleComplete('ex-1-2', 1);
assert.equal(a.isDayCompleted(1), true);
const dropChecks = structuredClone(a.state.done);
let dropSave;
const dropEngine = {
    get state() { return a.state; }, get cycleId() { return a.cycleId; },
    isDaySealed: day => a.isDaySealed(day),
    reorderExercise(...args) { dropCalls.push(args); return dropSave = a.reorderExercise(...args); }
};
new ExerciseReorder(dropSurface, dropEngine, () => {});
function dropPointer(type, y) {
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { button: 0, pointerId: 2, clientX: 20, clientY: y });
    Object.defineProperty(event, 'target', { value: dropTarget });
    dropSurface.dispatchEvent(event);
}
dropPointer('pointerdown', 550); held();
dropPointer('pointermove', 450);
dropPointer('pointerup', 450);
assert.deepEqual(dropCalls, [[1, 5, 4]], 'Release before the next frame must still move to the unfinished target');
assert.equal(await dropSave, true);
assert.equal(a.getExerciseOrder(1)[4], 5);
assert.deepEqual(a.getExerciseOrder(1).slice(0, 3), [0, 1, 2]);
assert.deepEqual(a.state.done, dropChecks);
assert.deepEqual(sortedLogs(), savedSets);
assert.deepEqual(a.getDaySummary(0), priorHistory);
assert.deepEqual(a.getDaySummary(1).order, a.getExerciseOrder(1));
const droppedOrder = a.getExerciseOrder(1);
a = await engine();
assert.deepEqual(a.getExerciseOrder(1), droppedOrder, 'Held drop persists after reload');
await a.undoExerciseOrder(1);
assert.deepEqual(a.getExerciseOrder(1), pullOrder, 'Held drop retains one-step Undo');
dropPointer('pointerdown', 550); held();
dropPointer('pointermove', 450);
dropPointer('pointerup', 350);
assert.deepEqual(dropCalls.at(-1), [1, 5, 3], 'The release coordinate takes precedence over the last move coordinate');
assert.equal(await dropSave, true);
const beforeInvalidDrop = a.getExerciseOrder(1);
dropPointer('pointerdown', 550); held();
dropPointer('pointerup', 150);
assert.equal(await dropSave, false, 'A drop onto a checked position is still rejected');
assert.deepEqual(a.getExerciseOrder(1), beforeInvalidDrop);
assert.deepEqual(a.state.done, dropChecks);
assert.deepEqual(sortedLogs(), savedSets);
globalThis.setTimeout = realTimer;
console.log('Exercise ordering tests passed');
