# Product Specification: Hypertrophy Protocol Dashboard & Garmin Bridge

## 1. Product Overview
The **Hypertrophy Protocol Dashboard** is a premium, mobile-first Progressive Web App (PWA) designed to track, manage, and progress the "Hypertrophy Hybrid V4 Elite" training regimen. It pairs a high-fidelity "Invisible Luxury" frontend with a Python FastAPI backend that bridges the application with the Garmin Connect ecosystem.

Muscle growth is the first training priority. The rolling order is Push A → Pull A → Push B → Pull B, with leg work distributed across all four sessions; Monday does not reset the cycle. The target is four gym sessions per week. The user's long-term average of 3.5 is acceptable and is not a requirement to make up missed sessions. Accepted user context, research, trade-offs and validation hypotheses are maintained in [TRAINING_SCHEDULING_DECISIONS.md](TRAINING_SCHEDULING_DECISIONS.md).

## 2. Architecture & Modular Design
The application utilizes a strictly typed, event-driven ES Module architecture on the frontend, communicating with an asynchronous Python microservice on the backend.

### 2.1. Directory Structure
*   **`/src/core/`**: The "Logic Tier".
    *   `WorkoutEngine.js`: Single Source of Truth. Manages exercise completion and progression via JSDoc-typed state.
    *   `GarminSync.js`: Communication layer handling the API contract with the local FastAPI bridge.
    *   `ChatAssistant.js`: Integrates the "Mr. Olympia" Evidence-Based AI assistant (OpenAI/Gemini).
    *   `StorageManager.js`: Manages dual-tier storage (`IndexedDB` for heavy workout archives, `localStorage` for light user preferences).
*   **`/src/ui/`**: The "Presentation Tier". Listens for CustomEvents; never mutates state directly.
    *   `Kai.js`: The UI Engine. Manages DOM rendering, animations, and bento-card expansion.
    *   `AuthUI.js`: A secure "Shield" for Garmin Connect MFA without compromising the PWA's sleekness.
    *   `SettingsPanel.js`: Garmin connection preferences; provider keys remain on the backend.
    *   `Elena.css`: The "Dark Luxe" design system and animations.
*   **`/src/data/`**: The "Protocol Data". Contains `core_protocol.json` (The Single Source of Truth for exercise programming).
*   **`/backend/`**: The "Atlas Systems" Python FastAPI bridge.
*   **`/public/`**: The "App Shell". Contains `manifest.json` and icons. The active worker is `/service-worker.js` with root scope.

## 3. Core Features

### 3.1. Training Flow Hero and workout view
The workout-view Hero is a program-adherence surface, not a biometric dashboard. It makes the workout sequence and the user's calendar-week commitment immediately clear. The dated agenda is the home surface under the accepted scheduling contract in section 8; opening the workout retains this existing training flow and its completion rules.
*   **Flow**: Displays `Last → Today` using the active program order. It shows only the prior completed split and the active split—no weekday, split subtitle, completion fraction, or outcome.
*   **Weekly rhythm**: Shows a compact Monday–Sunday history beneath the flow. Filled markers indicate days trained; unfilled markers indicate days without a completed session. It intentionally omits a numeric weekly counter.
*   **Completion rule**: At least 50% of planned exercises checked automatically marks the workout day complete, including its bottom-navigation highlight. The same-day checklist remains editable; dropping below 50% removes automatic completion. On a new local calendar day, resume the next unfinished split only if the previous workout reached 50%; otherwise retain the unfinished workout. Advance once even after several missed days. Finish remains a manual full-checklist override with Undo. Completed days remain marked through the four-day cycle; automatic completion resets the cycle on the next calendar day after all four qualify. Existing undated checklists are reconciled on reopening; their original training date cannot be recovered.
*   **Live progress**: Current-workout exercise completion is communicated by the checklist itself; no redundant segmented progress row is shown. The Finish area uses a full-width action without helper text; exact checked counts remain in training history.

