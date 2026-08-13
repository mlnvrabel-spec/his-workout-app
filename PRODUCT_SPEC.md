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
    *   `SettingsPanel.js`: Configuration for weights, units, and API keys.
    *   `Elena.css`: The "Dark Luxe" design system and animations.
*   **`/src/data/`**: The "Protocol Data". Contains `core_protocol.json` (The Single Source of Truth for exercise programming).
*   **`/backend/`**: The "Atlas Systems" Python FastAPI bridge.
*   **`/public/`**: The "App Shell". Contains `manifest.json` and `service-worker.js`.

## 3. Core Features

### 3.1. Training Flow Hero
The dashboard Hero is a program-adherence surface, not a biometric dashboard. It makes the workout sequence and the user's calendar-week commitment immediately clear.
*   **Flow**: Displays `Last → Today` using the active program order. It shows only the prior completed split and the active split—no weekday, split subtitle, completion fraction, or outcome.
*   **Weekly rhythm**: Shows a compact Monday–Sunday history beneath the flow. Filled markers indicate days trained; unfilled markers indicate days without a completed session. It intentionally omits a numeric weekly counter.
*   **Completion rule**: A workout can be explicitly finished at any time. Individual exercise checks remain optional, and the saved summary records their exact completion count. Finished days remain marked through the current four-day program cycle; the next cycle begins cleanly after all four days finish.
*   **Live progress**: Current-workout exercise completion is communicated by the checklist itself; no redundant segmented progress row is shown.

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
*   **Persona**: PhD in Kinesiology, utilizing principles from Dr. Andrew Galpin and Jeff Nippard (RPE 8-9, 3-second eccentrics).
*   **Capabilities**:
    *   Triggered pre-exercise and post-workout.
    *   Enforces progressive overload (+2.5kg or +1 rep) based on current Garmin Readiness.
    *   Outputs strictly 3 sentences of biomechanical form cues and load targets.

## 4. State & Data Persistence
Data structures are strictly defined via JSDoc in `skill-data-schema.md` to prevent AI hallucination.
*   **`hv3_active_workout`** (IndexedDB): The canonical, resumable current-cycle checklist state (selected day, checked exercises, and completed days).
*   **`hv3_completed_workouts`** (IndexedDB): Immutable summaries of explicitly finished workout days.
*   **`hv3_logs` / `hv3_archive`** (IndexedDB): Reserved legacy set-log storage; it is not part of checklist completion.
*   **`hv3_memory`** (localStorage): Last fully completed split (`title`, `subtitle`, and local completion timestamp) for the Training Flow Hero.
*   **`hv3_completed_sessions`** (localStorage): Unique local calendar dates of fully completed sessions; used to derive the current Monday–Sunday commitment.

## 5. Aesthetics & UX
*   **Dark Luxe Theme**: Pure black (`#000`) and deep charcoals with glassmorphism overlays.
*   **Ambient Background**: A subtle, interactive Three.js vertex field (`index.html`) provides a high-end feel.
*   **Haptic Feedback Language**:
    *   **75ms Pulse**: Single "click" for stepper adjustments (weights/reps).
    *   **Double Pulse**: Confirmation for manual log saves.
    *   **Heavy Long Vibration**: Rewarding "thud" triggered upon completing all exercises for the day.
*   **Interaction Patterns**:
    *   **Long-Press Reset**: Holding a day tab (e.g., "D1") in the navigation dock triggers a progress reset for that specific day.
*   **Training Flow**: The compact Hero presents only the prior and active split as a concise timeline.
*   **Motion**: The Training Flow Hero enters with a smooth ease-out transition.

---
*Created by Antigravity AI — Pair Programmed with User*
