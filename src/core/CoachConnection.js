/** Only the public backend URL is persisted. Keys/codes never enter app storage. */
export function coachBase(value, page = window.location) {
    const url = new URL(value || page.origin);
    if (url.username || url.password || url.search || url.hash || !['http:', 'https:'].includes(url.protocol)) throw new Error('Use a backend URL without credentials, query or fragment.');
    const loopback = host => ['localhost', '127.0.0.1', '[::1]'].includes(host);
    if (url.protocol !== 'https:' && !(loopback(url.hostname) && loopback(page.hostname))) throw new Error('Use an HTTPS backend address for your phone.');
    return url.href.replace(/\/$/, '');
}

export class CoachConnection {
    constructor() {
        let saved;
        try { saved = localStorage.getItem('coach_backend_url'); } catch {}
        const local = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        try { this.base = coachBase(saved || (local ? `http://${window.location.hostname}:8001` : window.location.origin)); }
        catch { this.base = window.location.origin; }
        this.connected = false;
    }

    async request(path, { method = 'GET', body } = {}) {
        if (!['session', 'chat', 'coach'].includes(path)) throw new Error('Unknown coach request.');
        if (path !== 'session' && !this.connected) throw new Error('Connect your coach before sharing workout data.');
        const response = await fetch(`${this.base}/api/ai/${path}`, {
            method, credentials: 'include', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
            headers: body ? { 'Content-Type': 'application/json' } : {},
            ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(25000)
        });
        let data;
        try { data = await response.json(); } catch { throw new Error('The coach backend is not available at this address. Hosting setup may be needed.'); }
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) this.connected = false;
            // An untrusted/misconfigured endpoint may echo submitted secrets in detail.
            const messages = { 401: 'Incorrect access code or expired session.', 403: 'This dashboard is not allowed by the coach backend.', 429: 'Too many requests. Please try again later.', 503: 'Coach backend setup is incomplete.' };
            throw new Error(messages[response.status] || 'Coach request failed. Check the connection and required fields.');
        }
        return data;
    }

    async status() {
        this.connected = false;
        const data = await this.request('session');
        this.connected = data.connected === true;
        this.provider = data.provider;
        return data;
    }

    async connect(base, provider, accessCode, apiKey) {
        this.connected = false;
        this.base = coachBase(base);
        await this.request('session', { method: 'POST', body: { provider, access_code: accessCode, ...(apiKey ? { api_key: apiKey } : {}) } });
        await this.status();
        if (!this.connected) throw new Error('The browser did not retain the session. Use a backend on the same site as your dashboard.');
        try { localStorage.setItem('coach_backend_url', this.base); } catch {}
    }

    async disconnect() {
        await this.request('session', { method: 'DELETE' });
        this.connected = false;
    }
}