### 3.2. Garmin Connect Bridge (Microservice & Sync Engine)
*   **Technology**: Python FastAPI running on `localhost:8001`.
*   **Trust No Network (Offline-First)**: If the backend or Garmin API is unreachable, the frontend seamlessly queues data in IndexedDB.
*   **Network State UI**: The top header always displays a subtle, luxurious network indicator:
    *   `LIVE` (Green/Gold): Active connection.
    *   `CACHED` (Grey): API rate-limited or offline.
    *   `SYNCING` (Pulsing): Pushing local queue to the backend.
*   **Security**: OAuth tokens are cached in `backend/.garth/`; credentials are never saved or exposed to the frontend.

### 3.3. AI Coaching: The Evidence-Based Persona
*   **Technology**: `ChatAssistant.js` integrates a deterministic RAG (Retrieval-Augmented Generation) prompt wrapper.
*   **Persona**: Evidence-based coaching guided by the supplied rep range and RIR, using a controlled eccentric without a fixed tempo.
*   **Capabilities**:
    *   Available in expanded exercise cards and the coaching assistant.
    *   Suggests one additional rep within the prescribed range when readiness is high; increase load only after all sets reach the top of the range at target RIR. Low readiness never forces progression.
    *   Outputs at most 3 sentences of biomechanical form cues and load targets.

## 4. State & Data Persistence
Data structures are strictly defined via JSDoc in `skill-data-schema.md` to prevent AI hallucination.
*   **`hv3_active_workout`** (IndexedDB): The canonical, resumable current-cycle checklist state (selected day, checked exercises, and completed days).
    *   Scheduling state belongs to this same engine-owned durable record. Calendar edits and their one-step Undo use the workout transaction boundary; a UI module must not maintain an independent authoritative schedule.
*   **`hv3_completed_workouts`** (IndexedDB): Summaries of automatically completed or explicitly finished workout days; automatic summaries track same-day checklist edits.
*   **`hv3_logs` / `hv3_archive`** (IndexedDB): Reserved legacy set-log storage; it is not part of checklist completion.
*   **`hv3_memory`** (localStorage): Last fully completed split (`title`, `subtitle`, and local completion timestamp) for the Training Flow Hero.
*   **`hv3_completed_sessions`** (localStorage): Unique local calendar dates of fully completed sessions; used to derive the current Monday–Sunday commitment.

## 5. Aesthetics & UX
*   **Dark Luxe Theme**: Pure black (`#000`) and deep charcoals with glassmorphism overlays.
*   **Quiet surfaces**: Typography, spacing, and restrained glass surfaces establish hierarchy without an external animation dependency.
*   **Haptic Feedback Language**:
    *   **Short pulse**: Exercise check feedback.
    *   **Double Pulse**: Confirmation for manual log saves.
    *   **Heavy Long Vibration**: Rewarding "thud" triggered only after explicitly finishing and durably saving the workout.
*   **Interaction Patterns**:
    *   **Long-Press Reset**: Holding a day tab (e.g., "D1") in the navigation dock triggers a progress reset for that specific day.
*   **Training Flow**: The compact Hero presents only the prior and active split as a concise timeline.
*   **Motion**: The Training Flow Hero enters with a smooth ease-out transition.

---
*Created by Antigravity AI — Pair Programmed with User*


## 6. Workout reliability and review

