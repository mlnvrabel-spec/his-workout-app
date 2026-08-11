/**
 * AuthUI.js
 * 
 * Manages the Garmin Login/MFA user interface.
 * Appears when the back-end bridge requires authentication.
 */

export class AuthUI {
    constructor(garminSync) {
        this.garminSync = garminSync;
        this.email = '';
        this.isMfaMode = false;
        this.isLoading = false;
        
        this.injectStyles();
        this.render();
    }

    injectStyles() {
        const style = document.createElement('style');
        style.textContent = `
            #auth-overlay {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(20px);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.5s ease;
            }

            #auth-overlay.visible {
                opacity: 1;
                pointer-events: all;
            }

            .auth-card {
                width: 90%;
                max-width: 400px;
                padding: 40px;
                background: rgba(28, 28, 30, 0.6);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 32px;
                text-align: center;
                box-shadow: 0 20px 40px rgba(0,0,0,0.5);
            }

            .auth-title {
                font-family: 'DM Serif Display', serif;
                font-size: 28px;
                margin-bottom: 8px;
                color: #fff;
            }

            .auth-subtitle {
                font-size: 14px;
                color: rgba(255, 255, 255, 0.5);
                margin-bottom: 32px;
                line-height: 1.5;
            }

            .auth-input-group {
                margin-bottom: 20px;
                text-align: left;
            }

            .auth-label {
                display: block;
                font-size: 11px;
                text-transform: uppercase;
                letter-spacing: 1px;
                color: var(--amber, #ffd700);
                margin-bottom: 8px;
                margin-left: 4px;
            }

            .auth-input {
                width: 100%;
                background: rgba(255, 255, 255, 0.05);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 14px;
                padding: 16px;
                color: #fff;
                font-size: 16px;
                outline: none;
                transition: border-color 0.3s ease;
            }

            .auth-input:focus {
                border-color: rgba(255, 255, 255, 0.3);
            }

            .auth-button {
                width: 100%;
                background: #fff;
                color: #000;
                border: none;
                border-radius: 14px;
                padding: 16px;
                font-weight: 600;
                font-size: 16px;
                cursor: pointer;
                margin-top: 12px;
                transition: transform 0.2s active;
            }

            .auth-button:active {
                transform: scale(0.98);
            }

            .auth-button:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .auth-error {
                margin-top: 16px;
                color: #ff4d4d;
                font-size: 13px;
                display: none;
            }
            
            .auth-loading-spinner {
                display: none;
                margin: 20px auto;
                width: 30px; height: 30px;
                border: 2px solid rgba(255,255,255,0.1);
                border-top-color: #fff;
                border-radius: 50%;
                animation: spin 1s linear infinite;
            }

            .auth-skip {
                display: block;
                margin-top: 20px;
                color: rgba(255,255,255,0.35);
                font-size: 13px;
                cursor: pointer;
                text-decoration: none;
                transition: color 0.2s;
            }

            .auth-skip:hover {
                color: rgba(255,255,255,0.6);
            }

            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }

    render() {
        const overlay = document.createElement('div');
        overlay.id = 'auth-overlay';
        overlay.innerHTML = `
            <div class="auth-card">
                <div class="auth-title">Connect Garmin</div>
                <div class="auth-subtitle">Verify your identity to bridge live biometrics to your dashboard.</div>
                
                <div id="login-fields">
                    <div class="auth-input-group">
                        <label class="auth-label">Email</label>
                        <input type="email" id="auth-email" class="auth-input" placeholder="name@example.com">
                    </div>
                    <div class="auth-input-group">
                        <label class="auth-label">Password</label>
                        <input type="password" id="auth-pass" class="auth-input" placeholder="••••••••">
                    </div>
                </div>

                <div id="mfa-fields" style="display: none;">
                    <div class="auth-input-group">
                        <label class="auth-label">Verification Code</label>
                        <input type="text" id="auth-mfa" class="auth-input" placeholder="6-digit code" maxlength="6">
                    </div>
                </div>

                <div class="auth-loading-spinner" id="auth-loader"></div>
                <div class="auth-error" id="auth-err"></div>

                <button class="auth-button" id="auth-submit">Continue</button>
                <a class="auth-skip" id="auth-skip">Use without Garmin →</a>
            </div>
        `;
        document.body.appendChild(overlay);

        this.els = {
            overlay,
            loginFields: document.getElementById('login-fields'),
            mfaFields: document.getElementById('mfa-fields'),
            email: document.getElementById('auth-email'),
            pass: document.getElementById('auth-pass'),
            mfa: document.getElementById('auth-mfa'),
            submit: document.getElementById('auth-submit'),
            error: document.getElementById('auth-err'),
            loader: document.getElementById('auth-loader'),
            title: overlay.querySelector('.auth-title'),
            subtitle: overlay.querySelector('.auth-subtitle')
        };

        this.els.skip = document.getElementById('auth-skip');

        this.els.submit.addEventListener('click', () => this.handleSubmit());
        this.els.skip.addEventListener('click', () => this.hide());

        // Enter key support on all inputs
        const submitOnEnter = (e) => { if (e.key === 'Enter') this.handleSubmit(); };
        this.els.email.addEventListener('keydown', submitOnEnter);
        this.els.pass.addEventListener('keydown', submitOnEnter);
        this.els.mfa.addEventListener('keydown', submitOnEnter);
    }

    show(mode = 'login') {
        if (mode === 'offline') {
            this.els.title.innerText = 'Bridge Offline';
            this.els.subtitle.innerText = 'The Garmin Bridge server is not running. Start it with:\npython -m uvicorn main:app --port 8001';
            this.els.loginFields.style.display = 'none';
            this.els.submit.style.display = 'none';
        } else {
            this.els.title.innerText = 'Connect Garmin';
            this.els.subtitle.innerText = 'Verify your identity to bridge live biometrics to your dashboard.';
            this.els.loginFields.style.display = 'block';
            this.els.submit.style.display = 'block';
        }
        this.els.overlay.classList.add('visible');
    }

    hide() {
        this.els.overlay.classList.remove('visible');
    }

    async handleSubmit() {
        if (this.isLoading) return;
        
        this.setLoading(true);
        this.hideError();

        try {
            if (!this.isMfaMode) {
                const email = this.els.email.value;
                const pass = this.els.pass.value;
                
                if (!email || !pass) throw new Error('Please enter credentials');
                
                this.email = email;
                const result = await this.garminSync.login(email, pass);
                
                if (result.status === 'MFA_REQUIRED') {
                    this.switchToMfa();
                } else {
                    this.onSuccess();
                }
            } else {
                const code = this.els.mfa.value;
                if (!code) throw new Error('Enter the 6-digit code');
                
                await this.garminSync.verifyMfa(this.email, code);
                this.onSuccess();
            }
        } catch (err) {
            this.showError(err.message);
        } finally {
            this.setLoading(false);
        }
    }

    switchToMfa() {
        this.isMfaMode = true;
        this.els.loginFields.style.display = 'none';
        this.els.mfaFields.style.display = 'block';
        this.els.title.innerText = 'One-Time Code';
        this.els.subtitle.innerText = `We've sent a code to ${this.email}. Please enter it below.`;
    }

    setLoading(loading) {
        this.isLoading = loading;
        this.els.loader.style.display = loading ? 'block' : 'none';
        this.els.submit.disabled = loading;
        this.els.submit.innerText = loading ? 'Authenticating...' : 'Continue';
    }

    showError(msg) {
        this.els.error.innerText = msg;
        this.els.error.style.display = 'block';
    }

    hideError() {
        this.els.error.style.display = 'none';
    }

    onSuccess() {
        this.hide();
        // Trigger a fresh render to show the newly synced data
        window.dispatchEvent(new CustomEvent('garminConnected'));
    }
}
