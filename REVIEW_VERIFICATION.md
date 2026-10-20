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

## Bug Hub #2 — whole-card exercise pickup (2026-10-08)

Confirmed brief: PRODUCT_SPEC.md §7 now accepts a 350 ms hold on the exercise card surface, including the name and expanded details. No separate visible grip was added. Inputs, links, completion checks and action buttons remain independent. The existing number retains its keyboard and tap movement options. Checked cards and sealed days remain fixed; ordering policy and persistence are unchanged.

Pickup clears competing swipe state, captures the pointer only after the hold, and suppresses the following click. Moving horizontally or vertically before pickup cancels reorder; touch movement prevents scrolling only after pickup. Swipe capture now waits for horizontal movement so a short name tap remains usable. Cancellation releases only reorder-owned capture, preserving quick swipes.

- PASS reproduction: ran the new card-body assertion against the original HEAD ExerciseReorder module. It failed with `Holding the card body must start pickup without a handle` (drag undefined). Temporary reproduction files were removed.
- PASS `npm.cmd run verify`: all standard suites, including whole-card pickup, name/number pickup, control exclusions, checked/sealed guards, vertical/horizontal early movement, pointer cancellation, Escape, blur/state-change cancellation, post-drag click suppression and active/pre-pickup touch scroll handling. Combined actual Kai/ExerciseReorder listeners cover short-tap capture, held drag versus completion swipe, and quick completion swipe. These are deterministic event tests, not device gestures.
- PASS in-app browser on isolated origin `http://127.0.0.1:54320`: ordinary Cable Fly name tap opens details; entered and saved 15 kg × 12; keyboard movement changed the displayed order and survived reload; completion check disables that exercise's movement control and unchecking restores it; number tap opens Move up/down and Escape closes it. No captured console errors or warnings during final scoped checks.
- PASS screenshots at desktop 1280×720 and phone 390×844: no separate grip, preserved card styling, phone document scrollWidth=clientWidth=390. Phone evidence: [bug2-reorder-mobile.png](bug2-reorder-mobile.png).
- PASS service-worker update prompt and explicit activation to v74. Stopped the isolated frontend server and reloaded the root offline; all six cards, reordered sequence and the saved test set remained available.
- NOT RUN timed browser hold/drag/drop, browser edge-scroll gesture, real Android/iOS touch scrolling versus pickup, physical-device cancellation, vibration, installed-PWA or screen-reader certification. The available browser drag API does not expose a stationary timed hold. Deterministic handlers and viewport screenshots do not establish those passes. Outstanding required device/gesture gates need an explicit waiver before publication.
- NOT RUN backend/Garmin/auth checks: no backend boundary changed, no backend service started, no credentials touched.

Used the existing checkout, which was clean except the pre-existing `her-workout-app` deletion; that deletion and recent completion/ordering commits were preserved. The temporary frontend server was stopped and viewport override reset. No deployment, publication, commit, merge, Bug Hub database write or message to another task was performed.

Changed paths: `src/ui/ExerciseReorder.js`, `src/ui/Kai.js`, `src/ui/ExerciseCards.js`, `src/ui/Elena.css`, `service-worker.js`, `test_reorder.mjs`, `PRODUCT_SPEC.md`, `.agents/skills/product-spec-qa/references/spec-coverage.md`, `REVIEW_VERIFICATION.md`, `bug2-reorder-mobile.png`.

### Publication authorization — 8 October 2026

The user explicitly waived the outstanding physical hold/drag and edge-scroll checks and requested publication to the existing GitHub repository, allowing its automatic Vercel deployment. Publish only this fix to `mlnvrabel-spec/his-workout-app` on `main`; preserve the unrelated `her-workout-app` deletion. Successful checks above remain valid because runtime source, dependencies and configuration are unchanged since verification. This waiver does not establish a device/gesture pass.

## Flexible training agenda — 20 October 2026

Scope: PRODUCT_SPEC.md §8; rationale and research limitations are in TRAINING_SCHEDULING_DECISIONS.md. Implemented the dated agenda, manual activities and office patterns, forward-only gym displacement, preview, transaction-safe Undo, backdated actuals, and protected started/completed history. Garmin integration remains deferred. The previous publication authorization applies only to the earlier exercise-card fix, not this work.

