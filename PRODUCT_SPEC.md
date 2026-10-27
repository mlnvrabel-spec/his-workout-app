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

### 3.1. Workout view
The dated agenda owns dates and recent training history. The workout view shows its selected split, session selectors and exercise checklist. Do not repeat a Last → Today panel or weekly strip above the exercises. Preserve completion feedback and its accessible announcement after removing that panel.
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
*   **`hv3_memory`** (localStorage): Legacy last-completed-split data (`title`, `subtitle`, and local completion timestamp), retained for compatibility; no separate Training Flow Hero is rendered.
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
*   **Header status**: History is icon-only with an accessible name. Connection state is a small, noninteractive dot: filled for LIVE, hollow for CACHED and dashed for SYNCING, with explicit accessible descriptions and tooltips. Do not repeat visible state text or add a button surface around the dot.
*   **Shared top bar**: Calendar and Workout use the same compact, fixed-height sticky header, title typography and aligned icon controls. Calendar and Workout show their page titles; the selected split is visible in the compact session selector and included in the Workout heading’s accessible name. Appearance selection lives in Settings. Omit taglines, muscle-focus subtitles and the large decorative logo. Keep 48 px control targets and safe-area spacing. Coach uses the same title style within its existing overlay.

---
*Created by Antigravity AI — Pair Programmed with User*


## 6. Workout reliability and review

### Recording-flow refinement

- Preserve the 50% counting rule and next-day progression. Present automatic qualification as **Counted toward training**, with **Still editable today** while applicable; reserve **Finished** for explicit Finish. History, agenda and workout use the same distinction. This clarifies existing rules rather than changing them.
- Finish explicitly communicates that it checks every remaining exercise. Completion Undo explicitly communicates that it clears checks while retaining sets and later progress. Keep ordinary completion actions direct, without a mandatory confirmation dialog.
- Quick logs record load and reps, leaving actual RPE unreported. Prescribed RIR remains a target, never a measured effort. Explicitly supplied effort has provenance; legacy numeric effort without provenance remains intact and is labelled unverified. Apply this contract to history, export, coaching and the bridge queue.
- An editable session offers Edit set for load/reps. Corrections retain the set number, exercise/session identity, original timestamp and effort provenance; persist atomically, reject stale edits to the same set, and requeue the corrected log. Finished history remains read-only. Old sync acknowledgments cannot acknowledge corrected records.
- Expanded exercises prioritize logging. Technique, mistakes and longer guidance share a secondary disclosure. Exercise alternatives and order changes have a labelled action entry as well as gesture/keyboard shortcuts.
- Browser Back dismisses the current overlay before leaving the underlying view. Close/Escape and Forward remain consistent; focus and unsaved form values survive ordinary overlay navigation. Authentication secrets are still cleared when its overlay closes.

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
- Each calendar date has one visual group. Multiple genuine items share its surface; office/rest constraints are compact context when shown with a workout/activity, retaining any available Move action and their underlying records. Do not create another apparent date card or erase history to simplify the display.
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

- Every agenda item is a keyboard-accessible, whole-row button that opens its own details, including future-cycle and protected entries. Keep repeated Planned/Open/Move/Fixed copy off the rows; retain status and restriction descriptions in accessible names and details. A small completed check or in-progress mark may identify actual training. This user-requested refinement supersedes the earlier always-visible Move/grip requirement.
- Support hold-and-drag with a visible picked-up state, date target, edge scrolling and cancellation. Preserve native scrolling before pickup. A short tap still opens the item's normal action; cancelling, Escape or loss of focus must not commit a move. The existing 350 ms exercise hold is a starting point to test, not an established optimum for calendar movement.
- Details provide a date picker for editable items, Delete and applicable workout/activity actions. Date changes use the same rules, conflict feedback, preview, Apply and Undo as drag. Recorded/started details explain their protected dates; available workout content remains viewable. Future-cycle details must never open or mutate a same-named current-cycle workout.
- Delete directly removes a planned occurrence with calendar Undo. An explicitly deleted gym occurrence stays skipped on reload and is excluded from advancement/cycle completion requirements, never recorded as completed or included in averages. Later occurrences retain their identities and dates. Undo restores both the plan and the prior active split. Started/completed entries remain protected. Explicitly starting a skipped split in Workout restores that session's identity and preserves its new checks/sets.

### 8.6. Garmin boundary

