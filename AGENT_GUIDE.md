# Hypertrophy Protocol Dashboard: Provider-Neutral Agent Guide

**Status:** Canonical project guidance. All assistant entry points (`.agentrules`, `CLAUDE.md`, and `AGENTS.md`) direct here. Update this file when a shared rule changes; do not duplicate shared rules in provider-specific files.

## Scope and autonomy

- For review, explanation, diagnosis, or planning requests: inspect and report; do not change files unless asked.
- For requested implementation: make the smallest in-scope change and run relevant non-destructive checks.
- Ask before external writes, destructive actions, credential changes, purchases, or a material scope expansion.
- State a brief plan for multi-step changes. Surface material ambiguities instead of guessing.

## Change quality

- Keep changes minimal; do not add speculative features, abstractions, or unrelated cleanup.
- Match established style and remove only imports or code made unused by the current change.
- Turn requested behavior into a check: add a focused test for a bug or validation rule, and run the relevant existing checks before handoff.

## Technology and architecture

- Frontend: vanilla ES modules, HTML, and CSS. Do not introduce React, Vue, Tailwind, or a build framework without approval.
- Backend: Python 3.11+, FastAPI, Pydantic, and `garth`.
- `src/core/WorkoutEngine.js` owns workout state. UI modules render and dispatch intent; they do not become a second state store.
- Use `CustomEvent` for cross-module communication. Preserve event names and payload shapes when changing producers or consumers.
- `src/data/core_protocol.json` is the programming-data source of truth. Do not hardcode exercises in UI modules.
- IndexedDB is the durable local source of truth for workout logs. Remote sync is asynchronous and must never block logging or rendering.
- Keep credentials out of source control and browser storage. Backend environment variables own provider credentials.

## Product invariants

1. No data loss: write locally before attempting sync.
2. No unnecessary friction: a core workout action should take no more than two taps.
3. No avoidable layout thrashing: keep interactions responsive and animations transform/opacity based where possible.
4. Visual hierarchy, typography, spacing, and quiet surfaces take priority over decorative borders.
5. Network state must be explicit. The intended states are `LIVE`, `CACHED`, and `SYNCING`; reconcile UI and event handling together when changing sync behavior.

## Conflict order

1. Data integrity and security
2. Usability and accessibility
3. Performance
4. Visual design
5. Motion polish

## Task routing

- Product intent and current behavior: `PRODUCT_SPEC.md`
- Garmin/auth/sync/mapping changes: `.agents/skills/garmin-integration/SKILL.md`
- Coaching behavior or provider calls: `.agents/skills/hypertrophy-coaching/SKILL.md`
- UI design or interaction review: `.agents/skills/luxury-ui-review/SKILL.md`
- Browser, PWA, or release verification: `.agents/skills/pwa-dashboard-verification/SKILL.md`
- Detailed legacy domain references remain under `skills/` and `.agents/`; link to them instead of copying their contents.

## Verification

Run the smallest relevant check, then report what ran and what could not run.

```powershell
npm.cmd run verify
python backend/test_api.py
python -m compileall -q backend
```

`npm.cmd run verify` validates this agent setup and runs the frontend tests. The API test requires the dependencies in `backend/requirements.txt`.
