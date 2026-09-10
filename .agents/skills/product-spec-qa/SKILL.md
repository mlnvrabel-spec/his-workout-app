---
name: product-spec-qa
description: Derive and maintain traceable automated, integration, and browser tests from PRODUCT_SPEC.md for dashboard changes, regressions, and release audits.
---

# Product Spec QA

Read `../../../AGENT_GUIDE.md` and `../../../PRODUCT_SPEC.md` before designing or reviewing tests. Treat the product spec as the behavioral contract and the agent guide as the architecture and safety contract.

## Workflow

1. Read [references/spec-coverage.md](references/spec-coverage.md) and map the changed behavior to its product-spec section.
2. Classify each requirement as deterministic automation, backend integration, or rendered-browser evidence. Do not substitute source-text matching for observable behavior when a unit or browser check is practical.
3. Add the smallest regression that would fail for the broken behavior. Preserve `WorkoutEngine` as the state authority and use the real public method or event boundary where possible.
4. If the spec conflicts with another source of truth or the implementation, report the conflict explicitly. Do not weaken the assertion or silently redefine the requirement to make the suite pass.
5. Update the coverage matrix when requirements, tests, or known gaps change.
6. Run `npm.cmd run verify`. Run `python backend/test_api.py` and `python -m compileall -q backend` when backend dependencies are available and the requirement crosses the FastAPI boundary.

For rendered UI, PWA, service-worker, offline, accessibility, motion, or narrow-mobile evidence, use `$pwa-dashboard-verification` after deterministic checks pass.

## Required gates

- A workout completes only through the explicit Finish action; exercise checks never imply completion.
- IndexedDB is written before sync or success events, and network failure preserves pending local data.
- Completion summaries retain the exact checked-exercise count, advance program order, and reset only after the four-day cycle.
- Undo restores the prior resumable state and its Hero/week metadata without resurrecting after reload.
- UI tests dispatch intent through engine methods; they do not create a second workout state store.
- Garmin credentials and tokens never enter browser persistence. Backend provider keys remain environment-owned.
- Reports distinguish `PASS`, `FAIL`, `NOT RUN`, and `SPEC CONFLICT`, with the relevant spec section and evidence.

Do not claim visual, offline-reload, service-worker-control, or Garmin-auth coverage from unit tests alone.