- PASS: final `npm.cmd run verify` (exit 0, 20 October). All eleven frontend suites pass. New suites cover the five scheduling scenarios, stable cycle identity, missed sessions, backdated add versus move, recurring office exceptions, actual-history protection, deterministic proposals, stale previews, aborted writes, persistence, Undo, and pointer lifecycle/focus behavior. Existing workout, completion, reorder and service-worker regressions pass.
- PASS: isolated in-app browser at `http://127.0.0.1:54322/`, using synthetic local data. Recorded a forgotten run; changed office weekdays after that actual; inserted a run onto a gym date; moved a gym session across the cycle boundary; moved a planned run into the past; applied and undid cascades. Actual history stayed fixed. Reload preserved the plan. Fixed office conflicts produced a clear message.
- PASS: demanding hike on 24 October previewed Push B moving from 24 to 25 October, without adding a rest day. The preview showed a next-day recovery warning. Apply placed Push B on 25 October; focus returned to the original date's Add button; Undo restored 24 October. Extending the agenda exposed 5 November.
- PASS: opening/resuming a workout, completing an exercise and returning to the agenda protected that started session. Keyboard modal focus containment, Escape and focus restoration were checked. Console checks captured no errors or warnings during connected scoped checks.
- PASS: desktop 1280×720 and phone 390×844 previews; phone document width and scrollWidth both 390. Dark and light themes inspected. Screenshot: `C:/Users/mlnvr/.codex/visualizations/2026/10/18/01a15041-692c-73b0-ab0b-8c7f80128ff6/training-agenda-mobile.jpg`.
- PASS: service-worker update activation through v78. Stopped the localhost server and reloaded offline: the recorded run remained visible, Resume opened Push A, and the saved Low Incline DB Press completion remained pressed. No captured console errors during that offline check.
- NOT RUN: real Android/iOS hold-and-drag, physical edge scrolling/cancellation, installed-PWA behavior or screen-reader certification. Deterministic handler tests do not establish physical-device passes. Required unmet release gates need an explicit waiver before publication.
- NOT RUN: backend, Garmin authentication/sync or external service tests; these boundaries were unchanged. No credentials or production records were touched.
- NOT YET VALIDATED: actual training adherence, gym performance, running tolerance and long-term hypertrophy/aerobic outcomes. The decision brief defines the proposed real-world validation.

Preview server stopped, viewport override reset and temporary tab closed. Pre-existing `her-workout-app` deletion preserved. No deployment, publication, commit or merge performed.

### Agenda visual review follow-up — 20 October 2026

- PASS: all eleven suites via `npm.cmd run verify` after final source changes; `git diff --check`. Added behavioral coverage for selected-date summary, date-specific Add, absence of an unrelated workout action on a selected rest date, and Today reset.
- PASS: in-app preview at 390×844 and 1280×720. Past and future dates use the same vertical layout. Phone end-of-agenda screenshot shows the final range action with a 20 px agenda inset and zero extra app padding. The native scrollbar is thin and themed. Phone document width equals scrollWidth (390 px).
- PASS: date selection by pointer and keyboard updates the summary; Today restores today. History opens the existing gym archive and export control. Workout Open/Resume and the existing dock remain usable. Dark and light themes inspected; no captured console errors/warnings in scoped checks.
- PASS: explicit service-worker activation to v80; after stopping the preview server, offline reload retained the revised Rest copy, saved workout progress and date-selection behavior. Screenshot: `C:/Users/mlnvr/.codex/visualizations/2026/10/18/01a15041-692c-73b0-ab0b-8c7f80128ff6/agenda-refinements-mobile.jpg`.
- PROPOSED ONLY: Home / Workout / Coach bottom navigation, documented in the decision brief. The current header Agenda control and four workout tabs remain in place.
- NOT RUN: physical-device scrollbar/gesture behavior or screen-reader certification. Prior device limitations remain. No backend, Garmin, publication or deployment work performed. Preview server stopped and viewport override reset; the existing user preview tab remains available with cached assets.

### GitHub publication preparation — 20 October 2026

The user requested a GitHub push. Publish the verified implementation and decision records to `codex/flexible-training-agenda` in `mlnvrabel-spec/his-workout-app`, retaining the unrelated `her-workout-app` deletion locally. `vercel.json` disables automatic deployment for this exact branch; other branches retain their existing behavior. This is source publication, not a production release or a waiver of outstanding physical-device release checks. No pull request or release was requested. Frontend verification above remains applicable because runtime source and dependencies are unchanged; JSON configuration is checked separately before commit.

## Weekly averages, primary navigation and DeepSeek coach — 20 October 2026

Scope: PRODUCT_SPEC §8.7/§9. Added trailing 14/28-day recorded gym/run averages; Home / Workout / Coach bottom navigation with split selectors inside Workout; phone connection form and configurable HTTPS backend; question-first coach prompt, bounded follow-up history and labelled local fallback. DeepSeek is the default; OpenAI/Gemini remain selectable. Provider credentials use expiring server-memory sessions. An AI-only hosting entrypoint avoids exposing the local Garmin bridge routes.