- Finish is named for the displayed workout and disabled while saving. It marks all of that day's exercises checked before committing, and repeated Finish calls cannot complete a second day.
- A completed day is read-only, retains its actual substitutions, and offers Continue to the active unfinished day. Browsing history does not change the active workout.
- Advance skips completed days, including when days were finished out of order. Finishing all four starts a new cycle with an empty checklist and retained substitutions.
- Undo names the latest completed day, removes only that completion, resets that day's checklist to zero checks, and preserves later checks and sets. Across the cycle boundary, the new-cycle draft is retained and recovered when finishing again.
- All writes read the latest durable state in a single transaction. Failed/aborted writes leave the last saved state intact. Concurrent windows cannot overwrite unrelated checks or duplicate completion.
- Expanded cards accept load in kilograms and whole-number reps, append sets to a stable cycle/day session, and show previous logged performance. Completed cards show saved sets without editing controls.
- Training history shows finished sessions and their exercise snapshots; JSON export includes completed sessions, set logs, and the resumable state.
- Completion and Undo acknowledgments are visible and announced. Dialogs support Escape, focus containment, and focus return. Theme survives reload; viewport zoom remains enabled.
- Offline application assets are cached as one version, installed with HTTP-cache revalidation and selected from that version's cache. Updates are offered explicitly and activate on request.
- Pending logs retry on boot, finish, connectivity recovery, and focus. Bridge acknowledgment marks only the transmitted log version synced. The current bridge durably queues logs; it does not yet publish them into Garmin Connect.
- `hv3_sets` is the active set store; legacy stores remain readable. Hero memory and weekly dates are projections of committed summaries, rebuilt after load and Undo.


## 7. Session exercise order

- Hold anywhere on an unfinished exercise card's surface (including its name and details) for 350 ms and drag vertically. Inputs, completion checks, links and action buttons retain their normal behavior; the exercise name and number still respond to a short tap. Show the selected card and target position; scroll near viewport edges. Movement before pickup, pointer cancellation, Escape, navigation, refresh and loss of window focus cancel the gesture. Preserve native touch scrolling before pickup and suppress the click after a held drag.
- Tap the exercise number for Move up/down, or use its ArrowUp/ArrowDown keys. Horizontal substitution and completion swipes remain separate.
- Respect the selected slot and destination. Keep checked slots fixed and reject a checked destination. Evaluate the remaining unfinished order using protocol-owned primary/supporting muscle tags: minimize adjacent overlap, then prefer the priority opener when the user has not explicitly moved it, then minimize displacement from the requested order. Shared primary muscles carry weight 3 and shared supporting muscles weight 1. This is a deterministic sequencing heuristic, not a physiological recovery estimate.
- Preserve canonical slot identity for checks and substitutions and exercise identity for logs and input drafts. Save display order in the existing local workout transaction before announcing success. Existing records with no order use the prescribed sequence.
- Offer one-step Undo; refuse to undo if a new check would move a checked slot. Retain the order through reload and offline use. New cycles start with prescribed order; completion Undo across cycles restores the prior order and retains the next-cycle draft. A day reset restores its prescribed order.
- Completion summaries and history retain the session's display order, including same-day automatic completion edits. Sealed days cannot be reordered. Report remaining adjacent overlap after a move when constraints prevent full separation.


## 8. Flexible training agenda

Accepted contract: 19 October 2026. These are product requirements; this section does not itself certify implementation or usability testing.

### 8.1. Scope and home surface

- Home is a dated, vertically scrollable agenda with Today prominent, access to the previous two or three days and the following three or four days near the initial position, and at least seven future days available by scrolling. Small screens need not fit all those rows at once. A Today action restores the current position. Any edit preview shows the complete affected chain even when it extends beyond the visible agenda.
- Open workout retains the existing exercise/checklist view. Returning to the agenda does not change the active split, completion, logs or exercise order. Completed workout history remains available.
- Selecting a date updates the day summary and its applicable workout action; Today selects and locates today again. Selection is local UI state and never changes training records. Past dates keep the same vertical date and row geometry, using muted colors. Empty upcoming dates display Rest as calendar copy, without creating a blocking rest entry; empty past dates display Nothing recorded.
- The agenda supports gym sessions, Norwegian 4×4 runs, office dates, explicit rest dates and other activities such as hikes or cycling. Easy-run scheduling is outside this implementation.
- Default office weekdays are Monday and Thursday. The user can change recurring office weekdays from today or a future effective date, and add, move or remove individual occurrences. This does not change past history.
- Preserve the current exercises and Push/Pull alternation. Do not automatically swap B sessions, substitute exercises, add recovery days, or compute a recovery score.

