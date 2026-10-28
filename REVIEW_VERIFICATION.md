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
- PASS mobile screenshot review and width measurement: document scrollWidth=clientWidth=390. Evidence: local completion screenshot (not published).
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
- PASS screenshots at desktop 1280×720 and phone 390×844: no separate grip, preserved card styling, phone document scrollWidth=clientWidth=390. Phone evidence: local reorder screenshot (not published).
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
- PASS: desktop 1280×720 and phone 390×844 previews; phone document width and scrollWidth both 390. Dark and light themes inspected. Screenshot: `[local evidence path omitted]`.
- PASS: service-worker update activation through v78. Stopped the localhost server and reloaded offline: the recorded run remained visible, Resume opened Push A, and the saved Low Incline DB Press completion remained pressed. No captured console errors during that offline check.
- NOT RUN: real Android/iOS hold-and-drag, physical edge scrolling/cancellation, installed-PWA behavior or screen-reader certification. Deterministic handler tests do not establish physical-device passes. Required unmet release gates need an explicit waiver before publication.
- NOT RUN: backend, Garmin authentication/sync or external service tests; these boundaries were unchanged. No credentials or production records were touched.
- NOT YET VALIDATED: actual training adherence, gym performance, running tolerance and long-term hypertrophy/aerobic outcomes. The decision brief defines the proposed real-world validation.

Preview server stopped, viewport override reset and temporary tab closed. Pre-existing `her-workout-app` deletion preserved. No deployment, publication, commit or merge performed.

### Agenda visual review follow-up — 20 October 2026

- PASS: all eleven suites via `npm.cmd run verify` after final source changes; `git diff --check`. Added behavioral coverage for selected-date summary, date-specific Add, absence of an unrelated workout action on a selected rest date, and Today reset.
- PASS: in-app preview at 390×844 and 1280×720. Past and future dates use the same vertical layout. Phone end-of-agenda screenshot shows the final range action with a 20 px agenda inset and zero extra app padding. The native scrollbar is thin and themed. Phone document width equals scrollWidth (390 px).
- PASS: date selection by pointer and keyboard updates the summary; Today restores today. History opens the existing gym archive and export control. Workout Open/Resume and the existing dock remain usable. Dark and light themes inspected; no captured console errors/warnings in scoped checks.
- PASS: explicit service-worker activation to v80; after stopping the preview server, offline reload retained the revised Rest copy, saved workout progress and date-selection behavior. Screenshot: `[local evidence path omitted]`.
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
- Screenshot: `[local evidence path omitted]` (synthetic preview records).
- NOT RUN / SETUP REQUIRED: real hosted HTTPS backend, real DeepSeek authentication/billing/reply quality, actual phone keyboard/cookie behavior, installed PWA and physical touch/screen-reader certification. No hosted backend was confirmed, provisioned or deployed. README documents the AI-only entrypoint, TLS/origin/access-code setup, one-worker limitation and eight-hour reconnection behavior. These code and mock checks do not certify a production service.

Frontend/mock servers stopped; temporary viewport restored. Existing preview tab retained. Prepared for the user's requested GitHub push to the existing branch; automatic deployment remains disabled there. Preserve the unrelated `her-workout-app` deletion and keep main unchanged.

## Interface simplification after browser comments — 20 October 2026

- Removed the Last → Today Hero and weekly strip; retained completion feedback/announcement. History is icon-only. Network state uses distinct icons, explicit accessible descriptions and tooltips. Training averages has a single disclosure label/table. The workout action uses centered flex alignment and an SVG arrow. Same-date records share one surface; Office/Rest use compact context rather than another full card. Scheduling and saved history are unchanged.
- PASS: final `npm.cmd run verify` (13 suites, exit 0) and `git diff --check`. Added checks for all three connection labels/icons and unknown-state fallback, completion feedback without the Hero, exactly one office occurrence in a shared group, and retained movement controls for compact context.
- PASS: in-app preview at 552×764 (reported width) and 390×844. Icon-only History opens the existing archive; Escape closes it. Averages disclosure opens/closes by keyboard and contains the values only once. Workout opens directly to session selectors/exercises. The settled phone view has document width = scrollWidth = 390 px; no captured console errors/warnings during scoped checks. CTA and shared-date geometry inspected in screenshots; light/dark variants checked.
- PASS: service-worker update to v83; stopped the preview server and reloaded offline. Revised header/navigation, workout exercises and grouped Push A/Office history remained available. Temporary viewport restored; user preview tab retained.
- Screenshots: `[local evidence path omitted]` and `grouped-agenda-day.jpg` in the same directory. Synthetic preview data only.
- NOT RUN: physical-device/screen-reader certification, actual connected Garmin state transitions or backend/provider checks (backend source unchanged). Existing hosting and release limitations still apply. No deployment or GitHub push performed for this visual follow-up. The unrelated `her-workout-app` deletion remains untouched.

