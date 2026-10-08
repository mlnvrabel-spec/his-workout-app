export class ExerciseReorder {
    constructor(cards, engine, feedback) {
        this.cards = cards;
        this.engine = engine;
        this.feedback = feedback;
        cards.addEventListener('click', event => {
            if (!this.suppressClick) return;
            this.suppressClick = false;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        cards.addEventListener('click', async event => {
            const handle = event.target.closest('.reorder-handle');
            if (handle) {
                const options = handle.closest('.card-wrapper').querySelector('.reorder-options');
                options.hidden = !options.hidden;
                handle.setAttribute('aria-expanded', String(!options.hidden));
            }
            const button = event.target.closest('[data-move]');
            if (button) await this.move(button.closest('.card-wrapper'), Number(button.dataset.move));
            if (event.target.closest('.undo-order-btn')) {
                const saved = await engine.undoExerciseOrder();
                feedback(saved ? 'Exercise order restored' : 'Order cannot be restored after new checks');
            }
        });
        cards.addEventListener('keydown', event => {
            const handle = event.target.closest('.reorder-handle');
            if (event.key === 'Escape') {
                this.cancel();
                cards.querySelectorAll('.reorder-options').forEach(options => { options.hidden = true; });
                cards.querySelectorAll('.reorder-handle').forEach(button => button.setAttribute('aria-expanded', 'false'));
            }
            if (handle && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
                event.preventDefault();
                this.move(handle.closest('.card-wrapper'), event.key === 'ArrowUp' ? -1 : 1);
            }
        });
        cards.addEventListener('pointerdown', event => {
            const surface = event.target.closest('.card');
            const card = surface?.closest('.card-wrapper');
            const control = event.target.closest('input, textarea, select, a, button, [contenteditable], .reorder-options');
            if (!card || (control && !control.matches('.ex-info, .reorder-handle')) || event.button !== 0 || event.isPrimary === false || this.engine.pending) return;
            if (card.classList.contains('done') || engine.isDaySealed?.(engine.state.day)) return;
            this.cancel();
            this.suppressClick = false;
            this.drag = { card, handle: surface, day: engine.state.day, cycle: engine.cycleId, slot: Number(card.dataset.idx), pointer: event.pointerId, startX: event.clientX, start: event.clientY, y: event.clientY, active: false };
            this.destination = [...cards.querySelectorAll('.card-wrapper')].indexOf(card);
            this.timer = setTimeout(() => {
                if (!this.drag) return;
                cards.dispatchEvent(new CustomEvent('exercise:reorder_started'));
                this.drag.active = true;
                surface.setPointerCapture(event.pointerId);
                this.drag.surface = surface;
                this.drag.transition = this.drag.surface.style.transition;
                this.drag.surface.style.transition = 'none';
                card.classList.add('is-reordering');
                this.feedback('Drag to choose a position. Other unfinished exercises will adjust.');
                this.frame = requestAnimationFrame(() => this.tick());
            }, 350);
        });
        cards.addEventListener('pointermove', event => {
            if (!this.drag || this.drag.pointer !== event.pointerId) return;
            this.drag.y = event.clientY;
            if (!this.drag.active && (Math.abs(this.drag.y - this.drag.start) > 10 || Math.abs(event.clientX - this.drag.startX) > 10)) this.cancel();
            else if (this.drag.active) event.preventDefault();
        });
        // Keep native scrolling before pickup; a held touch owns movement afterward.
        cards.addEventListener('touchmove', event => {
            if (this.drag?.active && event.cancelable) event.preventDefault();
        }, { passive: false });
        cards.addEventListener('contextmenu', event => {
            if (this.drag) event.preventDefault();
        });
        cards.addEventListener('pointerup', async event => {
            const drag = this.drag;
            if (!drag || drag.pointer !== event.pointerId) return;
            const destination = this.destination;
            this.cancel();
            if (!drag.active) return;
            this.suppressClick = true;
            setTimeout(() => { this.suppressClick = false; }, 400);
            if (engine.state.day !== drag.day || engine.cycleId !== drag.cycle) return;
            await this.save(drag.day, drag.slot, destination);
        });
        cards.addEventListener('pointercancel', () => this.cancel());
        cards.addEventListener('lostpointercapture', () => this.cancel());
        window.addEventListener('engine:state_updated', () => this.cancel());
        window.addEventListener('blur', () => this.cancel());
    }

    tick() {
        const drag = this.drag;
        if (!drag?.active) return;
        const cards = [...this.cards.querySelectorAll('.card-wrapper')];
        drag.surface.style.transform = `translateY(${drag.y - drag.start}px)`;
        let target = cards.find(card => drag.y < card.getBoundingClientRect().bottom) || cards.at(-1);
        this.destination = cards.indexOf(target);
        cards.forEach(card => card.classList.toggle('reorder-target', card === target));
        const app = document.getElementById('app');
        const bounds = app.getBoundingClientRect();
        if (drag.y < bounds.top + 80) app.scrollTop -= 9;
        else if (drag.y > bounds.bottom - 110) app.scrollTop += 9;
        this.frame = requestAnimationFrame(() => this.tick());
    }

    cancel() {
        clearTimeout(this.timer);
        cancelAnimationFrame(this.frame);
        const drag = this.drag;
        this.drag = null;
        if (drag?.surface) {
            drag.surface.style.transform = '';
            drag.surface.style.transition = drag.transition;
        }
        if (drag?.active && drag.handle.hasPointerCapture(drag.pointer)) drag.handle.releasePointerCapture(drag.pointer);
        this.cards.querySelectorAll('.is-reordering, .reorder-target').forEach(card => card.classList.remove('is-reordering', 'reorder-target'));
    }

    async move(card, direction) {
        const day = this.engine.state.day, slot = Number(card.dataset.idx);
        const order = this.engine.getExerciseOrder(day);
        let destination = order.indexOf(slot) + direction;
        while (destination >= 0 && destination < order.length && this.engine.state.done[day]?.[`ex-${day}-${order[destination]}`]) destination += direction;
        await this.save(day, slot, destination);
    }

    async save(day, slot, destination) {
        const saved = await this.engine.reorderExercise(day, slot, destination);
        this.feedback(saved ? this.engine.state.orderNotice : 'Choose another unfinished position');
        this.cards.querySelector(`#ex-${day}-${slot} .reorder-handle`)?.focus({ preventScroll: true });
    }
}
