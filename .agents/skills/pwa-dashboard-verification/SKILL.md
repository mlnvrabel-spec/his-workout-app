---
name: pwa-dashboard-verification
description: Verify the Hypertrophy Protocol Dashboard after frontend, PWA, service-worker, or Garmin UI changes. Use for browser checks, offline behavior, render regressions, and release-readiness checks.
---

# PWA Dashboard Verification

1. Read `../../../AGENT_GUIDE.md` and `../../workflows/test_pwa_dashboard.md`. Apply relevant `PRODUCT_SPEC.md` acceptance criteria.
2. During implementation, run focused deterministic checks first. Before browser validation on a final release candidate, require a passing `npm.cmd run verify` for that exact unchanged candidate; do not rerun an already fresh passing suite without cause.
3. For browser work, start the frontend on port 3000. Start the FastAPI bridge on port 8001 only when relevant, following `../../../README.md`. Avoid live credentials or destructive changes to existing user data.
4. Check the applicable scenarios: initial render, navigation, interaction and persistence, console/network errors, accessible controls, manifest and service-worker state. Use the workflow's scoped scenarios rather than performing unrelated exhaustive manual testing on every change.
5. For offline or service-worker changes, verify cache population, worker scope, offline reload, and update activation as applicable. A unit test is not a substitute for observed browser behavior.
6. Fail fast on a blocking render error. Report exact observed PASS, FAIL, NOT RUN or SPEC CONFLICT, plus essential console/DOM/browser evidence. Do not claim real touch, Garmin authentication, or device coverage without observing it.
7. A lower-cost agent may perform *independent, read-only* interactive browser inspection if the expected benefit justifies the handoff. Never spawn a worker merely to invoke an existing script. Return failures to the main agent; do not fix code inside a verification-only assignment.