## Recording-flow refinement, iteration one — 20 October 2026

Implemented the §6 recording-flow refinement in PRODUCT_SPEC.md. Saved sets now support load/reps corrections; quick logs do not invent effort, and legacy effort remains labelled unverified. Counted and explicitly Finished states are distinct. Finish/Undo consequences are visible, guidance is disclosed on demand, exercise actions are labelled, and dialogs support browser Back/Forward. Existing counting, scheduling and Undo mechanics are preserved. Home simplification remains iteration two.

- PASS: final `npm.cmd run verify` (15 suites), including new recording and modal tests; `git diff --check`. Coverage includes atomic corrections, stale edits, rollback, independent-window changes, full-payload sync acknowledgment, export provenance, coaching context and unchanged completion mechanics.
- PASS: `python -u backend/test_api.py` and `python -m compileall -q backend` after backend changes. API tests cover optional/null effort, explicit provenance, legacy numeric compatibility and invalid provenance. Python tests required execution outside the sandbox because the sandbox process stalled. No real provider calls or Garmin authentication were performed.
- PASS: isolated in-app preview at `http://127.0.0.1:3018/`, using synthetic records. Inspected 360×800, 390×844 and 1280×800 layouts, dark/light themes and the final narrow header. At 360 px, document width equals scrollWidth. Scoped connected checks captured no console errors/warnings.
- PASS: logged unreported effort; corrected set 2 from 20×9 to 22×9 without adding a set; retained legacy RPE 9 as unverified. Back dismissed the editor, Forward restored its draft, and Save persisted the correction. Tab/Shift+Tab wrap inside the editor; closing returns focus to Edit.
- PASS: three of six checks showed Counted toward training / Still editable today in Workout and Home and 3/6 in History. Finish showed Finished. Undo cleared checks while retaining saved sets. Explicit alternatives, move/Undo ordering and Space completion worked. Guidance stayed expanded when another set was logged.
- PASS: History and Settings dismissal, Settings/Coach Forward reopening, rapid Settings-to-Coach transition, and scheduling dialog Back/Forward/Cancel. Cancelling the schedule dialog retained Pull A on October 21.
- PASS: explicit service-worker update through v86. Stopped the preview server and reloaded offline; the revised UI, three saved sets and corrected 22×9 value remained available. The set editor also opened offline. Temporary viewport restored; cached preview tab retained.
- Screenshot: `[local evidence path omitted]` (synthetic records).
- NOT RUN: real Android installation, physical touch/haptics, actual phone keyboard behavior, TalkBack, sunlight usability, live Garmin acknowledgment and real AI provider responses. In-app checks are not automated browser or real-device certification. These release gaps require completion or an explicit waiver before publication.

No deployment or GitHub push performed. The unrelated `her-workout-app` deletion remains untouched.

## Production release — 20 October 2026

The user explicitly waived the outstanding physical-phone, TalkBack and live-integration release checks with “yes release it” after the gaps were stated. Those checks remain NOT RUN; the waiver is not a test pass.

