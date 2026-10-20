import assert from 'node:assert/strict';
import { Modal } from './src/ui/Modal.js';

globalThis.window = new EventTarget();
let index = 0;
const entries = [{ route: 'workout' }];
const travel = delta => {
    index += delta;
    const event = new Event('popstate');
    event.state = entries[index];
    window.dispatchEvent(event);
};
window.history = {
    get state() { return entries[index]; },
    pushState(state) { entries.splice(++index); entries[index] = state; },
    back() { queueMicrotask(() => travel(-1)); }
};
const background = [{ inert: false }, { inert: false }];
const trigger = { isConnected: true, focus() { document.activeElement = this; } };
globalThis.document = { activeElement: trigger, querySelectorAll: () => background };
const makeElement = () => {
    const element = new EventTarget();
    element.hidden = false;
    element.setAttribute = () => {};
    element.querySelector = () => ({ focus() { document.activeElement = this; } });
    return element;
};
let closes = 0, opens = 0;
const element = makeElement();
const modal = new Modal(element, () => { closes++; modal.close(); }, 'Test', () => { opens++; modal.open(); });
modal.open();
assert.equal(index, 1);
assert.equal(entries[0].route, 'workout');
assert.equal(background[0].inert, true);
travel(-1);
assert.equal(closes, 1);
assert.equal(element.hidden, true);
assert.equal(document.activeElement, trigger);
assert.equal(background[0].inert, false);
travel(1);
assert.equal(opens, 1);
assert.equal(element.hidden, false);
assert.equal(index, 1, 'Forward does not add another entry');
modal.close();
await Promise.resolve();
assert.equal(index, 0);
assert.equal(element.hidden, true);

// A new dialog opened before close's asynchronous Back must not be lost.
modal.open();
modal.close();
const nextElement = makeElement();
const next = new Modal(nextElement, () => next.close(), 'Next');
next.open();
assert.equal(nextElement.hidden, true);
await Promise.resolve();
assert.equal(nextElement.hidden, false);
assert.equal(window.history.state.hypertrophyDialog, next.historyId);
travel(-1);
assert.equal(nextElement.hidden, true);
console.log('Dialogs: Back, Forward, close, focus, inert background and rapid replacement OK');
