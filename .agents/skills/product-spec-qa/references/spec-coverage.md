# Product specification coverage

Keep this matrix synchronized with `PRODUCT_SPEC.md` and the executable checks. `Automated` means the standard local suite can prove the requirement without a browser or live Garmin account.

| Spec | Requirement | Evidence | Gate |
|---|---|---|---|
| §2 | Vanilla ES modules, engine-owned state, protocol-owned exercise data | `test_product_spec.mjs`, `test_protocol.mjs`, code review | Automated + review |
| §3.1 Workout header | No redundant Last → Today Hero or weekly strip; completion feedback remains accessible | `test_render.mjs`; browser evidence in `REVIEW_VERIFICATION.md` | Automated + browser |
| §3.1 Connection status | Icon-only header controls, explicit accessible LIVE/CACHED/SYNCING descriptions, safe unknown-state fallback | `test_render.mjs`; browser evidence in `REVIEW_VERIFICATION.md` | Automated + browser |
| §3.1 Completion | 50% automatic completion, same-day edits, calendar-day advance, explicit Finish, four-day reset, latest undo | `test_product_spec.mjs`, `test_core.mjs`, `test_schedule.mjs` | Automated |
| §3.1 Live progress | Checklist is the only current-workout progress surface | PWA DOM snapshot | Browser required |
| §3.2 Bridge | Frontend bridge defaults to `localhost:8001`; FastAPI accepts durable queue payloads | `test_product_spec.mjs`, `backend/test_api.py` | Automated + backend |
| §3.2 Offline-first | Local set write precedes events/sync; failed sync returns `CACHED` without mutating the payload | `test_product_spec.mjs` | Automated |
| §3.2 Network UI | Header exposes `LIVE`, `CACHED`, and `SYNCING` visibly | PWA DOM and event checks | Automated + browser; header indicator implemented |
| §3.2 Security | Garmin credentials stay transient in the frontend; OAuth tokens persist only under backend `.garth` | `test_product_spec.mjs`, auth review | Automated + review |
| §3.3 Coaching | Readiness-aware progression, biomechanical cue, maximum three sentences | `test_product_spec.mjs`, `backend/test_api.py` | Automated + backend |
| §3.3 Coaching tempo | Controlled eccentric, no fixed duration | Reconciled specification and backend prompt | Review |
| §4 | Active state, immutable summaries, Hero memory, and unique session dates use the documented stores | `test_product_spec.mjs`, `test_core.mjs` | Automated |
| §5 Visual system | Dark Luxe hierarchy, quiet surfaces, restrained motion, mobile fit | PWA screenshots and computed layout | Browser required |
| §5 Haptics | Check pulse, double manual-save pulse, heavy explicit completion thud | Device/browser vibration evidence | Automated patterns; physical device vibration NOT RUN |
| §5 Long press | Holding an unfinished day tab offers reset without changing completed days | Source guard plus PWA pointer interaction | Automated + browser |

## Standard run

1. `npm.cmd run verify`
2. `python backend/test_api.py` when dependencies are installed
3. `python -m compileall -q backend`
4. Use `$pwa-dashboard-verification` for every row marked Browser required.

Report any skipped row as `NOT RUN`; never infer a pass from adjacent evidence.


See `REVIEW_VERIFICATION.md` at the repository root for the September 2026 regression and browser evidence. `test_sw.mjs` verifies isolated cache behavior; browser offline reload remains a separate check.
| §7 Session order | Muscle relationships, selected destination, checked slots, persistent identity, Undo, cycles, transaction failure, whole-card hold/drop/cancel, embedded-control exclusions, swipe arbitration | test_reorder.mjs, test_render.mjs; local preview evidence in REVIEW_VERIFICATION.md | Automated + browser fallback controls and offline reload; timed browser and real Android hold/drag NOT RUN |
| §8 Calendar rules | Five agreed scenarios, rolling identities, forward-only displacement, office pattern/occurrence edits, actual history, missed workouts, backdating, no automatic run completion, gym-first run suggestions | `test_training_schedule.mjs` | Automated |
| §8 Persistence | Pure preview, stale-preview rejection, failed writes, reload, separate Undo, protected progress, export, manual/automatic cycle identity and completion Undo | `test_scheduler_engine.mjs` | Automated |
| §8 Agenda interaction | Visible Move/locked state, hold cancellation, invalid target feedback, accessible fallback, escaped labels and focus return | `test_training_agenda.mjs`; browser evidence in `REVIEW_VERIFICATION.md` | Automated handlers + browser; physical touch still separate |
| §8.7 Recorded averages and navigation | Trailing 14/28-day counts, deduplication, date bounds, completed-only data; Home/Workout/Coach and preserved split selection | `test_training_stats.mjs`; browser evidence in `REVIEW_VERIFICATION.md` | Automated + browser |
| §9 Coach connection | HTTPS/loopback validation, no browser key persistence, origin/access-code guards, cookies, expiry/logout, rate limits, key redaction, preserved providers and question-first context/history | `test_coach_connection.mjs`, `backend/test_coach.py`, `backend/test_api.py`; browser mock flow in `REVIEW_VERIFICATION.md` | Automated + mock browser/API; real HTTPS/phone/provider setup remains separate |

## Recording-flow refinement — 20 October 2026

| Spec | Requirement | Evidence | Gate |
|---|---|---|---|
| §6 Recording | Unreported quick-log effort; labelled legacy provenance; atomic load/reps correction; same-set conflict rejection; independent edits retained; full-payload sync acknowledgment | test_recording.mjs, backend/test_api.py, test_coach_connection.mjs | Automated + backend + browser |
| §6 Completion wording | Counted versus explicitly Finished; unchanged threshold, Finish override and Undo check reset with sets retained | test_recording.mjs; REVIEW_VERIFICATION.md | Automated + browser |
| §6 Interaction | Focused logging, guidance disclosure, labelled exercise actions, Back/Forward dismissal and focus restoration | test_modal.mjs, test_reorder.mjs; REVIEW_VERIFICATION.md | Automated + browser; real Android remains separate |

For §6, the canonical Undo requirement is to clear the reopened day's checks while retaining saved sets and later progress, as specified in PRODUCT_SPEC.md. Earlier wording about restoring the prior checklist is superseded.
