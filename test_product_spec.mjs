import assert from 'node:assert/strict';
import fs from 'node:fs';

import { environment, engine } from './test_helpers.mjs';
environment();

const { WorkoutEngine } = await import('./src/core/WorkoutEngine.js');
const { StorageManager } = await import('./src/core/StorageManager.js');
const { GarminSync } = await import('./src/core/GarminSync.js');
const { ChatAssistant } = await import('./src/core/ChatAssistant.js');

const protocol = JSON.parse(fs.readFileSync('src/data/core_protocol.json', 'utf8'));
const indexHtml = fs.readFileSync('index.html', 'utf8');
const heroSource = fs.readFileSync('src/ui/HeroHeader.js', 'utf8');
const stylesSource = fs.readFileSync('src/ui/Elena.css', 'utf8');
const kaiSource = fs.readFileSync('src/ui/Kai.js', 'utf8');
const storageSource = fs.readFileSync('src/core/StorageManager.js', 'utf8');
const garminSource = fs.readFileSync('src/core/GarminSync.js', 'utf8');
const authSource = fs.readFileSync('src/ui/AuthUI.js', 'utf8');
const backendAuthSource = fs.readFileSync('backend/auth_manager.py', 'utf8');
const backendCoachSource = fs.readFileSync('backend/routers/ai.py', 'utf8');
const serviceWorkerSource = fs.readFileSync('service-worker.js', 'utf8');
const manifest = JSON.parse(fs.readFileSync('public/manifest.json', 'utf8'));

// PRODUCT_SPEC §2 and §4: protocol data and documented durable stores remain authoritative.
assert.deepEqual(protocol.workouts.map(workout => workout.id), ['PUSH_A', 'PULL_A', 'PUSH_B', 'PULL_B']);
for (const storeName of ['hv3_active_workout', 'hv3_completed_workouts', 'hv3_logs', 'hv3_archive']) {
    assert.ok(storageSource.includes(`createObjectStore('${storeName}'`), `missing IndexedDB store ${storeName}`);
}
assert.doesNotMatch(heroSource, /flow-next|flow-week-count|completion fraction/i);
assert.match(stylesSource, /mask-image: url\('\/public\/brand-mark\.svg'\)/, 'header mark must use the transparent vector asset');

// PRODUCT_SPEC §3.1: checks never auto-finish; Finish completes the checklist and resets after four days.
const completionEngine = await engine();
for (let exerciseIndex = 0; exerciseIndex < 5; exerciseIndex++) await completionEngine.toggleComplete(`ex-0-${exerciseIndex}`, 0);
assert.equal(completionEngine.summaries.length, 0, 'checks never imply Finish');
for (const day of [0,1,2,3]) {
    await completionEngine.setDay(day);
    if (day === 2) await completionEngine.toggleComplete('ex-2-0', 2);
    assert.equal(await completionEngine.finishSession(), true);
    const summary = completionEngine.summaries.find(s => s.day === day);
    assert.equal(summary.completedExercises, protocol.workouts[day].exercises.length);
    assert.equal(summary.totalExercises, protocol.workouts[day].exercises.length);
}
assert.equal(completionEngine.state.day, 0);
assert.deepEqual(completionEngine.state.completedDays, {});
assert.equal(completionEngine.summaries.length, 4);

// PRODUCT_SPEC §3.1 and §4: weekly rhythm is Monday–Sunday and duplicate local dates count once.
const weeklyStorage = new StorageManager();
weeklyStorage.recordCompletedSession('2026-08-24');
weeklyStorage.recordCompletedSession('2026-08-24');
weeklyStorage.recordCompletedSession('2026-08-26');
const weekly = weeklyStorage.getWeeklyStats(new Date('2026-08-29T12:00:00'));
assert.equal(weekly.weekStart, '2026-08-24');
assert.equal(weekly.days.length, 7);
assert.equal(weekly.completed, 2);
assert.deepEqual(weekly.days.map(day => day.date), [
    '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27',
    '2026-08-28', '2026-08-29', '2026-08-30'
]);