- Released exact GitHub commit `8f3375dd139c4ccad01cbb82f1bdf463700b479e` to existing Vercel project `my-split`, production target. Deployment `dpl_BdoBbSwbrbe8P5YZKQZyfksvXafy` reached READY with no alias error. Production URL: https://my-split-five.vercel.app/ . Static ES-module app, framework unset; Vercel build completed successfully. No new framework build was required.
- PASS: production HTTPS returned 200 and correct content types for the page, service worker, SetEditor, SetRecord, Kai, protocol JSON and manifest. Worker served `hypertrophy-v86`.
- PASS: live browser initially used the previous cached app; its visible Update app after saving your sets action activated the new Home/Workout/Coach dashboard. Workout displayed labelled Actions, the focused set logger and Technique & guidance disclosure. No captured console warnings/errors. No synthetic workout records were written to production during verification.
- Screenshot: `[local evidence path omitted]`.
- Existing domains, access protection and environment settings were preserved. Hosted AI was not provisioned; the Garmin bridge remains local. The branch's automatic-deployment setting remains unchanged; this was an explicitly requested production release.

## Browser comments and Coach/export security review — 21 October 2026

Implemented PRODUCT_SPEC §10. The user's final label is REST, recurring by default on Mondays and Thursdays. Legacy office IDs/rules remain compatible, but the interface exposes only REST. Saved schedules/history are preserved. This update is local and has not been pushed or deployed; the preceding release record refers to the earlier production version.

Security findings and fixes:
- FIXED: Coach previously sent workout/readiness/question context to its configured backend without a confirmed browser session. `CoachConnection.request` now blocks chat/coach payloads until connected. Failed status checks clear stale connected state; requests omit referrers and still reject redirects/insecure non-loopback URLs.
- FIXED: raw backend error detail could echo submitted credentials. Errors now use local safe messages. Secret drafts also clear when the Coach overlay closes. Browser checks used dummy strings only, without submitting credentials.
- FIXED: session endpoints had no-store, but chat/cue replies and some errors did not. Shared middleware now marks all Coach responses no-store in both backend entry points; mock tests verify provider replies and validation errors.
- REVIEWED: export reads only workout/session/set stores, not settings, browser credentials, Coach messages or provider keys. A regression seeds unrelated credential/chat storage and confirms it is absent from exported JSON. Export intentionally contains readable workout dates, sets and schedules; added a privacy disclosure beside Export. The file is not encrypted, so sharing it exposes that training history. No evidence of an existing credential leak was found in the reviewed export path.
- REVIEWED: retained exact-origin checks, HTTPS guard, HttpOnly/Secure cookies on HTTPS, hashed opaque session tokens, bounded expiring in-memory keys, access-code comparison, rate limits, no unauthenticated provider spending, safe text rendering and provider fallback. Live hosting/proxy configuration and real provider behavior were not audited; this is a scoped code/mock review, not a penetration test or production security certification.

Verification:
- PASS: final `npm.cmd run verify` (15 suites), `python -u backend/test_coach.py`, `python -u backend/test_api.py`, `python -m compileall -q backend`, and `git diff --check`. Backend tests use mocks; no real provider usage. Added past-REST preservation/conflict/duplicate recurrence coverage, connection privacy/error-state coverage and export exclusion coverage.
- PASS: in-app preview at 552×764, 360×800, 1280×800 and reduced 390×360. Header circles and visible Actions labels removed while preserving targets; compact set tiles retain Edit. Home and Workout both compute Inter. Dark/light views inspected. At 360 px, document width equals scrollWidth.
- PASS: past REST preview contained only the added rest entry; Apply saved October 19 as Recorded without shifting future workouts. Recurrence dialog displayed Monday and Thursday checked. No Office option remains in Add. Duplicate weekly REST is suppressed when explicit rest is recorded.
- PASS: Coach header, close and composer fit in 390×360 (panel top 12, bottom 348); connection setup scrolls within that panel. Closing and reopening clears both password fields. Offline questions display local guidance. Actual keyboard opening/panning on a physical phone remains NOT RUN; shortened viewport evidence is not a real-keyboard pass.
- PASS: History privacy disclosure, retained set edit access and modal Back. No console warnings/errors captured during connected scoped checks. Updated service worker to v90, stopped preview server and reloaded offline; REST history and all three saved sets remained available, including corrected 22×9. Viewport reset; existing cached preview retained.
- Screenshots: `[local evidence path omitted]` and `coach-short-viewport.jpg` in the same directory.
- NOT RUN: physical phone keyboard, TalkBack, live Garmin and real hosted Coach/provider connectivity. No integration was provisioned and no credentials were entered. The unrelated `her-workout-app` deletion remains untouched.
## Retrospective activities - 21 October 2026