- Build and validate manual scheduling first. Preserve the existing bridge; do not add Garmin authentication, activity import, biometrics, matching or write-back in this increment.
- For the later integration, Garmin is the default source of actual activities and measured metrics. The dashboard owns plans, availability and rolling split identities. An explicit manual override takes precedence in the effective dashboard record, remains labelled, retains the underlying imported record, and is not erased on the next sync. Reverting to the Garmin value must remain possible.
- Match imported activities to existing manual/planned occurrences without duplication. A Garmin strength activity must not be assigned to a split solely because its date matches; ambiguous matches require a user choice. Garmin overrides do not imply writing changes back to Garmin Connect.
- VO₂max, Body Battery and HRV trends may inform context later; they do not independently trigger automatic cancellations, exercise substitutions or gym reordering. No such recovery automation is part of this feature.

### 8.7. Recorded averages and navigation

- Show gym and run sessions/week over the trailing 14 and 28 calendar days, including today: recorded count divided by two or four. Count each completed stable identity once, including same-day distinct actual sessions. Exclude planned/started sessions, other activities, out-of-window dates and future dates. Update from engine-owned history after completion, retrospective recording and Undo. Label the saved-history limitation; do not treat missing data as verified inactivity.
- Training averages are always visible as one compact table, with Gym/Runs and trailing 14/28-day per-week values. Keep the units and recorded-only basis visible; expose exact counts in accessible cell labels. Do not repeat values or require disclosure expansion.
- Workout is the first/default destination; Calendar is second. Workout preserves the currently viewed session, while Calendar exposes past records and future plans. Coach remains a modal action in a separate circular button beside the two navigation tabs. Preserve accessible labels, selected state, focus return and space above the dock. The four split selectors use their workout names without D1–D4 subtitles.

## 9. Phone-accessible AI coaching

