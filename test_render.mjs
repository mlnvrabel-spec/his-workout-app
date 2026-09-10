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
        workout.isDayCompleted = () => finished;
        workout.protocolData[day].exercises.forEach((exercise, index) => {
            const card = cards.createCard(day, workout.protocolData[day], exercise, index, `ex-${day}-${index}`, true, false);
            assert.match(card.innerHTML, /aria-expanded="false"/);
            assert.match(card.innerHTML, /aria-pressed="true"/);
            assert.equal(card.innerHTML.includes('class="set-form"'), !finished);
            assert.equal(card.innerHTML.includes(' disabled'), finished);
        });
    }
}
console.log('All protocol cards render in active and completed states.');