Implemented PRODUCT_SPEC section 11, which supersedes the earlier past-REST no-reflow behavior. Add now records the next unstarted gym session on a past date, without inventing sets or checks. Past gym, run, REST and other activity records rebuild unfinished gym dates from today. Started/completed training and rolling order remain protected. Preview lists affected dates; calendar Undo restores the record and schedule together unless later training changes invalidate it.

- PASS: final `npm.cmd run verify` (16 suites), including new `test_backfill.mjs`: chronology, duplicate/conflicting records, atomic writes, failure rollback, stale previews, later started sessions, cycle rollover, reload, export and guarded Undo. Backend is unchanged since the preceding successful backend checks.
- PASS: isolated local in-app preview at 390x844. Recording Push A for October 20 moved Pull A from October 23 to today, October 21; subsequent gym dates also appeared in preview. Apply and reload retained the plan and retrospective history label. Undo restored Push A to today and removed the past agenda record. Updated to service-worker v92 and repeated preview/Apply on final assets.
- PASS: stopped the local HTTP server and reloaded offline. Retrospective Push A remained in history and Pull A remained scheduled today. No console warnings/errors captured during the connected final flow.
- Screenshot: `[local evidence path omitted]`.
- Limits: gym backfill follows the next unstarted session in split order; it does not rewrite started workouts or fabricate detailed sets. Browser evidence is a local manual check, not an automated browser or real-device pass. Prior physical keyboard/TalkBack/live-provider gaps remain. Changes are local, not pushed or deployed. Unrelated submodule deletion remains untouched.
## Publication waiver - 22 October 2026

The user explicitly waived physical-phone keyboard, TalkBack and live Garmin/Coach integration checks and requested a GitHub push. These checks remain NOT RUN; the waiver is not a test pass. Existing automated and browser verification above remains applicable to unchanged runtime source.

At publication, GitHub branch codex/flexible-training-agenda already contained implementation commit 128b74c95a11596107fb4b7b74dfe22402bcd843. That existing commit includes the earlier submodule deletion; this publication step does not modify it. Earlier statements that changes were local-only describe the state when those checks ran. This follow-up records the waiver; it does not deploy to Vercel.
## Production deployment - 22 October 2026

Deployed commit 698f759115749ffc9e5501a920648fb3d46ed6c3 under the user's existing deployment authorization and explicit waiver. Vercel deployment dpl_4pk24GRmH82TMtiu5QUz2nwi4wjr reached READY, target production, aliasError null. Static app build succeeded (framework unset). Production: https://my-split-five.vercel.app/ . Domains, access and environment configuration were preserved.

Live HTTP verification passed: page 200, service worker hypertrophy-v92, past gym option and REST label present, visible Actions label absent. Existing local browser/automated evidence applies to this unchanged runtime. Physical-phone/TalkBack/live-integration checks remain waived, not passed. No hosted Coach or Garmin service was provisioned by this static deployment.

## Explicit backfill workout selection - 23 October 2026

Implemented the user's choice to continue future training after the workout selected for backfill (PRODUCT_SPEC §11). The Add form requires a protocol workout choice. A matching next session retains its identity; a different, older or repeated choice replaces only unstarted gym plans with a rolling cycle starting at its successor. Actual history and non-gym appointments remain fixed; a split restart is blocked while training or a next-cycle draft has progress. Replaced plans never create completion records. Calendar Undo restores both history and the previous plan. Service-worker cache: v94.

