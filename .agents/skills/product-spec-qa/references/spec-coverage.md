# Product specification coverage

Keep this matrix synchronized with `PRODUCT_SPEC.md` and the executable checks. `Automated` means the standard local suite can prove the requirement without a browser or live Garmin account.

| Spec | Requirement | Evidence | Gate |
|---|---|---|---|
| §2 | Vanilla ES modules, engine-owned state, protocol-owned exercise data | `test_product_spec.mjs`, `test_protocol.mjs`, code review | Automated + review |
| §3.1 Flow | Render only `Last → Today` in active program order | `HeroHeader` unit coverage and PWA DOM snapshot | Browser required |
| §3.1 Weekly rhythm | Monday–Sunday unique local completion dates, without a numeric counter | `test_product_spec.mjs`; PWA DOM snapshot for presentation | Automated + browser |
| §3.1 Completion | Explicit Finish, exact checked count, next-day advance, four-day reset, latest undo | `test_product_spec.mjs`, `test_core.mjs` | Automated |
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
