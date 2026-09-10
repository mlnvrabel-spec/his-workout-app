// Shared focus and visibility behavior for the existing overlay surfaces.
export class Modal {
    constructor(element, onClose, label) {
        this.element = element;
        element.hidden = true;
        element.inert = true;
        element.setAttribute('role', 'dialog');
        element.setAttribute('aria-modal', 'true');
        element.setAttribute('aria-label', label);
        element.addEventListener('keydown', event => {
            if (event.key === 'Escape') { event.preventDefault(); onClose(); }
            if (event.key !== 'Tab') return;
            const controls = [...element.querySelectorAll('button, input, select, textarea, a[href], [tabindex="0"]')]
                .filter(node => !node.disabled && node.getClientRects().length && !node.closest('[hidden]'));
            const first = controls[0], last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus({ preventScroll: true }); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus({ preventScroll: true }); }
        });
    }
    open() {
        this.previousFocus = document.activeElement;
        this.element.hidden = false;
        this.element.inert = false;
        document.querySelectorAll('#app, .nav-wrap').forEach(node => node.inert = true);
        this.element.querySelector('button, input, [tabindex="0"]')?.focus({ preventScroll: true });
    }
    close() {
        this.element.hidden = true;
        this.element.inert = true;
        document.querySelectorAll('#app, .nav-wrap').forEach(node => node.inert = false);
        if (this.previousFocus?.isConnected) this.previousFocus.focus({ preventScroll: true });
    }
}