- PASS: `npm.cmd run verify`, all 16 frontend suites plus agent setup. Added deterministic coverage for all four choices, repeated/older records, rotated cycles through Finish and automatic midnight advancement, history/export/averages, unchanged appointments, rollback, concurrent progress, reload and Undo. Form tests verify the selected workout is dispatched and other activity types do not require that field.
- PASS: in-app browser at isolated `http://backfill-check.localhost:3000/`, 390×844 and 1280×800. Required empty selection, native keyboard selection, Enter activation, full change preview, Apply, History provenance, reload, focus return and Undo. Recorded Pull A for October 22 yielded Push B → Pull B → Push A → Pull A from October 23. Browser logs contained no warnings/errors during the verified flow; desktop document had no horizontal overflow.
- PASS: stopped the loopback-only preview server, reloaded through the service worker and verified the selected Pull B record and next Push A persisted. Undo also worked with the server stopped. Viewport overrides were reset and test additions were undone. The user's usual localhost and production calendar records were not edited.
- Screenshot: `[local evidence path omitted]`.
- NOT RUN: physical-device/TalkBack checks and live Garmin/Coach flows. Backend and integrations were not changed. Browser evidence is a local manual check, not an automated browser or real-device pass. Changes are local; no push or deployment was requested for this change. Existing unrelated working-tree UI changes were preserved.

## Direct past-gym save - 23 October 2026

At the user's request, past gym recording now uses one Save workout action, with the successor and future-date recalculation explained in the form. Validation and the existing atomic engine commit still run; there is no separate review/Apply screen. Errors preserve the form and selected workout, repeated submits are blocked, and success exposes calendar Undo. Future moves and other calendar edits retain their existing preview. Service-worker cache: v95.

- PASS: `npm.cmd run verify` (agent setup and all 16 suites), including UI checks for direct dispatch, duplicate-save prevention, validation and failed writes, retained selection, retry and success/Undo feedback. Existing engine backfill coverage remains unchanged and passing.
- PASS: isolated in-app browser at `backfill-check.localhost:3000`, 390×844 and 1280×800. Saved Pull A for October 22 with one keyboard-activated Save workout, immediately returned to Home showing Push B next, and retained the record after reload. Attempting another gym record on that date left the form open with the correct error and selected Pull B. A subsequent future Move still produced the expected cascade preview; cancelling it and Undo restored the original test plan. No console warnings/errors observed. Test record undone and viewport restored.
- Screenshot: `[local evidence path omitted]`.
- The requested loopback server is running on port 3000, and `http://127.0.0.1:3000/` was opened with updated assets. Calendar data at other origins/ports was not migrated or edited. No publication. Physical-device and live-integration checks remain NOT RUN; the unchanged engine/offline behavior retains the preceding evidence, with no new offline browser claim for this UI-only shortcut.

## Quiet calendar rows and item details - 23 October 2026

Implemented the four browser comments in PRODUCT_SPEC §§3/8. Whole-row native buttons replace repeated Planned/Open/Move/Fixed controls. Item details contain dates, the protocol exercise list and applicable actions; future-cycle details cannot open a different current-cycle session. Planned occurrences can be deleted directly with Undo. Explicit gym deletions persist as skipped identities, never completions, and are excluded from split advancement requirements; starting that split explicitly restores its identity. Started/completed training remains protected in details. The header uses a noninteractive 7px status dot with accessible state text/tooltips and distinct filled/hollow/dashed styles. Recorded 14/28-day weekly averages are always visible in a compact table. Cache version: v96.

- PASS: `npm.cmd run verify`, all 16 suites and agent setup. Regressions cover row-button activation/labels, visible averages, all network-state descriptions, deletion persistence, failed-write rollback, protected records, no fabricated completions, whole-cycle skips, future-cycle deletion, resume-after-skip and guarded Undo.
- PASS: isolated local in-app browser, 390×844, 739×764 and 1280×800, dark and light themes. Whole-row pointer and Enter activation opened the correct current/future-cycle details; date edit → cascade preview → Apply → Undo worked. Delete → reload retained removal and zero completed-session counts; Undo restored the plan. Recorded details exposed no Delete or date editor. Current-session Open workout selected the correct split. Nonzero averages updated after a manual backfill. Desktop document/app widths had no horizontal overflow. CACHED dot was a 7px noninteractive status; LIVE/SYNCING variants have unit evidence, not a live-provider browser pass. No console warnings/errors observed.
- PASS: isolated loopback server on port 3001 was stopped after cache population. Offline reload retained a deleted current session and Undo restored it. Port 3000 remained running. Both test calendars had their test records/deletions undone, the test theme was restored and viewport overrides were reset.
- Screenshot (synthetic local history): `[local evidence path omitted]`.
- The user's `http://127.0.0.1:3000/` tab was updated to the verified assets without editing its workout records. No push/deployment. Physical-phone hold/drag, TalkBack and live Garmin/Coach remain NOT RUN; native-button drag cancellation/conflict behavior has automated handler evidence.


