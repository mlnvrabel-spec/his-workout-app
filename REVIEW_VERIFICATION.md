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
