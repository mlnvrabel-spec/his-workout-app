/**
 * SettingsPanel.js
 * 
 * A slide-in settings drawer accessible via the gear icon in the header.
 * Manages Garmin connection state visually and lets the user connect/disconnect at any time.
 */

export class SettingsPanel {
    constructor(garminSync, authUI) {
        this.garminSync = garminSync;
        this.authUI = authUI;
        this.isOpen = false;
        this.isLive = false;

        this.render();
        this.attachListeners();
    }

    render() {
        // Backdrop
        const backdrop = document.createElement('div');
        backdrop.id = 'settings-backdrop';
        document.body.appendChild(backdrop);

        // Panel
        const panel = document.createElement('div');
        panel.id = 'settings-panel';
        panel.innerHTML = `
            <div class="settings-header">
                <div class="settings-title">Preferences</div>
                <button class="settings-close" id="settings-close" aria-label="Close">✕</button>
            </div>
            <div class="settings-body">
                <div class="settings-section-label">Garmin Sync</div>
                <div class="settings-row" id="garmin-settings-row">
                    <div class="settings-row-info">
                        <div class="settings-row-label">Garmin Connect</div>
                        <div class="settings-row-sub" id="garmin-settings-sub">Not connected</div>
                    </div>
                    <button class="settings-action-btn connect" id="garmin-action-btn">Connect</button>
                </div>

                <div class="settings-section-label">About</div>
                <div class="settings-row">
                    <div class="settings-row-info">
                        <div class="settings-row-label">Hypertrophy Protocol</div>
                        <div class="settings-row-sub">v2.0 · Dark Luxe PWA</div>
                        <div class="settings-row-sub">Build 2026.08.11.25</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        this.els = {
            backdrop,
            panel,
            close: document.getElementById('settings-close'),
            actionBtn: document.getElementById('garmin-action-btn'),
            sub: document.getElementById('garmin-settings-sub'),
        };
    }

    attachListeners() {
        // Gear button opens panel
        document.getElementById('settings-btn').addEventListener('click', () => this.open());

        // Close via × or backdrop
        this.els.close.addEventListener('click', () => this.close());
        this.els.backdrop.addEventListener('click', () => this.close());

        // Connect / Disconnect action
        this.els.actionBtn.addEventListener('click', () => {
            if (this.isLive) {
                this.garminSync.disconnect();
            } else {
                this.close();
                // Short delay so panel animates out before login slides in
                setTimeout(() => this.authUI.show('login'), 300);
            }
        });

        // React to status changes from GarminSync
        window.addEventListener('garminStatusChanged', (e) => {
            this.updateRow(e.detail.live);
        });
    }

    open() {
        this.isOpen = true;
        this.els.backdrop.classList.add('open');
        this.els.panel.classList.add('open');
    }

    close() {
        this.isOpen = false;
        this.els.backdrop.classList.remove('open');
        this.els.panel.classList.remove('open');
    }

    updateRow(live) {
        this.isLive = live;
        if (live) {
            this.els.sub.innerText = 'Connected';
            this.els.actionBtn.innerText = 'Disconnect';
            this.els.actionBtn.className = 'settings-action-btn disconnect';
        } else {
            this.els.sub.innerText = 'Not connected';
            this.els.actionBtn.innerText = 'Connect';
            this.els.actionBtn.className = 'settings-action-btn connect';
        }
    }
}