- PASS: `npm.cmd run verify` after final frontend changes (13 suites), `python backend/test_api.py`, `python backend/test_coach.py`, `python -m compileall -q backend`, and `git diff --check`. Backend TestClient calls hung inside the sandbox; the same local tests completed outside it. No real provider calls were made.
- PASS: statistics tests cover full calendar windows, inclusive boundaries/DST, duplicate identity, completed-only counting, future/old exclusions, separate gym/run totals and removal/Undo input. UI shows counts, one-decimal weekly averages and the saved-history limitation; expanding Recent training exposes both periods.
- PASS: security tests cover HTTPS and origin guards, access-code failures/rate limits, generic key-safe validation responses, HttpOnly/Secure cookies, session expiry and automatic memory cleanup without a later request, logout, no unauthenticated use of server keys, DeepSeek endpoint/model, preserved OpenAI/Gemini paths, prompt separation, bounded user/assistant history and unavailable readiness. Phone AI entrypoint exposes neither `/auth/login` nor `/sync/workout`.
- PASS: in-app browser at isolated `http://127.0.0.1:54322/`, 390×844 and 1280×720; dark/light themes. Bottom navigation visible on Home and Workout. Split selection survives Home → Workout; Coach opens from the primary bar, modal Escape restores focus, and phone document width equals scrollWidth (390 px).
- PASS, MOCK PROVIDER ONLY: local HTTP browser → FastAPI → mocked provider → displayed reply; wrong code shows an error, submitted secret fields clear, correct test credentials create a session, question/follow-up replies render, and Disconnect removes it. The mock API mounted only AI routes; Garmin credentials were not read or changed. Automated tests verify follow-up payload context. No real API key was entered or provider credit spent.
- PASS: explicit service-worker update to v82. Stopped both preview servers and reloaded offline; averages/navigation and saved synthetic workout data remained available. Offline chat produced explicitly labelled general guidance, without pretending to answer through AI. Connected scoped checks captured no JavaScript console errors/warnings.
- Screenshot: `C:/Users/mlnvr/.codex/visualizations/2026/10/18/01a15041-692c-73b0-ab0b-8c7f80128ff6/weekly-averages-navigation.jpg` (synthetic preview records).
- NOT RUN / SETUP REQUIRED: real hosted HTTPS backend, real DeepSeek authentication/billing/reply quality, actual phone keyboard/cookie behavior, installed PWA and physical touch/screen-reader certification. No hosted backend was confirmed, provisioned or deployed. README documents the AI-only entrypoint, TLS/origin/access-code setup, one-worker limitation and eight-hour reconnection behavior. These code and mock checks do not certify a production service.

Frontend/mock servers stopped; temporary viewport restored. Existing preview tab retained. Prepared for the user's requested GitHub push to the existing branch; automatic deployment remains disabled there. Preserve the unrelated `her-workout-app` deletion and keep main unchanged.

## Interface simplification after browser comments — 20 October 2026

- Removed the Last → Today Hero and weekly strip; retained completion feedback/announcement. History is icon-only. Network state uses distinct icons, explicit accessible descriptions and tooltips. Training averages has a single disclosure label/table. The workout action uses centered flex alignment and an SVG arrow. Same-date records share one surface; Office/Rest use compact context rather than another full card. Scheduling and saved history are unchanged.
- PASS: final `npm.cmd run verify` (13 suites, exit 0) and `git diff --check`. Added checks for all three connection labels/icons and unknown-state fallback, completion feedback without the Hero, exactly one office occurrence in a shared group, and retained movement controls for compact context.
- PASS: in-app preview at 552×764 (reported width) and 390×844. Icon-only History opens the existing archive; Escape closes it. Averages disclosure opens/closes by keyboard and contains the values only once. Workout opens directly to session selectors/exercises. The settled phone view has document width = scrollWidth = 390 px; no captured console errors/warnings during scoped checks. CTA and shared-date geometry inspected in screenshots; light/dark variants checked.
- PASS: service-worker update to v83; stopped the preview server and reloaded offline. Revised header/navigation, workout exercises and grouped Push A/Office history remained available. Temporary viewport restored; user preview tab retained.
- Screenshots: `C:/Users/mlnvr/.codex/visualizations/2026/10/18/01a15041-692c-73b0-ab0b-8c7f80128ff6/simplified-workout.jpg` and `grouped-agenda-day.jpg` in the same directory. Synthetic preview data only.
- NOT RUN: physical-device/screen-reader certification, actual connected Garmin state transitions or backend/provider checks (backend source unchanged). Existing hosting and release limitations still apply. No deployment or GitHub push performed for this visual follow-up. The unrelated `her-workout-app` deletion remains untouched.
