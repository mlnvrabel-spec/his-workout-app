# Skill: PWA Offline-First Sync Engine

## State Flow
1. **User Action:** Logs a set.
2. **Local Write:** Immediately write to `hv3_logs` in IndexedDB.
3. **Dispatch:** Dispatch `dispatch('workout:sync_queued')`. UI shows a subtle grey "cloud" icon.
4. **Bridge Attempt:** Atlas attempts to push to FastAPI.
   - *If Success:* Dispatch `dispatch('workout:sync_success')`. UI cloud icon turns gold.
   - *If Fail (Offline):* Service Worker registers a `SyncManager` background sync task. Leave cloud icon grey.

## Constraints
- NEVER block the UI waiting for the FastAPI backend.
- Local IndexedDB is the Single Source of Truth until the `sync_success` event is fired.