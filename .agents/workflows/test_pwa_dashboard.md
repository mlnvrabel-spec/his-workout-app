---
description: How to test the PWA dashboard in the browser
---

# PWA Dashboard Testing Workflow

When instructed to test the progressive web app dashboard, follow these standardized steps to ensure thorough validation and minimal token usage.

## 1. Setup & Launch
- Navigate to `http://localhost:5500`.
- Open the Developer Tools console immediately and note any JavaScript errors or warnings.
- Check the Network tab to ensure `manifest.json` and `service-worker.js` load without errors.

## 2. Core Render Checks
- Inspect `.cards`. If it's missing or empty, explicitly check the `WorkoutEngine` variables or report the exact DOM structure under `<main id="cards">` to the main agent.
- Verify the navigation dock (`.nav-dock`) exists and the active day matches the header.
- Ensure the Readiness card (`.readiness-card`) displays the current score and the Garmin Status Pill is either `● LIVE` or `● LOCAL`.

## 3. Interaction Scenarios
### Scenario A: Basic Interaction & State Updates
1. Toggle the theme button (`#theme-btn`) - ensure the document body receives the correct `data-theme`.
2. Tap navigation tabs - ensure the main header and content switch without flickering.
3. Open a log card, tap a '+' button - ensure the input updates and it visually logs the result.
4. Check Developer Tools Console to confirm event listeners like `workout:sync_queued` or `workoutLogged` emit without errors.

### Scenario B: Garmin Sync Flow
1. Open the Settings Panel via the gear icon (`#settings-btn`).
2. Verify the Settings Panel opens smoothly to the right overlay.
3. Click 'Connect' (if LOCAL) or 'Disconnect' (if LIVE).
4. Verify the `AuthUI` overlay (login/MFA) functions correctly.
5. Watch the Garmin Status Pill update dynamically.

## 4. Reporting Guidelines
- **Errors First**: Immediately return the stack trace of any console `ERROR` or unhandled promise rejection.
- **Fail Fast**: If `.cards` is empty or the UI is blank, do not proceed with Scenario A or B; immediately return the outer HTML of the `<main>` tag and any console logs.
- **Succinct Summary**: If all scenarios pass, respond with a short confirmation (e.g., "All test cases passed. No console errors. Live/Local status syncs correctly"). Do not write a long narrative.