## Shared app chrome and calendar hierarchy — 23 October 2026

Implemented PRODUCT_SPEC §12 after the user accepted Workout first/default, Calendar second and a separate circular Coach action. Both pages share a steady title row; Appearance moved to Settings. The workout selector omits D1–D4, retains completed-session indicators and uses a quiet selected surface. Exercise surfaces are flatter, share the content gutter and allow long names to wrap. Calendar removes the duplicate Add toolbar/selected-day hero; per-date Add and existing item details remain. Today and recurring-rest-days settings remain accessible, while Undo appears only when available. Rest uses consistent title case/type. Empty past days display a dash with accessible No activity recorded text; no rest history is fabricated.

Preserved the intervening backfill, direct Save workout, calendar deletion/detail, averages-table and connection-dot changes. Core scheduling/auth/provider behavior was not changed in this UI pass. The only Coach-source edit changes the obsolete Home reference to Calendar.

- PASS: final `npm.cmd run verify` (16 frontend suites plus agent setup), including updated calendar rendering/conditional controls and selected-split accessible-title checks; `git diff --check`.
- PASS: manual in-app preview at 360×800, 390×844 and 1280×800, light/dark. Header stays 72 px; header controls are 48×48; document width equals scrollWidth at both phone widths. Rest/gym titles both compute 500 15px Inter. A legacy themed selector-shadow override was found and corrected. Long exercise names wrap at 360 px.
- PASS: default Workout, Calendar navigation, keyboard selection of Push B retained through Calendar → Workout, restoration to Pull A, History open/close, Appearance selection in Settings, per-date Add (including preserved explicit past-workout selector), recurring-rest-days dialog and cancellation. No workout, calendar or history records were created/changed by browser verification.
- PASS: Coach opens by keyboard from its separate launcher and Escape returns focus to that launcher without changing Calendar. At 390×360, its panel spans y=12–348, close target is 48 px and composer remains inside the panel. Scrolling leaves the sticky header at y=0 with height 72; at the narrow viewport's end, Finish remains above the bottom controls.
- PASS: explicit service-worker update to v99 through the existing update action; final assets rendered. No captured console warnings/errors during scoped connected checks. Original light theme and selected split restored; temporary viewport reset.
- Screenshots: `[local evidence path omitted]` and `premium-calendar.png` in the same directory.
- NOT RUN: physical touch/keyboard/safe-area behavior, TalkBack, real Garmin or hosted Coach/provider connectivity, reduced-transparency/forced-colour device modes or a fresh offline reload. Browser evidence is a manual local preview, not automated-browser or real-device certification. Unmet release gates require completion or an explicit waiver for publication. This UI revision is local; no push or deployment was performed.

## Appearance switch and dock separation — 23 October 2026

Follow-up to the user's three annotations. Settings now uses a native checkbox exposed as a Dark mode switch, with a 48×48 target, visible keyboard focus and persisted theme events. A switch makes this binary preference a single action; the previous native dropdown required opening a menu. A two-label segmented control would also work, but takes more space. The bottom veil uses blur(16.8px), up from 14px (20% in CSS), and extends 20px higher, plus the safe-area inset. Its existing gradient mask keeps the edge gradual; pointer events remain disabled. This is a parameter change, not a measured 20% perceptual increase. Reduced-transparency preferences now also disable the veil.

Removed the visible dash from unrecorded past dates while retaining screen-reader text and the date's Add action. The dash was intended to distinguish absent records from Rest but was unclear to the user. An empty cell avoids repeated explanatory copy and does not turn missing data into confirmed rest. Existing Rest entries remain unchanged. PRODUCT_SPEC §12 records the accepted behavior; service-worker cache is v100.

