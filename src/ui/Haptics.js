export const HAPTIC_PATTERNS = Object.freeze({
    exerciseChecked: 35,
    exerciseUnchecked: 15,
    bulkCompleted: [80, 50, 120],
    bulkCleared: 40,
    exerciseSwapped: [30, 20, 60],
    exerciseSwipeCompleted: [100, 50, 100],
    dayResetReady: [100, 50, 100]
});

export function triggerHaptic(name) {
    const pattern = HAPTIC_PATTERNS[name];
    if (!pattern || typeof globalThis.navigator?.vibrate !== 'function') return false;
    return globalThis.navigator.vibrate(pattern);
}
