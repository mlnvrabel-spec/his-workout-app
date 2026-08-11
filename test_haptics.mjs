import assert from 'node:assert/strict';
import { HAPTIC_PATTERNS, triggerHaptic } from './src/ui/Haptics.js';

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const calls = [];

try {
    Object.defineProperty(globalThis, 'navigator', {
        configurable: true,
        value: {
            vibrate: pattern => {
                calls.push(pattern);
                return true;
            }
        }
    });

    assert.equal(triggerHaptic('exerciseChecked'), true);
    assert.equal(triggerHaptic('exerciseUnchecked'), true);
    assert.deepEqual(calls, [HAPTIC_PATTERNS.exerciseChecked, HAPTIC_PATTERNS.exerciseUnchecked]);
    assert.equal(triggerHaptic('unknown'), false);
} finally {
    if (originalNavigator) {
        Object.defineProperty(globalThis, 'navigator', originalNavigator);
    } else {
        delete globalThis.navigator;
    }
}

console.log('Haptics: OK');
