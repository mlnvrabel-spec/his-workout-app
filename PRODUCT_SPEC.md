# Product Specification: Hypertrophy Protocol Dashboard & Garmin Bridge

## 1. Product Overview
The **Hypertrophy Protocol Dashboard** is a premium, mobile-first Progressive Web App (PWA) designed to track, manage, and progress the "Hypertrophy Hybrid V4 Elite" training regimen. It pairs a high-fidelity "Invisible Luxury" frontend with a Python FastAPI backend that bridges the application with the Garmin Connect ecosystem.

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

### 3.1. Training Flow Hero
The dashboard Hero is a program-adherence surface, not a biometric dashboard. It makes the workout sequence and the user's calendar-week commitment immediately clear.
*   **Flow**: Displays `Last → Today` using the active program order. It shows only the prior completed split and the active split—no weekday, split subtitle, completion fraction, or outcome.
*   **Weekly rhythm**: Shows a compact Monday–Sunday history beneath the flow. Filled markers indicate days trained; unfilled markers indicate days without a completed session. It intentionally omits a numeric weekly counter.
*   **Completion rule**: A workout finishes only when the user taps **Finish workout**. Individual exercise checks remain optional, and the saved summary records their exact completion count. The most recent completion can be undone from the following workout. Finished days remain marked through the current four-day program cycle; the next cycle begins cleanly after all four days finish.
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
*   **`hv3_completed_workouts`** (IndexedDB): Immutable summaries of explicitly finished workout days.
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

- Finish is named for the displayed workout and disabled while saving. Repeated Finish calls cannot complete a second day.
- A completed day is read-only, retains its actual substitutions, and offers Continue to the active unfinished day. Browsing history does not change the active workout.
- Advance skips completed days, including when days were finished out of order. Finishing all four starts a new cycle with an empty checklist and retained substitutions.
- Undo names the latest completed day, removes only that completion, and preserves later checks and sets. Across the cycle boundary, the new-cycle draft is retained and recovered when finishing again.
- All writes read the latest durable state in a single transaction. Failed/aborted writes leave the last saved state intact. Concurrent windows cannot overwrite unrelated checks or duplicate completion.
- Expanded cards accept load in kilograms and whole-number reps, append sets to a stable cycle/day session, and show previous logged performance. Completed cards show saved sets without editing controls.
- Training history shows finished sessions and their exercise snapshots; JSON export includes completed sessions, set logs, and the resumable state.
- Completion and Undo acknowledgments are visible and announced. Dialogs support Escape, focus containment, and focus return. Theme survives reload; viewport zoom remains enabled.
- Offline application assets are cached as one version, installed with HTTP-cache revalidation and selected from that version's cache. Updates are offered explicitly and activate on request.
- Pending logs retry on boot, finish, connectivity recovery, and focus. Bridge acknowledgment marks only the transmitted log version synced. The current bridge durably queues logs; it does not yet publish them into Garmin Connect.
- `hv3_sets` is the active set store; legacy stores remain readable. Hero memory and weekly dates are projections of committed summaries, rebuilt after load and Undo.