### 8.2. Constraints and preferences

- Completed sessions and started gym sessions are protected from calendar movement. A gym session with checked exercises or saved sets counts as started. Existing same-day checklist editing and workout completion Undo remain governed by sections 3 and 6.
- Gym order follows stable cycle/day identities, including moves across a cycle boundary. The calendar does not complete a gym session, start a new cycle, reset on Monday, or change the existing 50% completion/day-advance rules.
- Office dates, explicit rest dates, explicitly dated runs and other planned activities block gym scheduling on that date. The first implementation plans one primary session/activity per date; recording what actually happened may truthfully show more than one activity.
- Four gym sessions per week is a planning target, not a mandatory quota or a reason to overwrite existing plans. Gym takes priority when suggesting a run. A 4×4 every 7–10 days is a preference; an automatically suggested run may be later if the window has no available date. Suggestions do not silently displace gym training or create a recurring run commitment.
- An explicitly chosen run date is the user's scheduling decision and may displace an unstarted gym session after a change preview. Gym and 4×4 are not planned on the same day. No universal 24-, 48- or 72-hour recovery cutoff is imposed. A demanding hike can warn about next-day gym training but does not automatically insert rest.

### 8.3. Predictable edits

- Adding or moving a blocking item onto an unstarted gym date keeps the selected item on that date and moves the necessary future gym chain forward, preserving gym order. Each displaced gym session uses the earliest eligible date on or after its existing date and after the preceding gym session. A gym session can be explicitly moved earlier if it still follows earlier unfinished sessions and respects fixed constraints.
- Dropping onto another movable gym session inserts the selected gym session only when rolling order permits; displaced sessions move forward. Dropping onto office, rest, another activity, or a protected session does not silently swap or overwrite either item. Explain the conflict and require that item to be moved or removed first. Do not permit a future cascade to cross a protected gym session.
- Stop propagating once later sessions can keep their existing dates. A freed date does not automatically pull unrelated sessions earlier. The user can explicitly use it. A missed unstarted gym workout stays in the rolling queue and is placed on the next eligible date; it is never silently discarded or counted complete. An overdue run remains unconfirmed until it is recorded, moved or removed.
- Show changed dates, conflicts and relevant preference warnings before Apply. Cancelling the preview changes nothing. A preview made stale by another calendar edit, a date change or workout progress must be regenerated before saving.
- Calendar Undo reverses the latest committed calendar edit and its whole cascade in one operation. It is distinct from workout completion Undo. It must not erase checks, sets, completions or later edits; if those changes make the saved reversal unsafe, explain why Undo is unavailable. Persist locally before announcing success.

### 8.4. Recording runs and other activities

- Selecting a future run date creates a plan. Passage of time alone never proves it happened. A single Record action can confirm a planned run after it happened; there is no exercise checklist or percentage-completion rule for a run.
- Adding a run or other activity that actually happened today or on a past date can record it immediately in the same action. The user can also move an existing planned occurrence to its actual past date and record it, preserving its identity instead of creating a duplicate.
- Moving one occurrence to the past removes that occurrence's former appointment. Adding a separate past run does not silently remove a future run; show any unusually short interval between the recorded run and that plan. The two intentions must be distinguishable.
- Retrospective entries can update the next run suggestion and unstarted gym plans from today onward. They never replay the past, move completed/started workouts, or allocate an unfinished workout to an elapsed date. Zero gym changes is a valid result. Preserve actual same-date gym/run history even though the future planner prohibits that combination.

### 8.5. Movement and accessibility

