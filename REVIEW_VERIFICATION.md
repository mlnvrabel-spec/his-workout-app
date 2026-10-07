# Workout reliability review and verification

Implemented locally on 10 September 2026. Existing unrelated workspace changes were preserved. No deployment or publication was performed.

## Fixed defects

| Failure | Result |
| --- | --- |
| Undo replaced the cycle checklist, deleting later progress | Undo removes only the latest completion; later checks and logged sets survive |
| Completed-day Finish could undo a different day or do nothing | Finished days are read-only, show their saved count, and offer Continue; Undo names its exact target |
| Rapid Finish calls could finish two days | Pending guard plus a transaction against the latest stored day/cycle prevents duplicate completion |
| Failed local save left memory ahead of storage | Success events and state adoption occur only after the IndexedDB transaction commits |
| Concurrent windows overwrote each other's checks | Serialized read-modify-write transactions preserve independent changes; broadcast/focus refresh reconciles windows |
| Out-of-order completion advanced into an already finished day | Advancement selects the next unfinished day |
| Undo across a cycle boundary discarded the new cycle | The next-cycle draft and its identity are retained for re-finishing |
| Completed exercise substitutions could change | Summaries freeze the actual exercise prescriptions; finished cards cannot swap or log |
| Set logging overwrote previous sets after navigation/reload | Stable cycle/day session keys and transactional append preserve every set |
| An old sync response marked newer sets synced | Acknowledgment checks the transmitted set version; queue draining picks up new sets appended in flight |
| Hero/week metadata could disagree with completion history | LocalStorage projections are rebuilt from durable summaries after load and Undo |
| Worker scope missed the application root | Root-scoped worker caches the complete local application shell |
| Upgrade mixed old cached modules with new source | Install reloads assets, fetch selects only its own version cache, and the app offers explicit activation |
| Completed-card render crashed on a false swap descriptor | Optional access handles disabled swaps; every protocol card is tested in both states |
| Hidden overlays, inaccessible controls, missing dismissal | Native buttons, expanded/pressed states, hidden/inert dialogs, Escape and focus return |
| Theme reset and disabled zoom | Persisted theme is restored at boot; viewport zoom is enabled |
| Coaching was deliberately disabled | Backend-backed assistant and exercise cues now have explicit local/offline fallbacks |

## Improvements

Named Finish/Undo/Continue actions, saving state and durable-save feedback; completed-session history and consistent JSON snapshot export; per-exercise load/reps logging with previous performance; visible LIVE/CACHED/SYNCING state; automatic pending-log replay; accessible card controls and dialogs; restrained mobile styling. Protocol data and optional exercise checks remain unchanged.

RPE in the current quick logger is derived from the prescribed RIR; direct editing of actual effort and correction/deletion of saved sets are follow-up product improvements, not implemented here. Export is available; an import/restore workflow is not yet included.

## Verification

- PASS: `npm.cmd run verify` — all protocol cards, state transitions, transaction abort rollback, rapid/concurrent Finish, two-window checklist changes, out-of-order advancement, cycle-boundary Undo/refinish, reload persistence, immutable completed substitutions, set append/acknowledgment, Hero dates, haptic patterns and worker behavior.
- PASS: `.venv\Scripts\python.exe backend/test_api.py` — durable queue endpoint, readiness composition, exercise mappings, coaching fallback, malformed responses, three-sentence truncation, chat context and validation.
- PASS: `.venv\Scripts\python.exe -m compileall -q backend`.
- PASS: `git diff --check` (Git also reports normal LF/CRLF conversion notices).
- PASS: in-app browser at 390 x 844 — completed-day review/Continue, logging 50 kg x 10, day-four Finish, next-cycle check, Undo/refinish, reload, history exercise/set snapshot, keyboard completion, dialog Escape, dark/light theme and local coaching answer.
- PASS: actual service-worker update prompt and activation. Initial browser verification exposed mixed cached modules and the completed-card crash; both were corrected and retested.
- PASS: stopped both local frontend and API servers, reloaded the root URL, and reopened it in a new browser tab. App shell, theme and checklist remained available. Logged a 20 kg x 12 test set offline, restarted servers and reloaded; SQLite inspection confirmed bridge receipt.
- NOT RUN: live Garmin login/MFA, real Garmin publication, paid AI provider requests, physical phone install/standalone mode, real vibration, screen-reader device testing and touch swipe/long-press device testing.

The existing local Garmin token state did not produce readiness data during preview. The header correctly falls back to CACHED; no credentials were changed. The bridge currently acknowledges durable local queue receipt, not publication to Garmin Connect. Synthetic preview sets were stored in the isolated preview origin and the local bridge queue.

## Remaining high-end product work

Actual effort entry and set corrections; import/restore and backup recovery UX; verified Garmin publication with retry reconciliation; physical-device accessibility and standalone PWA certification. These should be completed before claiming production-level end-to-end Garmin support.

## Mobile layout follow-up

Settings now opens within the viewport, focuses without scrolling, and sits above the navigation dock. Removed the body perspective that changed fixed-position containment and constrained root overflow. Finish/Continue and secondary Undo each occupy a full-width row; removed footer helper text. At 390px, browser measurement confirmed document scrollWidth equals clientWidth and Finish width equals its action container width.


## Bug Hub #1 — automatic completion and calendar scheduling (2026-10-07)