- PASS: `npm.cmd run verify` (all 16 frontend suites and agent setup) after the runtime changes; `git diff --check`. No backend changes or new integrations.
- PASS: local in-app preview at 390×844, 494×764 and 1280×800; light/dark settings and phone dock inspected. No horizontal overflow in checked views. Switch target computes 48×48. Pointer activation and keyboard Tab/Space update both the switch and theme; dark mode survives reload; Escape returns focus to Settings. Restored light mode and retained Pull A. No workout/calendar records were changed.
- PASS: final veil computes 136px high (zero simulated safe-area inset), blur 16.8px and pointer-events none. Scrolling to the end leaves Finish accessible above the dock. Calendar's empty past cell contains only the visually hidden No activity recorded text; per-date Add and actual Rest remain. Final captured console warnings/errors: none.
- Screenshots in `[local evidence path omitted]`: `dark-mode-switch.png` (keyboard focus), `calendar-empty-day.png`, `softer-dock-separation.png`.
- NOT RUN: physical-device/touch/TalkBack, reduced-motion/transparency or forced-colour emulation, and a fresh offline reload for this revision. Browser checks are manual local previews. Existing release limitations remain; no publication was requested or performed.

## GitHub publication waiver — 23 October 2026

The user explicitly requested publishing all current repository changes to GitHub, including untested changes. This authorizes inclusion of the UI, calendar/backfill, test and documentation edits and waives the remaining verification gates for this GitHub push. Checks recorded above remain evidence only for the scopes actually checked; waived checks remain NOT RUN, not passed. The final UI runtime already passed all 16 frontend suites, and `git diff --check` passed before publication.

Publication target: the existing `codex/flexible-training-agenda` branch at `https://github.com/mlnvrabel-spec/his-workout-app`. No pull request, release or Vercel deployment was requested. The existing `vercel.json` disables automatic deployment for this branch and is preserved.

## Public repository cleanup and production merge — 24 October 2026

The user requested merging the published work into main to update the app, reviewing public information, and security checks. Main is now the documented production source; feature-branch publication alone is not a release. Reference images, debugging screenshots, temporary patch files and local Vercel project metadata are removed from Git tracking, with local copies retained. Historical commits are not rewritten. Local screenshot paths in this record are sanitized. Source, tests and useful project documentation remain public.

The build now emits only the explicit runtime asset list into dist (28 files), and Vercel publishes that directory rather than the repository root. Added basic response hardening headers. Fixed inline-comment ignore patterns and added environment/private-key/local-metadata exclusions. Calendar CSS joins the offline asset manifest; cache version v101.

Garmin routes now require loopback client/Host and a trusted browser origin when present; the shared local Garmin session is not a public multi-user service. Authentication failures and invalid authentication input no longer reflect raw provider/request details. The separate hosted Coach entrypoint remains unchanged.

- PASS: all 16 frontend suites and agent setup; static build plus local import/link resolution and exclusion checks; git diff --check.
- PASS: API, Coach and new security regressions in an isolated compatible environment. Security tests exercise remote-client, hostile Host and Origin rejection, allowed local access, redacted validation/errors and retained rate-limit status. No real credentials or provider calls used.
- PASS: npm audit reports zero advisories. Initial installed Python dependency graph had nine packages with advisories. The final pinned environment contains 31 packages with zero OSV matches and passes pip check. Retained garth 0.6.3 to preserve its existing authentication interface. Host/global dependencies were not changed; local backend users must install the pinned requirements in their own environment. Starlette reports a non-failing TestClient/httpx deprecation warning.
- PASS: credential-pattern scan of all 31 fetched reachable commits, 393 text blobs; only a dummy test-fixture match. GitHub reports zero open secret-scanning alerts. This is not proof that no secrets have ever existed: 31 binary/large blobs, deleted remote refs and external copies were not inspected. Some security-alert endpoints are unavailable with the current access and were not treated as passes.
- NOT RUN: real Garmin authentication after dependency changes, hosted provider calls, physical-device accessibility and a new physical-device offline run. Prior waiver applies to the untested UI publication; these limits remain explicit. Private-repository findings are kept outside this public record.

## Bug Hub #6 — correct manual past workout entries (26 October 2026)

Reproduced with an engine clock of 25 November and a manually recorded workout on 24 November: completed-history protection hid all correction actions, even after an unrelated calendar edit replaced the original Undo. The correction eligibility now checks manual-backfill provenance, recorded completion type, zero completed exercises and absence of saved checks/sets; it does not infer eligibility from a past date. Normal planned editing is unchanged. Manually entered history offers a workout selector and Delete, with guarded Undo. Actual started/counted/finished training stays protected. Corrections change only the selected history entry and averages; future plans retain their identities and dates. Service-worker cache version is v102.

