---
description: Test the PWA dashboard against PRODUCT_SPEC.md
---

# PWA Dashboard Testing Workflow

Read `../../PRODUCT_SPEC.md` before testing. Product-spec requirements below override any legacy check that still mentions a readiness card or `LOCAL` status.

When instructed to test the progressive web app dashboard, follow these standardized steps to ensure thorough validation and minimal token usage.

## 1. Setup & Launch
- Navigate to `http://localhost:3000`.
- Open the Developer Tools console immediately and note any JavaScript errors or warnings.
- Check the Network tab to ensure `manifest.json` and `service-worker.js` load without errors.

## 2. Core Render Checks
- Inspect `.cards`. If it's missing or empty, explicitly check the `WorkoutEngine` variables or report the exact DOM structure under `<main id="cards">` to the main agent.
- Verify the navigation dock (`.nav-dock`) exists and the active day matches the header.
- Ensure the Hero visibly contains only `Last → Today`, and the network indicator exposes only `LIVE`, `CACHED`, or `SYNCING`.

## 3. Interaction Scenarios
### Scenario A: Basic Interaction & State Updates
1. Toggle the theme button (`#theme-btn`) - ensure the document body receives the correct `data-theme`.
2. Tap navigation tabs - ensure the main header and content switch without flickering.
3. Open a log card, tap a '+' button - ensure the input updates and it visually logs the result.
4. Check Developer Tools Console to confirm event listeners like `workout:sync_queued` or `workoutLogged` emit without errors.

### Scenario B: Garmin Sync Flow
1. Open the Settings Panel via the gear icon (`#settings-btn`).
2. Verify the Settings Panel opens smoothly to the right overlay.
3. Click 'Connect' when the bridge is unauthenticated or 'Disconnect' when LIVE.
4. Verify the `AuthUI` overlay (login/MFA) functions correctly.
5. Watch the network indicator update dynamically through the allowed states.

## Product-spec completion gate (§3.1 and §4)

1. Check a non-total number of exercises; the active day must remain unfinished and show `Finish workout · n of total`.
2. Tap Finish and verify the next program day becomes active, the prior nav day is marked complete, and Hero changes to `finished split → next split`.
3. The next unfinished day must show both Finish and a separately labeled `Undo last completion` action.
4. Navigate away, return, and reload; active day, Hero, completion marker, and actions must persist.
5. Undo only in isolated test data when local deletion is authorized; otherwise cite the automated undo transaction test as `NOT RUN`.
6. After four finished days, the next cycle must open clean on D1.

## 4. Reporting Guidelines
- **Errors First**: Immediately return the stack trace of any console `ERROR` or unhandled promise rejection.
- **Fail Fast**: If `.cards` is empty or the UI is blank, do not proceed with Scenario A or B; immediately return the outer HTML of the `<main>` tag and any console logs.
- **Succinct Summary**: If all scenarios pass, respond with a short confirmation (e.g., "All test cases passed. No console errors. Network state syncs correctly"). Do not write a long narrative.
- Report each product-spec section as `PASS`, `FAIL`, `NOT RUN`, or `SPEC CONFLICT`; do not infer browser, offline, or Garmin-auth coverage from unit tests.