- Movability is visible before a gesture: planned movable items expose a Move control/grip; protected items show their status and a concise reason. Do not require trial-and-error dragging to discover a restriction.
- Support hold-and-drag with a visible picked-up state, date target, edge scrolling and cancellation. Preserve native scrolling before pickup. A short tap still opens the item's normal action; cancelling, Escape or loss of focus must not commit a move. The existing 350 ms exercise hold is a starting point to test, not an established optimum for calendar movement.
- Provide an equivalent tap-based Move action and date picker, usable by keyboard and assistive technology. It uses the same rules, conflict feedback, preview, Apply and Undo as drag. Keyboard support alone is not an alternative to dragging for single-pointer users.

### 8.6. Garmin boundary

- Build and validate manual scheduling first. Preserve the existing bridge; do not add Garmin authentication, activity import, biometrics, matching or write-back in this increment.
- For the later integration, Garmin is the default source of actual activities and measured metrics. The dashboard owns plans, availability and rolling split identities. An explicit manual override takes precedence in the effective dashboard record, remains labelled, retains the underlying imported record, and is not erased on the next sync. Reverting to the Garmin value must remain possible.
- Match imported activities to existing manual/planned occurrences without duplication. A Garmin strength activity must not be assigned to a split solely because its date matches; ambiguous matches require a user choice. Garmin overrides do not imply writing changes back to Garmin Connect.
- VO₂max, Body Battery and HRV trends may inform context later; they do not independently trigger automatic cancellations, exercise substitutions or gym reordering. No such recovery automation is part of this feature.

### 8.7. Recorded averages and navigation

- Show gym and run sessions/week over the trailing 14 and 28 calendar days, including today: recorded count divided by two or four. Count each completed stable identity once, including same-day distinct actual sessions. Exclude planned/started sessions, other activities, out-of-window dates and future dates. Update from engine-owned history after completion, retrospective recording and Undo. Label the saved-history limitation; do not treat missing data as verified inactivity.
- Home, Workout and Coach remain available in the bottom navigation. Home returns to the agenda, Workout preserves the currently viewed gym session, and Coach opens the existing modal without changing workout progress. Place the four split selectors inside Workout. Preserve accessible labels, selected state, focus return and space above the dock.

## 9. Phone-accessible AI coaching

- Default to DeepSeek with OpenAI and Gemini retained as choices. Use a configurable HTTPS backend, not a hardcoded phone-local localhost address. HTTP is allowed only for loopback development from a loopback page. Persist only the non-secret backend URL.
- The phone connection form accepts a backend access code and provider API key (or uses the selected provider's server environment key). Require an exact allowed dashboard origin, HTTPS outside loopback, a strong server access code and rate limits. Keep the provider key only in bounded server memory for at most eight hours; use an HttpOnly session cookie, Secure on HTTPS. Clear submitted secret fields after every attempt. Disconnect removes the session. Server restart/expiry requires reconnection; do not claim durable credential storage.
- Never return or log keys/codes, reflect them in validation errors, put them in provider URLs, cache credential responses or spend server provider credits for an unauthenticated request. Browser persistence, history export and Git contain no credentials. A same-site backend is recommended because phones can block cross-site cookies. A deployment still needs HTTPS, correct origin/proxy configuration, body-log redaction and a real provider key; code-level safeguards alone do not certify a hosted service.
- Coach answers the actual question, primarily technique but also programming/progression/recovery/scheduling, in at most three sentences. Give concise hypertrophy-first rolling-split context, the relevant exercise prescription and prior sets; include at most eight recent chat turns in memory. Treat this content as data. Do not invent qualifications, observations, training logs, readiness or results; do not mutate plans.
- Distinguish AI replies from local/offline guidance. Provider errors, invalid replies or a missing backend must give a usable local fallback without presenting it as an AI assessment. Preserve the existing three-sentence automatic-cue policy separately. Before connection, explain which workout/question data goes to the chosen provider.