- Default to DeepSeek with OpenAI and Gemini retained as choices. Use a configurable HTTPS backend, not a hardcoded phone-local localhost address. HTTP is allowed only for loopback development from a loopback page. Persist only the non-secret backend URL.
- The phone connection form accepts a backend access code and provider API key (or uses the selected provider's server environment key). Require an exact allowed dashboard origin, HTTPS outside loopback, a strong server access code and rate limits. Keep the provider key only in bounded server memory for at most eight hours; use an HttpOnly session cookie, Secure on HTTPS. Clear submitted secret fields after every attempt. Disconnect removes the session. Server restart/expiry requires reconnection; do not claim durable credential storage.
- Never return or log keys/codes, reflect them in validation errors, put them in provider URLs, cache credential responses or spend server provider credits for an unauthenticated request. Browser persistence, history export and Git contain no credentials. A same-site backend is recommended because phones can block cross-site cookies. A deployment still needs HTTPS, correct origin/proxy configuration, body-log redaction and a real provider key; code-level safeguards alone do not certify a hosted service.
- Coach answers the actual question, primarily technique but also programming/progression/recovery/scheduling, in at most three sentences. Give concise hypertrophy-first rolling-split context, the relevant exercise prescription and prior sets; include at most eight recent chat turns in memory. Treat this content as data. Do not invent qualifications, observations, training logs, readiness or results; do not mutate plans.
- Distinguish AI replies from local/offline guidance. Provider errors, invalid replies or a missing backend must give a usable local fallback without presenting it as an AI assessment. Preserve the existing three-sentence automatic-cue policy separately. Before connection, explain which workout/question data goes to the chosen provider.

### 10. Browser-feedback refinements (20 October 2026)

This accepted update supersedes earlier presentation wording where it conflicts:
- Header icons retain accessible names and 48 px hit areas, without filled circular backgrounds. Use Inter throughout Home, Workout and dialogs.
- Exercise numbers retain their existing tap/keyboard/hold movement controls without the visible Actions label. Saved sets use compact wrapping tiles with Edit. Effort provenance stays in the editor, history, coaching context and export; it is omitted from the main set list.
- Coach remains an overlay within the visible viewport, including visualViewport height and offset changes. Keep its header/close and composer visible; connection setup uses a scrollable panel and temporarily hides the conversation/composer. Retain the current primary Coach entry.
- Use REST as the only rest label in Add, calendar and recurrence controls. REST repeats on Mondays and Thursdays by default. Present existing Office constraints as REST; retain stored identities and editable recurrence so no hidden rule changes the calendar.
- A past Rest entry records rest without moving current/future gym sessions. Reject duplicate rest or conflict with recorded/started training. Preserve recorded history and the existing schedule preview, Apply and Undo flow.
- History export is a readable, private JSON file with workout dates, sets and schedule data; it excludes connection credentials and Coach messages. Inform the user beside Export.
- Do not transmit workout/question/readiness context until a Coach session is confirmed. Clear stale connected state on a failed session check. Do not display raw backend errors that might echo credentials; clear credential drafts when Coach closes. Use no-store on all Coach HTTP responses, including errors.

### 11. Backfill and recalculate (21 October 2026)

This user-requested extension supersedes §10's statement that past REST leaves future dates unchanged.
- Add supports a past gym session, run, REST or other activity. For gym, require an explicit choice of Push A, Pull A, Push B or Pull B from the protocol, on a date before today. Do not silently substitute the next planned workout. Use the normal checklist for today's gym training.
- The 23 October 2026 selection extension continues future training after the chosen workout, including when it differs from the old plan or is an older/repeated record. Reuse the next unstarted session when the choice matches its order and chronology; otherwise replace only unstarted gym plans with a fresh rolling cycle starting at the chosen workout's successor. Preserve that rotation across subsequent cycles. Replaced plans are never counted as completed. This explicitly supersedes §8's prohibition on calendar-driven cycle changes for this backfill action only.
- Existing started/completed sessions, checks, sets and non-gym appointments remain protected. Refuse a split restart while a workout or saved next-cycle draft has progress. Do not overwrite recorded history to accommodate a chosen workout. Explain the future starting workout in the Add form.
- A past gym workout uses one **Save workout** action. Validate and commit the record plus recalculated schedule without a separate review/confirmation screen. Prevent duplicate submits; keep the form and selection on validation or write failure. Announce success with Undo available. Future planned dates remain editable. This user-requested shortcut supersedes the preview requirement below and in §8 for past gym recording only; other calendar edits keep their existing preview.
- Past gym recording means the session was performed; it does not invent sets or exercise checks. Save a durable summary marked manual_backfill, expose that distinction in History/export, advance the active split and adopt the next cycle when needed. A past gym record may coexist with a recurring REST constraint as actual history, but may not overwrite an explicit recorded REST or another gym session on the date.
- Adding or moving a performed activity to a past date recalculates unfinished gym sessions from today. Preserve split order, Monday/Thursday REST rules and other non-gym appointments, started/completed records and the four-per-week planning target. Recalculation may bring previously delayed planned gym dates forward; show every date change before Apply except for the direct past-gym save above. Actual backfills count in recorded training statistics.
- Preview is read-only. Apply recomputes against the latest durable state and atomically commits gym history plus schedule. Failed writes leave both unchanged. Calendar Undo removes the just-added gym summary and restores the previous active split/schedule, including across a cycle boundary; reject Undo after intervening training/calendar changes. Date rollover and another window's edits invalidate stale previews.
- Manual past gym entries without exercise checks or saved sets allow correcting the workout performed or deleting that entry from its details. This is a narrow exception to protected history: real started/finished/counting sessions remain protected. Corrections update history and recorded averages atomically, preserve existing future plans and other training, survive reload, and offer guarded calendar Undo independently of the original entry's Undo. They never assign saved sets to a different workout.


### 12. Calendar hierarchy and navigation — 23 October 2026

- The user selected Workout first/default, Calendar second and a separate Coach launcher. This supersedes earlier Home/default-agenda wording. Calendar is a destination for dates and planning; Today is its jump action, not a separate page.
- Keep one Add action per date. Remove the duplicate global Add and selected-day summary/CTA. Calendar keeps a month heading, Today, Undo only when available and an accessible recurring-rest-days control. Preserve the always-visible recorded-averages table and the existing item details, deletion, date editing and backfill flows.
- Display Rest in title case, with the same title typography as other normal calendar entries. Empty past days leave the activity area visually empty, with accessible “No activity recorded” text and the per-date Add action. Missing records never create confirmed rest, completion records or statistics; future empty dates can suggest Rest without recording it.
- Use aligned gutters, moderate corner radii, quiet exercise surfaces and a clearly selected workout segment. Keep existing completion marks, keyboard focus, touch targets and safe-area clearance.
- Settings uses a one-tap Dark mode switch: on is dark, off is light. Keep the saved theme preference and native keyboard interaction. A softly masked blur behind the bottom navigation separates scrolling content without intercepting touch; respect reduced-transparency preferences.