Confirmed brief: PRODUCT_SPEC.md §3.1. At least 50% of planned exercise checks qualifies the workout and marks its navigation tab complete. Same-day checks remain editable; dropping below the threshold removes automatic completion. On the next local calendar day, advance a qualified workout once; otherwise resume it. Explicit Finish and Undo remain available. Automatic four-day cycle reset occurs on the next calendar day.

- PASS reproduction against the original HEAD WorkoutEngine with isolated fake-indexeddb: at 3/6, day=0, completed=false, summaries=0; reopening on a later date still returned day=0 with three checks and completed=false. Temporary reproduction source was removed.
- PASS `npm.cmd run verify`: agent setup, render, protocol, core transactions, new schedule regressions, product specification, haptics, service worker. New regressions cover the 50% boundary, same-day reload/edit/removal, exact summary counts, several missed dates, refresh/reload advancing once, sealed prior days, undated existing checklist recovery, four-day reset, aborted automatic writes, and no unchanged-summary BroadcastChannel feedback loop.
- PASS `git diff --check`.
- PASS in-app browser desktop 1280×720 and mobile 390×844: 2/6 unfinished; 3/6 shows the existing navigation rail and weekly marker; keyboard Space removes/restores completion; checks remain editable; history shows 3/6; same-day reload preserves Push A and its highlight; navigation retains the marker; explicit Finish checks all six and seals the workout; Undo clears it.
- PASS mobile screenshot review and width measurement: document scrollWidth=clientWidth=390. Evidence: [bug1-completion-mobile.jpg](bug1-completion-mobile.jpg).
- PASS actual service-worker update prompt and activation to the final asset version. After stopping the isolated frontend server, offline root reload preserved the three checks, completion marker, workout title and Finish action. No console errors were captured in the final scoped checks.
- NOT RUN browser clock rollover or real-device installed PWA, vibration, touch gestures, screen-reader certification. Calendar scheduling is established by deterministic engine tests, not by a browser clock or physical device test.
- NOT RUN backend API/Garmin/auth tests: this change does not cross the backend boundary, and no backend service was started.

Existing browser origins contained saved workouts; interactive tests used a fresh origin at http://127.0.0.1:54319. Temporary preview servers were stopped and the viewport override was reset. Existing repository deletion `her-workout-app` was preserved. No deployment, publication, commit, merge, other-task message, or central Bug Hub register update was performed.

Legacy saved checklists have no original workout date. Qualified undated checklists advance on first reopen, but their historical training date cannot be recovered; the recovered summary uses the reconciliation date. Remaining device/browser requirements must receive an explicit waiver before any publication that requires those gates.

Changed implementation paths: `src/core/WorkoutEngine.js`, `src/ui/Kai.js`, `src/ui/ExerciseCards.js`, `service-worker.js`. Regression/wiring paths: `test_schedule.mjs`, `test_render.mjs`, `test_product_spec.mjs`, `package.json`. Contract/evidence paths: `PRODUCT_SPEC.md`, `.agents/skills/product-spec-qa/SKILL.md`, `.agents/skills/product-spec-qa/references/spec-coverage.md`, `.agents/workflows/test_pwa_dashboard.md`, this verification record, and the screenshot.


## Exercise order implementation — 7 October 2026

Scope: PRODUCT_SPEC.md §7. Added protocol-owned muscle relationships, a deterministic session ordering policy, stable slot display order in WorkoutEngine, long-press handle with edge scrolling and cancellation, accessible movement controls, transaction-safe Undo, and history order snapshots. Existing in-progress changes were retained.

- PASS: `npm.cmd run verify` after final code changes, including `test_reorder.mjs`. Covers chest separation, supporting-muscle overlap, unavoidable overlap, checked slots, swaps/log identity, reload, concurrent checks, completed history order, new-cycle reset and completion Undo, aborted writes, and actual UI pointer hold/drop/cancel handlers.
- PASS: local in-app browser at `http://127.0.0.1:3002` with separate preview storage. Desktop screenshot and 390×844 phone viewport; keyboard reordering, move-menu pointer activation, Undo and reload persistence. Chest move produced Cable Fly → Reverse Hack Squat → Low Incline DB Press. No captured JavaScript console errors. The move-menu layering defect found during preview was corrected and rechecked.
- PASS: service-worker cache regression tests; new ordering modules included in the versioned offline asset list. Browser app update activation checked.
- NOT RUN: real Android long-press/drag, device vibration, browser edge-scroll gesture and offline reload. The available browser drag control moves before the 350 ms hold threshold; it does not establish a long-press pass. Pointer lifecycle has deterministic automated coverage.
- NOT RUN: unrelated Garmin/auth/backend flows; no backend or integration changes. No publication performed.

Coverage: §7 maps to `test_reorder.mjs`, `test_render.mjs` and the browser observations above. Physical Android gesture testing remains outstanding.

### Reorder control revision — 7 October 2026

Removed the separate grip icon at user request. The existing exercise number now provides hold-to-drag, tap-to-open movement options and keyboard arrows. Checked numbers stay visible and disable reordering. `npm.cmd run verify` passes, including the no-grip rendering regression. Real Android long-press remains NOT RUN.
PASS: updated in-app preview at 497×764 shows no grip icons; tapping the number opens Move up/down, Escape closes it. Screenshot: exercise-number-reorder.jpg in this chat visualization directory. Viewport override restored.