- PASS: npm run verify (all 16 frontend suites and agent setup), npm run build (28 runtime files), git diff --check.
- PASS: focused regression failed before implementation and passes after it. Tests cover edit/delete/reload/Undo, averages, unchanged future plans, later completed workouts/checks/sets, invalid input, failed atomic writes and concurrent-window stale corrections.
- PASS: isolated in-app browser at loopback port 54326, using synthetic 25 October history on 26 October. Pointer edit/delete, Enter save, reload persistence, delete plus reload plus Undo, Escape and focus return; finished-session details exclude correction/deletion. Inspected 390x844 and 1280x800 screenshots. No console errors in the exercised flow. A fresh localhost origin confirmed the final Edit manual record accessible label.
- NOT RUN: physical-device touch/screen-reader testing, real Garmin/provider calls, or a new browser offline run. The service-worker automated suite passed; no offline-browser pass is inferred. No backend behavior changed.
- Earlier preview startup was blocked by an approval-review usage limit; the resumed authorized startup succeeded. Existing user workout origins were not edited or cleared. Temporary preview tabs/server were closed after verification. No commit, deployment, publication, merge or Bug Hub ledger write.

Screenshots are local task artifacts: bug6-manual-correction-mobile.png and bug6-manual-correction-desktop.png.

## Bug Hub #8 — elapsed recurring REST overrides (28 October 2026)

Removed the past-date lock from planned REST constraints and allowed their date edits into the past. Existing occurrence exceptions handle edit/delete without changing weekly rules. Completed/started records retain their protections. No saved user workout storage or Bug Hub ledger was changed.

- PASS: `npm.cmd run verify` (exit 0), including new real-engine regression in `test_scheduler_engine.mjs`: manual Tuesday rest plus elapsed Thursday recurrence; edit/delete, durable reopen, Undo and unchanged following Thursday. `git diff --check` passed.
- PASS: isolated in-memory calendar UI fixture using actual TrainingAgenda and TrainingSchedule modules: past Thursday exposes Delete/Save date; edit preview and Apply; pointer delete; Enter Undo and row activation; original date becomes empty and next Thursday remains recurring. Inspected themed 390x844 and desktop screenshots; no console errors in exercised flow.
- NOT RUN: browser persistence (covered by real-engine automated reopen tests), full-app end-to-end browser flow, real-device touch, Garmin/backend or new offline-browser run. The UI fixture deliberately does not access browser workout storage. Existing port-3000/3001 service workers returned older cached app pages; browser checks used a clean port 48723 origin instead. No PWA source changed.
- Scope: recorded manual rest remains protected by the existing completed-record rule; this repair unlocks planned recurring/manual constraints. No deployment, publication, merge or ledger edits.

Mobile screenshot: local task artifact `bug8-mobile.png`.

## Bug Hub #10 — rolling split after Pull B (28 October 2026)

The user screenshot shows completed Push B on 23 October and Pull B on 24 October, but planned Push B on 28 October. A rotated cycle reused its original starting split after finishing out of order. The engine now aligns an untouched current/future plan with the successor of the latest recorded split, preserving planned dates by position. Started/completed training remains protected. Following the user's clarification, correcting a manual past record recalculates unstarted future splits; deleting the only manual record restarts at Push A. This supersedes the earlier Bug #6 note that corrections preserve future plans.

- PASS: the focused `test_backfill.mjs` regression failed before the repair (Push B instead of Push A) and passed after. It covers reload, correction, deletion, Undo and protected later training.
- PASS: final `npm.cmd run verify`, `npm.cmd run build` and `git diff --check` on the combined Bug #8/#10 candidate.
- NOT RUN: browser validation of this candidate. The attempted local preview returned older cached app versions rather than the current files; those pages were not treated as verification. Physical-device, Garmin and provider checks remain NOT RUN.
- No user workout data, Bug Hub ledger, deployment, publication or merge was changed. Service-worker cache version is v103.
