/**
 * GarminSync.js
 * 
 * Connects the Hypertrophy Protocol dashboard to the Garmin Connect Bridge (FastAPI).
 * Handles biometric readiness data fetching, caching, and workout publishing.
 * Emits CustomEvents for the UI layer (Kai.js) to consume.
 */
import { StorageManager } from './StorageManager.js?v=2';

export class GarminSync {
    constructor(baseUrl = 'http://localhost:8001') {
        this.baseUrl = baseUrl;
        this.isAuthenticated = false;
        this._cache = null;
        this._cacheTime = 0;
        this._cacheTTL = 300000; // 5 minute client-side cache
        this.storage = new StorageManager();
        
        // Listen for completed workouts to potentially sync them back to Garmin
        window.addEventListener('cycleCompleted', (e) => {
            this.syncWorkoutData(e.detail);
        });

        // Listen for offline queue syncs passing WorkoutLog
        window.addEventListener('workout:sync_queued', async (e) => {
            const logs = Array.isArray(e.detail) ? e.detail : [e.detail];
            if (logs[0]) {
                await this.syncOfflineLogs(logs);
            }
        });
    }

    /**
     * Broadcasts connection status to UI (pill and settings panel)
     */
    emitStatus(live) {
        window.dispatchEvent(new CustomEvent('garminStatusChanged', { detail: { live } }));
    }

    /**
     * Delete session on backend and clear local state
     */
    async disconnect() {
        try {
            await fetch(this.baseUrl + '/auth/session', { method: 'DELETE' });
        } catch (e) {
            console.error('[GarminSync] Disconnect error', e);
        }
        this.isAuthenticated = false;
        this._cache = null;
        this.emitStatus(false);
    }

    /**
     * Attempt to connect to the local FastAPI bridge.
     * Tests the root endpoint — if it responds, the bridge is alive and auth tokens exist.
     */
    async asyncConnect() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            
            const res = await fetch(this.baseUrl + '/', { signal: controller.signal });
            clearTimeout(timeout);
            
