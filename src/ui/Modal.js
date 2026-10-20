// Shared focus and visibility behavior for the existing overlay surfaces.
export class Modal {
    constructor(element, onClose, label, onReopen = null) {
        this.element = element;
        this.onClose = onClose;
        this.onReopen = onReopen || (() => this.open());
        this.historyId = `${Date.now()}-${Math.random()}`;
        Modal.connectHistory();
        Modal.instances.set(this.historyId, this);
        element.hidden = true;
        element.inert = true;
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'true');
        element.setAttribute('aria-label', label);
        element.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key !== 'Tab') return;
            const controls = [...element.querySelectorAll('button, input, select, textarea, summary, a[href], [tabindex="0"]')]
                .filter(node => !node.disabled && node.getClientRects().length && !node.closest('[hidden]'));
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus({ preventScroll: true }); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus({ preventScroll: true }); }
        });
    }
    static connectHistory() {
        if (Modal.historyWindow === window) return;
        Modal.historyWindow = window;
        Modal.instances = new Map();
        Modal.active = null;
        Modal.pendingBack = false;
        Modal.queuedOpen = null;
        Modal.navigating = false;
        window.addEventListener('popstate', event => {
            Modal.navigating = true;
            Modal.pendingBack = false;
            const target = Modal.instances.get(event.state?.hypertrophyDialog);
            if (Modal.active && Modal.active !== target) Modal.active.onClose();
            if (Modal.queuedOpen) {
                const queued = Modal.queuedOpen;
                Modal.queuedOpen = null;
                Modal.navigating = false;
                queued.onReopen();
                return;
            }
            if (target && target !== Modal.active) target.onReopen();
            Modal.navigating = false;
        });
    }
    open() {
        if (Modal.pendingBack) { Modal.queuedOpen = this; return; }
        if (Modal.active === this && !this.element.hidden) return;
        if (Modal.active && Modal.active !== this) {
            const navigating = Modal.navigating;
            Modal.navigating = true;
            Modal.active.onClose();
            Modal.navigating = navigating;
        }
        this.previousFocus = document.activeElement;
        Modal.active = this;
        if (!Modal.navigating && window.history && window.history.state?.hypertrophyDialog !== this.historyId) {
            window.history.pushState({ ...window.history.state, hypertrophyDialog: this.historyId }, '');
        }
        this.element.hidden = false;
        this.element.inert = false;
        document.querySelectorAll('#app, .nav-wrap').forEach(node => node.inert = true);
        this.element.querySelector('button, input, [tabindex="0"]')?.focus({ preventScroll: true });
    }
    close() {
        if (Modal.queuedOpen === this) Modal.queuedOpen = null;
        const wasOpen = !this.element.hidden;
        this.element.hidden = true;
        this.element.inert = true;
        if (Modal.active === this) Modal.active = null;
        document.querySelectorAll('#app, .nav-wrap').forEach(node => node.inert = false);
        if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
        if (wasOpen && !Modal.navigating && window.history?.state?.hypertrophyDialog === this.historyId) {
            Modal.pendingBack = true;
            window.history.back();
        }
    }
}
