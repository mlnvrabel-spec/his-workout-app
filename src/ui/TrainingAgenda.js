import { Modal } from './Modal.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const dayDate = value => new Date(`${value}T12:00:00`);
const shiftDate = (value, amount) => {
    const date = dayDate(value);
    date.setDate(date.getDate() + amount);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const dateLabel = value => value ? dayDate(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not scheduled';

/** A projection of engine-owned scheduling state. Dialogs only hold unsaved intent. */
export class TrainingAgenda {
    constructor(element, engine) {
        this.element = element;
        this.engine = engine;
        this.daysBefore = 2;
        this.daysAfter = 9;
        this.dialog = document.createElement('div');
        this.dialog.className = 'agenda-dialog';
        document.body.appendChild(this.dialog);
        this.modal = new Modal(this.dialog, () => this.closeDialog(), 'Training schedule');
        this.element.addEventListener('click', event => this.onClick(event));
        this.element.addEventListener('click', event => {
            if (!this.suppressClick) return;
            event.preventDefault();
            event.stopImmediatePropagation();
        }, true);
        this.dialog.addEventListener('click', event => {
            if (event.target === this.dialog || event.target.closest('[data-agenda-cancel]')) this.closeDialog();
        });
        this.attachDrag();
        window.addEventListener('engine:ready', () => this.render());
        window.addEventListener('engine:state_updated', () => { this.cancelDrag(); this.render(); });
        this.render();
    }

    show() { this.render(); }

    render() {
        const focused = document.activeElement;
        const focusAction = this.element.contains(focused) ? focused.dataset.agendaAction : null;
        const focusId = focused?.dataset.entryId;
        const focusDate = focused?.dataset.date;
        this.statsOpen = this.element.querySelector('.agenda-averages')?.open ?? this.statsOpen;
        this.view = this.engine.getScheduleView();
        const { entries, today } = this.view;
        if (!today) return;
        this.selectedDate ||= today;
        const selected = this.selectedDate;
        const current = entries.find(entry => entry.kind === 'gym' && entry.cycleId === this.view.currentCycleId && entry.day === this.view.currentDay);
        const selectedItems = entries.filter(entry => entry.date === selected);
        const selectedGym = selectedItems.find(entry => entry.kind === 'gym' && entry.cycleId === this.view.currentCycleId);
        const summaryGym = selectedGym || (selected === today ? current : null);
        const dates = [];
        for (let offset = -this.daysBefore; offset <= this.daysAfter; offset++) dates.push(shiftDate(today, offset));
        const overdue = entries.filter(entry => entry.date < dates[0] && entry.status !== 'completed' && ['gym', 'run'].includes(entry.kind));
        this.element.innerHTML = `
            <div class="agenda-today">
                <div><p class="agenda-eyebrow">${selected === today ? 'Today' : 'Selected day'} · ${escape(dateLabel(selected))}</p><h2>${escape(selectedItems.map(entry => entry.title).join(' · ') || (selected < today ? 'Nothing recorded' : 'Rest'))}</h2>${current ? `<p class="agenda-next">${current.status === 'started' ? 'In progress' : 'Next gym'}: ${escape(current.title)} · ${escape(dateLabel(current.date))}</p>` : ''}</div>
                ${summaryGym ? `<button type="button" class="agenda-primary" data-agenda-action="open" data-entry-id="${escape(summaryGym.id)}"><span>${summaryGym.status === 'started' ? 'Resume' : 'Open'} ${escape(summaryGym.title)}</span><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M5 12h14m-6-6 6 6-6 6"/></svg></button>` : ''}
            </div>
            ${this.view.averages ? `<details class="agenda-averages" ${this.statsOpen ? 'open' : ''}><summary>Training averages</summary><table><caption>Sessions per week · through ${escape(dateLabel(today))}</caption><thead><tr><th scope="col">Activity</th>${this.view.averages.map(period => `<th scope="col">${period.weeks} weeks</th>`).join('')}</tr></thead><tbody>${[['gym', 'Gym'], ['run', 'Runs']].map(([kind, title]) => `<tr><th scope="row">${title}</th>${this.view.averages.map(period => `<td>${period[kind].perWeek.toFixed(1)}<span>${period[kind].count} recorded</span></td>`).join('')}</tr>`).join('')}</tbody></table><p>Recorded history only. Missing sessions can lower averages.</p></details>` : ''}
            <div class="agenda-toolbar" aria-label="Schedule actions">
                <button type="button" class="agenda-add" data-agenda-action="add" data-date="${selected}">+ Add</button>
                <button type="button" data-agenda-action="office">Office days</button>
                <button type="button" data-agenda-action="today">Today</button>
                <button type="button" data-agenda-action="undo" ${this.view.canUndo ? '' : 'disabled'}>Undo</button>
            </div>
            <p class="agenda-help">Tap a date to view its day. Hold a planned session to move it, or use Move.</p>
            ${this.view.runSuggestion ? `<p class="agenda-suggestion">Next free 4×4 date, keeping gym plans: <button type="button" data-agenda-action="add" data-date="${this.view.runSuggestion}">${escape(dateLabel(this.view.runSuggestion))}</button></p>` : ''}
            <p class="agenda-notice" role="status" aria-live="polite">${escape(this.notice || '')}</p>
            ${overdue.length ? `<section class="agenda-overdue" aria-label="Earlier unfinished sessions"><h3>Still to account for</h3>${overdue.map(entry => this.entryHTML(entry, true)).join('')}</section>` : ''}
            <button type="button" class="agenda-range" data-agenda-action="earlier">Show earlier days</button>
            <div class="agenda-days">${dates.map(date => {
                const items = entries.filter(entry => entry.date === date);
                return `<section class="agenda-day ${date === today ? 'is-today' : ''} ${date === selected ? 'is-selected' : ''} ${date < today ? 'is-past' : ''}" data-date="${date}" aria-label="${escape(dateLabel(date))}${date === today ? ', today' : ''}">
                    <button type="button" class="agenda-date" data-agenda-action="select" data-date="${date}" aria-label="Select ${escape(dateLabel(date))}" aria-pressed="${date === selected}"><span>${date === today ? 'Today' : dayDate(date).toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>${dayDate(date).getDate()}</strong><span>${dayDate(date).toLocaleDateString(undefined, { month: 'short' })}</span></button>
                    <div class="agenda-day-content">${items.length ? `<div class="agenda-items ${items.length > 1 ? 'is-grouped' : ''}">${items.map(entry => this.entryHTML(entry, false, items.length > 1 && ['office', 'rest'].includes(entry.kind))).join('')}</div>` : `<p class="agenda-empty">${date < today ? 'Nothing recorded' : 'Rest'}</p>`}<button type="button" class="agenda-day-add" data-agenda-action="add" data-date="${date}" aria-label="Add activity on ${escape(dateLabel(date))}">+</button></div>
                </section>`;
            }).join('')}</div>
            <button type="button" class="agenda-range" data-agenda-action="later">Show next 7 days</button>`;
        if (focusAction) [...this.element.querySelectorAll('[data-agenda-action]')].find(button => button.dataset.agendaAction === focusAction && button.dataset.entryId === focusId && button.dataset.date === focusDate)?.focus({ preventScroll: true });
    }

    entryHTML(entry, includeDate = false, compact = false) {
        const movable = Boolean(entry.movable);
        const recorded = entry.status === 'completed';
        const label = recorded ? (entry.kind === 'gym' ? (this.engine.getSessionStatus?.(entry.day, entry.cycleId) || 'Recorded') : 'Recorded') : entry.status === 'started' ? 'In progress' : entry.kind === 'office' ? (entry.recurring ? 'Weekly office day' : 'Office day') : entry.date < this.view.today ? (entry.kind === 'gym' ? 'Unfinished' : 'Scheduled · not recorded') : 'Planned';
        const openable = entry.kind === 'gym' && entry.cycleId === this.view.currentCycleId;
        const recordable = ['run', 'activity'].includes(entry.kind) && !recorded && entry.date <= this.view.today;
        return `<article class="agenda-entry agenda-entry--${escape(entry.kind)} ${recorded ? 'is-recorded' : ''} ${compact ? 'agenda-entry--context' : ''}" data-entry-id="${escape(entry.id)}" data-movable="${movable}" ${movable ? '' : `title="${escape(entry.movableReason || 'Recorded history stays in place')}"`}>
            <div class="agenda-entry-copy"><h3>${escape(entry.title)}</h3>${compact ? '' : `<p>${escape(label)}${includeDate ? ` · ${escape(dateLabel(entry.date))}` : ''}${entry.status === 'planned' && entry.missedDate ? ` · Carried from ${escape(dateLabel(entry.missedDate))}` : ''}${entry.demanding ? ' · Demanding activity' : ''}</p>`}</div>
            <div class="agenda-entry-actions">${openable ? `<button type="button" data-agenda-action="open" data-entry-id="${escape(entry.id)}" aria-label="Open ${escape(entry.title)}">Open</button>` : ''}${recordable ? `<button type="button" data-agenda-action="record" data-entry-id="${escape(entry.id)}">Record</button>` : ''}${movable ? `<button type="button" data-agenda-action="move" data-entry-id="${escape(entry.id)}" aria-label="Move ${escape(entry.title)} on ${escape(dateLabel(entry.date))}">Move</button>` : compact ? '' : `<span class="agenda-fixed">${entry.status === 'started' ? 'Started' : 'Fixed'}</span>`}</div>
        </article>`;
    }

    async onClick(event) {
        const button = event.target.closest('[data-agenda-action]');
        if (!button || button.disabled) return;
        const entry = this.view.entries.find(item => item.id === button.dataset.entryId);
        switch (button.dataset.agendaAction) {
            case 'add': this.addDialog(button.dataset.date || this.view.today); break;
            case 'move': if (entry) this.moveDialog(entry); break;
            case 'record': if (entry) this.preview({ type: 'complete', id: entry.id }); break;
            case 'office': this.officeDialog(); break;
            case 'select': this.selectedDate = button.dataset.date; this.render(); break;
            case 'today': this.selectedDate = this.view.today; this.render(); this.element.querySelector(`.agenda-day[data-date="${this.view.today}"]`)?.scrollIntoView({ behavior: this.scrollBehavior(), block: 'start' }); break;
            case 'earlier': this.daysBefore += 7; this.render(); break;
            case 'later': this.daysAfter += 7; this.render(); break;
            case 'open': if (entry?.kind === 'gym' && entry.cycleId === this.view.currentCycleId) this.element.dispatchEvent(new CustomEvent('agenda:open-workout', { bubbles: true, detail: { sessionId: entry.id, date: entry.date, day: entry.day, cycleId: entry.cycleId } })); break;
            case 'undo':
                button.disabled = true;
                try { this.announce(await this.engine.undoSchedule() ? 'Last schedule change undone.' : 'This change can no longer be undone. Your recorded training stays unchanged.'); }
                catch (error) { this.announce(error.message); }
                this.render();
                break;
        }
    }

    scrollBehavior() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'; }

    announce(message) {
        this.notice = message;
        const notice = this.element.querySelector('.agenda-notice');
        if (notice) notice.textContent = message;
    }

    dialogHTML(title, body, footer) {
        this.dialog.setAttribute('aria-label', title);
        this.dialog.innerHTML = `<div class="agenda-dialog-panel"><div class="agenda-dialog-heading"><h2>${escape(title)}</h2><button type="button" data-agenda-cancel aria-label="Close dialog">×</button></div>${body}<p class="agenda-dialog-error" role="alert"></p><div class="agenda-dialog-footer">${footer}</div></div>`;
        if (this.dialog.hidden) this.modal.open();
        else this.dialog.querySelector('input, select, button')?.focus({ preventScroll: true });
    }

    closeDialog() {
        const previous = this.modal.previousFocus?.dataset;
        this.modal.close();
        if (previous?.agendaAction) {
            const buttons = [...this.element.querySelectorAll('[data-agenda-action]')];
            (buttons.find(button => button.dataset.agendaAction === previous.agendaAction && button.dataset.entryId === previous.entryId && button.dataset.date === previous.date)
                || buttons.find(button => button.dataset.agendaAction === 'add'))?.focus({ preventScroll: true });
        }
    }

    addDialog(date) {
        this.dialogHTML('Add to your agenda', `<form id="agenda-add-form" class="agenda-form"><label>Activity<select name="kind"><option value="run">Norwegian 4×4</option><option value="office">Office day</option><option value="rest">Rest day</option><option value="activity">Other activity</option></select></label><label>Date<input name="date" type="date" value="${date}" required></label><div class="agenda-activity-fields" hidden><label>Name<input name="title" type="text" maxlength="80" placeholder="For example, a hike"></label><label class="agenda-checkbox"><input name="demanding" type="checkbox">Demanding activity</label></div><p class="agenda-form-help"></p></form>`, '<button type="button" data-agenda-cancel>Cancel</button><button type="submit" class="agenda-primary" form="agenda-add-form">Review change</button>');
        const form = this.dialog.querySelector('form');
        const update = () => {
            const kind = form.elements.kind.value;
            const activity = kind === 'activity';
            form.querySelector('.agenda-activity-fields').hidden = !activity;
            form.elements.title.required = activity;
            form.querySelector('.agenda-form-help').textContent = ['run', 'activity'].includes(kind) && form.elements.date.value <= this.view.today ? 'Adding this records it on the selected date. No separate completion step.' : kind === 'run' ? 'A run uses this day. Any affected gym sessions move forward in order.' : 'This reserves the day. Any affected gym sessions move forward in order.';
        };
        form.addEventListener('change', update);
        update();
        form.addEventListener('submit', event => {
            event.preventDefault();
            const kind = form.elements.kind.value;
            this.preview({ type: 'add', kind, date: form.elements.date.value, ...(kind === 'activity' ? { title: form.elements.title.value.trim(), demanding: form.elements.demanding.checked } : {}), performed: ['run', 'activity'].includes(kind) && form.elements.date.value <= this.view.today });
        });
    }

    moveDialog(entry, date = entry.date) {
        this.dialogHTML(`Move ${entry.title}`, `<form id="agenda-move-form" class="agenda-form"><p>Currently ${escape(dateLabel(entry.date))}. Other unfinished gym sessions keep their order.</p><label>New date<input name="date" type="date" value="${date}" ${entry.kind === 'gym' ? `min="${this.view.today}"` : ''} required></label><p class="agenda-form-help"></p></form>`, `${entry.kind !== 'gym' ? '<button type="button" class="agenda-remove">Remove</button>' : ''}<button type="button" data-agenda-cancel>Cancel</button><button type="submit" class="agenda-primary" form="agenda-move-form">Review move</button>`);
        const form = this.dialog.querySelector('form');
        const update = () => { form.querySelector('.agenda-form-help').textContent = ['run', 'activity'].includes(entry.kind) && form.elements.date.value <= this.view.today ? 'This records the existing activity on that date. It does not add another copy.' : 'Completed and started workouts stay in place.'; };
        form.addEventListener('change', update);
        update();
        form.addEventListener('submit', event => { event.preventDefault(); this.preview({ type: 'move', id: entry.id, date: form.elements.date.value, performed: ['run', 'activity'].includes(entry.kind) && form.elements.date.value <= this.view.today }); });
        this.dialog.querySelector('.agenda-remove')?.addEventListener('click', () => this.preview({ type: 'remove', id: entry.id }));
    }

    officeDialog() {
        const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        this.dialogHTML('Office days', `<form id="agenda-office-form" class="agenda-form"><p>Recorded and started workouts stay in place. Newly free days are not filled automatically.</p><label>Apply from<input name="effectiveDate" type="date" value="${this.view.today}" min="${this.view.today}" required></label><fieldset><legend>Usually unavailable</legend><div class="agenda-weekdays">${[1, 2, 3, 4, 5, 6, 0].map(day => `<label class="agenda-checkbox"><input type="checkbox" name="days" value="${day}" ${this.view.officeDays.includes(day) ? 'checked' : ''}>${names[day]}</label>`).join('')}</div></fieldset></form>`, '<button type="button" data-agenda-cancel>Cancel</button><button type="submit" class="agenda-primary" form="agenda-office-form">Review change</button>');
        this.dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); this.preview({ type: 'officeDays', days: [...this.dialog.querySelectorAll('input[name="days"]:checked')].map(input => Number(input.value)), effectiveDate: event.currentTarget.elements.effectiveDate.value }); });
    }

    async preview(intent) {
        try {
            const preview = await this.engine.previewSchedule(intent);
            const changes = preview.changes || [];
            this.dialogHTML('Review schedule change', `<p class="agenda-preview-intro">${changes.length ? 'Only the changes below will be applied.' : 'No schedule dates need to change.'}</p><ol class="agenda-changes">${changes.map(change => `<li><strong>${escape(change.title)}</strong><span>${change.action === 'completed' ? `Record on ${escape(dateLabel(change.to || change.from))}` : change.action === 'added' ? `Add · ${escape(dateLabel(change.to))}` : change.action === 'removed' ? `Remove · ${escape(dateLabel(change.from))}` : `${escape(dateLabel(change.from))} → ${escape(dateLabel(change.to))}${change.status === "completed" ? " · Record activity" : ""}`}</span></li>`).join('')}</ol>${preview.warnings?.length ? `<div class="agenda-warnings"><h3>Before you apply</h3><ul>${preview.warnings.map(warning => `<li>${escape(warning)}</li>`).join('')}</ul></div>` : ''}`, '<button type="button" data-agenda-cancel>Cancel</button><button type="button" class="agenda-primary" data-agenda-apply>Apply change</button>');
            this.dialog.querySelector('[data-agenda-apply]').addEventListener('click', async event => {
                const button = event.currentTarget;
                button.disabled = true;
                try {
                    const saved = await this.engine.applySchedule(preview);
                    if (!saved) throw new Error(this.engine.state?.scheduleNotice || 'The schedule could not be saved. Review the change again.');
                    this.closeDialog();
                    this.announce('Schedule saved. Undo is available until affected training changes.');
                    this.render();
                } catch (error) { this.dialog.querySelector('.agenda-dialog-error').textContent = error.message; button.disabled = false; }
            });
        } catch (error) {
            if (!this.dialog.hidden) this.dialog.querySelector('.agenda-dialog-error').textContent = error.message;
            else this.announce(error.message);
        }
    }

    attachDrag() {
        this.element.addEventListener('pointerdown', event => {
            const card = event.target.closest('.agenda-entry[data-movable="true"]');
            if (!card || event.button !== 0 || event.isPrimary === false || event.target.closest('button, input, select, a, textarea') || this.engine.pending) return;
            this.cancelDrag();
            this.drag = { card, id: card.dataset.entryId, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
            this.holdTimer = setTimeout(() => {
                if (!this.drag) return;
                this.drag.active = true;
                card.classList.add('is-moving');
                try { card.setPointerCapture(event.pointerId); } catch { this.cancelDrag(); return; }
                this.announce('Move to a date, then release to review. Escape cancels.');
                this.dragFrame = requestAnimationFrame(() => this.dragTick());
            }, 350);
        });
        this.element.addEventListener('pointermove', event => {
            if (!this.drag || this.drag.pointer !== event.pointerId) return;
            this.drag.x = event.clientX;
            this.drag.y = event.clientY;
            if (!this.drag.active && (Math.abs(event.clientX - this.drag.startX) > 10 || Math.abs(event.clientY - this.drag.startY) > 10)) this.cancelDrag();
            else if (this.drag.active) event.preventDefault();
        });
        this.element.addEventListener('touchmove', event => { if (this.drag?.active && event.cancelable) event.preventDefault(); }, { passive: false });
        this.element.addEventListener('contextmenu', event => { if (this.drag) event.preventDefault(); });
        this.element.addEventListener('pointerup', event => {
            const drag = this.drag;
            if (!drag || drag.pointer !== event.pointerId) return;
            const date = this.dropDate;
            const error = this.dropError;
            this.cancelDrag();
            if (!drag.active) return;
            this.suppressClick = true;
            setTimeout(() => { this.suppressClick = false; }, 400);
            const entry = this.view.entries.find(item => item.id === drag.id);
            if (!entry || !date || date === entry.date) { this.announce('Move cancelled. The schedule is unchanged.'); return; }
            if (error) { this.announce(error); return; }
            if (['run', 'activity'].includes(entry.kind) && date <= this.view.today) this.moveDialog(entry, date);
            else this.preview({ type: 'move', id: entry.id, date });
        });
        this.element.addEventListener('pointercancel', () => this.cancelDrag());
        this.element.addEventListener('lostpointercapture', () => this.cancelDrag());
        document.addEventListener('keydown', event => { if (event.key === 'Escape') this.cancelDrag(); });
        window.addEventListener('blur', () => this.cancelDrag());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancelDrag(); });
        document.addEventListener('scroll', () => { if (this.drag && !this.drag.active) this.cancelDrag(); }, true);
    }

    dragTick() {
        const drag = this.drag;
        if (!drag?.active) return;
        const days = [...this.element.querySelectorAll('.agenda-day')];
        const target = days.find(day => { const bounds = day.getBoundingClientRect(); return drag.y >= bounds.top && drag.y <= bounds.bottom && drag.x >= bounds.left && drag.x <= bounds.right; });
        if (target?.dataset.date !== this.dropDate) {
            this.dropError = null;
            const entry = this.view.entries.find(item => item.id === drag.id);
            if (target && entry && target.dataset.date !== entry.date) {
                try {
                    this.engine.previewSchedule({ type: 'move', id: entry.id, date: target.dataset.date, performed: ['run', 'activity'].includes(entry.kind) && target.dataset.date <= this.view.today });
                    this.announce(`Release on ${dateLabel(target.dataset.date)} to review the move.`);
                } catch (error) { this.dropError = error.message; this.announce(error.message); }
            }
        }
        this.dropDate = target?.dataset.date;
        days.forEach(day => { day.classList.toggle('is-drop-target', day === target); day.classList.toggle('is-drop-invalid', day === target && Boolean(this.dropError)); });
        const app = document.getElementById('app');
        if (app) {
            const bounds = app.getBoundingClientRect();
            if (drag.y < bounds.top + 72) app.scrollTop -= 8;
            else if (drag.y > bounds.bottom - 72) app.scrollTop += 8;
        }
        this.dragFrame = requestAnimationFrame(() => this.dragTick());
    }

    cancelDrag() {
        clearTimeout(this.holdTimer);
        cancelAnimationFrame(this.dragFrame);
        const drag = this.drag;
        this.drag = null;
        this.dropDate = null;
        this.dropError = null;
        if (drag?.card.hasPointerCapture?.(drag.pointer)) drag.card.releasePointerCapture(drag.pointer);
        this.element.querySelectorAll('.is-moving, .is-drop-target, .is-drop-invalid').forEach(node => node.classList.remove('is-moving', 'is-drop-target', 'is-drop-invalid'));
    }
}
