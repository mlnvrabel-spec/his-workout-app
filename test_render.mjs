import assert from 'node:assert/strict';
import { environment, engine } from './test_helpers.mjs';
import { ExerciseCards } from './src/ui/ExerciseCards.js';

environment();
const workout = await engine();
globalThis.document = { createElement: () => ({ dataset: {}, innerHTML: '' }) };
const cards = new ExerciseCards(null, workout, 'ease');
for (let day = 0; day < workout.protocolData.length; day++) {
    await workout.setDay(day);
    for (const finished of [false, true]) {
        workout.isDaySealed = () => finished;
        workout.protocolData[day].exercises.forEach((exercise, index) => {
            const card = cards.createCard(day, workout.protocolData[day], exercise, index, `ex-${day}-${index}`, true, false);
            assert.match(card.innerHTML, /aria-expanded="false"/);
            assert.match(card.innerHTML, /aria-pressed="true"/);
            assert.equal(card.innerHTML.includes('class="set-form"'), !finished);
            const checkButton = card.innerHTML.match(/<button[^>]*class="check-wrap"[^>]*>/)[0];
            assert.equal(checkButton.includes(' disabled'), finished);
            assert.equal(card.innerHTML.includes('class="ex-num reorder-handle"'), !finished);
            assert.equal(card.innerHTML.includes('&#10303;'), false, 'No separate grip icon');
        });
    }
}
console.log('All protocol cards render in active and completed states.');

const { Kai, renderNetworkStatus } = await import('./src/ui/Kai.js');
const indicator = { dataset: {}, attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } };
for (const state of ['LIVE', 'CACHED', 'SYNCING']) {
    renderNetworkStatus(indicator, state);
    assert.equal(indicator.dataset.state, state);
    assert.ok(indicator.attributes['aria-label'].startsWith(`${state}:`));
    assert.match(indicator.innerHTML, /<svg/);
    assert.match(indicator.innerHTML, /sr-only/);
}
renderNetworkStatus(indicator, '<script>');
assert.equal(indicator.dataset.state, 'CACHED');
assert.doesNotMatch(indicator.innerHTML, /<script>/);
console.log('Connection state icons retain explicit accessible labels and reject unknown states.');
const completion = { els: { completionAnnouncement: {} }, engine: { state: { activeDay: 0 }, protocolData: [{ title: 'Pull A' }] }, heroHeader: { expandForCompletion() {} }, showFeedback(message) { this.feedback = message; } };
document.getElementById = () => null;
Kai.prototype.sealCompletedWorkout.call(completion, { title: 'Push A', day: 0 });
assert.equal(completion.els.completionAnnouncement.textContent, 'Push A complete.');
assert.match(completion.feedback, /Push A saved/);
assert.equal(completion.justCompletedDay, 0, 'Completion feedback works without the retired Hero');