            if (res.ok) {
                this.isAuthenticated = true;
                this.emitStatus(true);
                console.log('[GarminSync] ✅ Bridge connected at', this.baseUrl);
                
                // Immediately fetch readiness on connect
                this.fetchReadiness();
            } else if (res.status === 401) {
                // Session missing or expired → show login
                this.isAuthenticated = false;
                this.emitStatus(false);
                window.dispatchEvent(new CustomEvent('garminUnauthorized'));
            }
        } catch (err) {
            // Bridge is completely unreachable (not running)
            this.isAuthenticated = false;
            this.emitStatus(false);
            console.log('[GarminSync] ⚡ Bridge offline — server not running');
            window.dispatchEvent(new CustomEvent('garminOffline'));
        }
    }

    /**
     * Public alias for boot sequence
     */
    connect() {
        this.asyncConnect();
    }

    /**
     * Send credentials to the bridge to start session
     */
    async login(email, password) {
        try {
            const res = await fetch(this.baseUrl + '/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await res.json();

            if (res.status === 401 && data.detail === 'MFA_REQUIRED') {
                return { status: 'MFA_REQUIRED' };
            }

            if (res.ok) {
                this.isAuthenticated = true;
                this.emitStatus(true);
                this.fetchReadiness();
                return { status: 'SUCCESS' };
            }

            throw new Error(data.detail || 'Login failed');
        } catch (err) {
            console.error('[GarminSync] ⚡ Login error:', err.message);
            throw err;
        }
    }

    /**
     * Send MFA code to the bridge to complete session
     */
    async verifyMfa(email, code) {
        try {
            const res = await fetch(this.baseUrl + `/auth/mfa?email=${encodeURIComponent(email)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            });

            const data = await res.json();

            if (res.ok) {
                this.isAuthenticated = true;
                this.emitStatus(true);
                this.fetchReadiness();
                return { status: 'SUCCESS' };
            }

            throw new Error(data.detail || 'MFA failed');
        } catch (err) {
            console.error('[GarminSync] ⚡ MFA error:', err.message);
            throw err;
        }
    }

    /**
     * Fetch biometric readiness data from the bridge.
     * Returns { body_battery, hrv_status, sleep_score, readiness_score }
     * Emits 'garminReadinessUpdated' CustomEvent with the data.
     */
    async fetchReadiness() {
        // Client-side cache check
        const now = Date.now();
        if (this._cache && (now - this._cacheTime < this._cacheTTL)) {
            window.dispatchEvent(new CustomEvent('garminReadinessUpdated', { detail: this._cache }));
            return this._cache;
        }
        
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            
            const res = await fetch(this.baseUrl + '/sync/readiness', {
                signal: controller.signal
            });
            clearTimeout(timeout);
            
            if (res.status === 401) {
                // Session expired mid-use — re-trigger login
                this.isAuthenticated = false;
                this.emitStatus(false);
                window.dispatchEvent(new CustomEvent('garminUnauthorized'));
                window.dispatchEvent(new CustomEvent('garminReadinessUpdated', { detail: null }));
                return null;
            }
            
            if (!res.ok) throw new Error('Bridge returned ' + res.status);
            
            const data = await res.json();
            console.log('[GarminSync] 🏋️ Readiness data:', data);
            
            const biometricScore = data.biometric_score ?? data.readiness_score;
            const consistencyRatio = this.storage.getWeeklyStats().consistencyRatio;
            data.biometric_score = biometricScore;
            data.consistency_score = Math.round(consistencyRatio * 100);
            data.readiness_score = Math.round((biometricScore * 0.6) + (data.consistency_score * 0.4));

            // Cache
            this._cache = data;
            this._cacheTime = Date.now();
            
            // Broadcast to UI
            window.dispatchEvent(new CustomEvent('garminReadinessUpdated', { detail: data }));
            
            return data;
            
        } catch (err) {
            console.log('[GarminSync] ⚡ Readiness fetch failed:', err.message);
            window.dispatchEvent(new CustomEvent('garminReadinessUpdated', { detail: null }));
            return null;
        }
    }

    /**
     * Push logged workouts back to Garmin Connect via the bridge.
     */
    async syncWorkoutData(workoutData) {
        if (!this.isAuthenticated) return;
        
        try {
            const res = await fetch(this.baseUrl + '/workouts/publish', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(workoutData)
            });
            
            if (res.ok) {
                console.log('[GarminSync] ✅ Workout synced to Garmin Connect');
                window.dispatchEvent(new CustomEvent('garminWorkoutSynced'));
            }
        } catch (err) {
            console.log('[GarminSync] ⚡ Workout sync failed:', err.message);
        }
    }

    /**
     * Attempts to push the offline queue array to the FastAPI backend.
     * @param {Array} logs - Array of WorkoutLog objects matching the API contract
     */
    async syncOfflineLogs(logs) {
        const queuedLogs = structuredClone(logs);
        window.dispatchEvent(new CustomEvent('network:state_change', {
            detail: { state: 'SYNCING' }
        }));

        try {
            const response = await fetch(this.baseUrl + '/sync/workout', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(queuedLogs)
            });

            if (response.ok || response.status === 202) {
                window.dispatchEvent(new CustomEvent('workout:sync_completed', {
                    detail: { logs: queuedLogs }
                }));
                window.dispatchEvent(new CustomEvent('network:state_change', {
                    detail: { state: 'LIVE' }
                }));
            } else {
                window.dispatchEvent(new CustomEvent('network:state_change', {
                    detail: { state: 'CACHED' }
                }));
            }
        } catch (error) {
            console.warn('[GarminSync] Background sync failed, backend unreachable.', error);
            window.dispatchEvent(new CustomEvent('network:state_change', {
                detail: { state: 'CACHED' }
            }));
        }
    }

}