// PRODUCT_SPEC §3.2: durable local write happens before the public logged event.
const localFirstOrder = [];
window.addEventListener('set:logged', () => localFirstOrder.push('event'));
const localFirstEngine = await engine();
const saved = localFirstEngine.storage.mutateWorkout.bind(localFirstEngine.storage);
localFirstEngine.storage.mutateWorkout = async (...args) => { const result = await saved(...args); localFirstOrder.push('indexeddb'); return result; };
await localFirstEngine.logSet(localFirstEngine.protocolData[0].exercises[0]._exerciseId, 80, 10, 8);
assert.deepEqual(localFirstOrder, ['indexeddb', 'event']);

// PRODUCT_SPEC §3.2: sync state is explicit and failure does not mutate pending data.
const networkStates = [];
window.addEventListener('network:state_change', event => networkStates.push(event.detail.state));
const pendingLogs = [{
    exercise_id: 'ROW',
    sync_status: 'pending',
    sets: [{ timestamp: '2026-08-29T08:00:00.000Z' }]
}];
const garmin = new GarminSync();
garmin.storage = { markWorkoutLogSynced: async () => {} };
globalThis.fetch = async () => { throw new Error('offline'); };
const originalConsoleWarn = console.warn;
console.warn = () => {};
try {
    await garmin.syncOfflineLogs(pendingLogs);
} finally {
    console.warn = originalConsoleWarn;
}
assert.deepEqual(networkStates.slice(-2), ['SYNCING', 'CACHED']);
assert.equal(pendingLogs[0].sync_status, 'pending');

globalThis.fetch = async () => ({ ok: true, status: 202 });
await garmin.syncOfflineLogs(pendingLogs);
assert.deepEqual(networkStates.slice(-2), ['SYNCING', 'LIVE']);

// PRODUCT_SPEC §3.2 security: Garmin secrets stay transient in the browser and tokens live under backend .garth.
assert.doesNotMatch(`${garminSource}\n${authSource}`, /(?:localStorage|sessionStorage)\.(?:setItem|getItem)/);
assert.match(backendAuthSource, /\.garth/);
assert.doesNotMatch(`${garminSource}\n${authSource}`, /oauth[12]?_token\s*=/i);

// PRODUCT_SPEC §3.3: deterministic fallback is readiness-aware and exactly three sentences.
const coach = Object.create(ChatAssistant.prototype);
coach.currentReadiness = 80;
const highReadinessCue = coach._fallbackCoachingCue('Cable Fly', { repRange: '10-15', targetRir: '0-1' });
assert.equal(highReadinessCue.split(/(?<=[.!?])\s+/).length, 3);
assert.match(highReadinessCue, /add one rep/i);
assert.match(highReadinessCue, /controlled eccentric/i);
coach.currentReadiness = 30;
const lowReadinessCue = coach._fallbackCoachingCue('Romanian Deadlift', { repRange: '6-10', targetRir: '1-2' });
assert.equal(lowReadinessCue.split(/(?<=[.!?])\s+/).length, 3);
assert.match(lowReadinessCue, /match or reduce/i);
assert.match(backendCoachSource, /Maximum 3 sentences/);

// PRODUCT_SPEC §5: long-press reset and installable PWA shell remain wired.
assert.match(kaiSource, /addEventListener\('pointerdown', startPress\)/);
assert.match(kaiSource, /resetDayLogs/);
assert.match(indexHtml, /id="canvas-wrap"/);
assert.equal(manifest.display, 'standalone');
assert.equal(manifest.orientation, 'portrait-primary');
assert.deepEqual(manifest.icons.map(icon => icon.sizes), ['192x192', '512x512']);
for (const asset of ['/index.html', '/public/manifest.json', '/public/brand-mark.png']) {
    assert.ok(serviceWorkerSource.includes(`'${asset}'`), `service worker must cache ${asset}`);
}
assert.match(serviceWorkerSource, /event\.request\.mode === 'navigate'/);
assert.match(serviceWorkerSource, /cache\.match\('\/index\.html'\)/);
assert.match(indexHtml, /register\('\/service-worker\.js'\)/);

console.log('Product specification behavior: OK');
