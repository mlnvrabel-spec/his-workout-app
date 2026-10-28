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
        this.view = this.engine.getScheduleView(this.view?.today ? shiftDate(this.view.today, -this.daysBefore) : null);
        const { entries, today } = this.view;
        if (!today) return;
        this.selectedDate ||= today;
        const selected = this.selectedDate;
        const dates = [];
        for (let offset = -this.daysBefore; offset <= this.daysAfter; offset++) dates.push(shiftDate(today, offset));
        const overdue = entries.filter(entry => entry.date < dates[0] && entry.status !== 'completed' && ['gym', 'run'].includes(entry.kind));
        this.element.innerHTML = `
            <div class="agenda-toolbar">
                <h2>${escape(dayDate(selected).toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</h2>
                <div class="agenda-calendar-actions" aria-label="Calendar actions">
                    <button type="button" data-agenda-action="today">Today</button>
                    ${this.view.canUndo ? '<button type="button" data-agenda-action="undo">Undo</button>' : ''}
                    <button type="button" class="agenda-options" data-agenda-action="office" aria-label="Recurring rest days" title="Recurring rest days"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h7m4 0h5M4 17h3m4 0h9"/><circle cx="13" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg></button>
                </div>
            </div>
            ${this.view.averages ? `<section class="agenda-averages" aria-label="Training averages"><table><caption>Sessions / week <span>Recorded training</span></caption><thead><tr><th scope="col"><span class="sr-only">Activity</span></th>${this.view.averages.map(period => `<th scope="col">${period.weeks * 7} days</th>`).join('')}</tr></thead><tbody>${[['gym', 'Gym'], ['run', 'Runs']].map(([kind, title]) => `<tr><th scope="row">${title}</th>${this.view.averages.map(period => `<td aria-label="${period[kind].count} recorded sessions over ${period.weeks * 7} days, ${period[kind].perWeek.toFixed(1)} per week">${period[kind].perWeek.toFixed(1)}</td>`).join('')}</tr>`).join('')}</tbody></table></section>` : ''}
            ${this.view.runSuggestion ? `<p class="agenda-suggestion">Next free 4×4 date, keeping gym plans: <button type="button" data-agenda-action="add" data-date="${this.view.runSuggestion}">${escape(dateLabel(this.view.runSuggestion))}</button></p>` : ''}
            <p class="agenda-notice" role="status" aria-live="polite">${escape(this.notice || '')}</p>
            ${overdue.length ? `<section class="agenda-overdue" aria-label="Earlier unfinished sessions"><h3>Still to account for</h3>${overdue.map(entry => this.entryHTML(entry, true)).join('')}</section>` : ''}
            <button type="button" class="agenda-range" data-agenda-action="earlier">Show earlier days</button>
            <div class="agenda-days">${dates.map(date => {
                const items = entries.filter(entry => entry.date === date);
                return `<section class="agenda-day ${date === today ? 'is-today' : ''} ${date === selected ? 'is-selected' : ''} ${date < today ? 'is-past' : ''}" data-date="${date}" aria-label="${escape(dateLabel(date))}${date === today ? ', today' : ''}">
                    <button type="button" class="agenda-date" data-agenda-action="select" data-date="${date}" aria-label="Select ${escape(dateLabel(date))}" aria-pressed="${date === selected}"><span>${date === today ? 'Today' : dayDate(date).toLocaleDateString(undefined, { weekday: 'short' })}</span><strong>${dayDate(date).getDate()}</strong><span>${dayDate(date).toLocaleDateString(undefined, { month: 'short' })}</span></button>
                    <div class="agenda-day-content">${items.length ? `<div class="agenda-items ${items.length > 1 ? 'is-grouped' : ''}">${items.map(entry => this.entryHTML(entry, false, items.length > 1 && entry.kind === 'rest')).join('')}</div>` : this.emptyDayHTML(date, today)}<button type="button" class="agenda-day-add" data-agenda-action="add" data-date="${date}" aria-label="Add activity on ${escape(dateLabel(date))}">+</button></div>
                </section>`;
            }).join('')}</div>
            <button type="button" class="agenda-range" data-agenda-action="later">Show next 7 days</button>`;
        if (focusAction) [...this.element.querySelectorAll('[data-agenda-action]')].find(button => button.dataset.agendaAction === focusAction && button.dataset.entryId === focusId && button.dataset.date === focusDate)?.focus({ preventScroll: true });
    }

    emptyDayHTML(date, today) {
        if (date < today) return '<p class="agenda-empty"><span class="sr-only">No activity recorded</span></p>';
        if (this.view.restExceptions?.includes(date)) return '<p class="agenda-empty">Available</p>';
        return `<button type="button" class="agenda-entry agenda-entry--rest" data-agenda-action="rest-options" data-date="${date}" aria-label="Rest · ${escape(dateLabel(date))} · Available day, no saved Rest"><span class="agenda-entry-copy"><span class="agenda-entry-title">Rest</span></span></button>`;
    }

    restOptionsDialog(date) {
        this.dialogHTML('Rest', `<p class="agenda-entry-date">${escape(dateLabel(date))}</p><p class="agenda-form-help">This day is available: no workout or saved Rest is scheduled. Save Rest for this date only, or set recurring rest days.</p>`, '<button type="button" data-agenda-cancel>Close</button><button type="button" data-agenda-recurring>Recurring rest days</button><button type="button" class="agenda-primary" data-agenda-save-rest>Save Rest</button>');
        this.dialog.querySelector('[data-agenda-save-rest]').addEventListener('click', () => this.commitChange({ type: 'add', kind: 'rest', date }));
        this.dialog.querySelector('[data-agenda-recurring]').addEventListener('click', () => this.officeDialog());
    }

    entryHTML(entry, includeDate = false, compact = false) {
        const movable = Boolean(entry.movable);
        const recorded = entry.status === 'completed';
        const label = recorded ? (entry.kind === 'gym' ? (this.engine.getSessionStatus?.(entry.day, entry.cycleId) || 'Recorded') : 'Recorded') : entry.status === 'started' ? 'In progress' : entry.kind === 'rest' ? (entry.recurring ? 'Repeats weekly' : 'Manual Rest') : entry.date < this.view.today ? (entry.kind === 'gym' ? 'Unfinished' : 'Scheduled · not recorded') : 'Planned';
        const title = entry.kind === 'rest' ? 'Rest' : entry.title;
        const context = [includeDate ? dateLabel(entry.date) : '', entry.missedDate ? `Carried from ${dateLabel(entry.missedDate)}` : '', entry.demanding ? 'Demanding activity' : ''].filter(Boolean).join(' · ');
        return `<button type="button" class="agenda-entry agenda-entry--${escape(entry.kind)} ${recorded ? 'is-recorded' : ''} ${compact ? 'agenda-entry--context' : ''}" data-agenda-action="details" data-entry-id="${escape(entry.id)}" data-movable="${movable}" aria-label="${escape(`${title} · ${dateLabel(entry.date)} · ${label}${entry.correctable ? ' · Edit manual record' : entry.movableReason ? ` · ${entry.movableReason}` : ''}`)}">
            <span class="agenda-entry-copy"><span class="agenda-entry-title">${escape(title)}</span>${context && !compact ? `<span class="agenda-entry-context">${escape(context)}</span>` : ''}</span>
            ${recorded ? '<svg class="agenda-recorded-mark" viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>' : entry.status === 'started' ? '<span class="agenda-progress-mark" aria-hidden="true"></span>' : ''}
        </button>`;
    }

    async onClick(event) {
        const button = event.target.closest('[data-agenda-action]');
        if (!button || button.disabled) return;
        const entry = this.view.entries.find(item => item.id === button.dataset.entryId);
        switch (button.dataset.agendaAction) {
            case 'details': if (entry) this.entryDialog(entry); break;
            case 'rest-options': this.restOptionsDialog(button.dataset.date); break;
            case 'add': this.addDialog(button.dataset.date || this.view.today); break;
            case 'move': if (entry) this.moveDialog(entry); break;
            case 'record': if (entry) this.commitChange({ type: 'complete', id: entry.id }); break;
            case 'office': this.officeDialog(); break;
            case 'select': this.selectedDate = button.dataset.date; this.render(); break;
            case 'today': this.selectedDate = this.view.today; this.render(); this.element.querySelector(`.agenda-day[data-date="${this.view.today}"]`)?.scrollIntoView({ behavior: this.scrollBehavior(), block: 'start' }); break;
            case 'earlier': this.daysBefore += 7; this.render(); break;
            case 'later': this.daysAfter += 7; this.render(); break;
            case 'open': this.openWorkout(entry); break;
            case 'undo':
                button.disabled = true;
                try { this.announce(await this.engine.undoSchedule() ? 'Last schedule change undone.' : 'This change can no longer be undone. Your recorded training stays unchanged.'); }
                catch (error) { this.announce(error.message); }
                this.render();
                break;
        }
    }

    openWorkout(entry) {
        if (entry?.kind === 'gym' && entry.cycleId === this.view.currentCycleId) this.element.dispatchEvent(new CustomEvent('agenda:open-workout', { bubbles: true, detail: { sessionId: entry.id, date: entry.date, day: entry.day, cycleId: entry.cycleId } }));
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
                || buttons.find(button => button.dataset.agendaAction === 'add' && button.dataset.date === previous.date)
                || buttons.find(button => button.dataset.agendaAction === 'add'))?.focus({ preventScroll: true });
        }
    }

    addDialog(date) {
        const workouts = this.view.workouts || [];
        this.dialogHTML('Add to your agenda', `<form id="agenda-add-form" class="agenda-form"><label>Activity<select name="kind"><option value="gym">Gym session (past)</option><option value="run">Norwegian 4×4</option><option value="rest">Rest</option><option value="activity">Other activity</option></select></label><div class="agenda-gym-fields" hidden><label>Workout performed<select name="workoutDay" required><option value="">Choose workout</option>${workouts.map(workout => `<option value="${workout.day}">${escape(workout.title)}</option>`).join('')}</select></label><label>Date<input name="date" type="date" value="${date}" required></label><div class="agenda-activity-fields" hidden><label>Name<input name="title" type="text" maxlength="80" placeholder="For example, a hike"></label><label class="agenda-checkbox"><input name="demanding" type="checkbox">Demanding activity</label></div><p class="agenda-form-help" aria-live="polite"></p></form>`, '<button type="button" data-agenda-cancel>Cancel</button><button type="submit" class="agenda-primary" form="agenda-add-form">Save activity</button>');
        const form = this.dialog.querySelector('form');
        const submit = this.dialog.querySelector('[form="agenda-add-form"]');
        form.elements.kind.value = date < this.view.today ? 'gym' : 'run';
        const update = () => {
            const kind = form.elements.kind.value;
            const activity = kind === 'activity';
            form.querySelector('.agenda-activity-fields').hidden = !activity;
            form.elements.title.required = activity;
            form.querySelector('.agenda-gym-fields').hidden = kind !== 'gym';
            form.elements.workoutDay.disabled = kind !== 'gym';
            submit.textContent = kind === 'gym' ? 'Save workout' : kind === 'rest' ? 'Save Rest' : 'Save activity';
            const selected = workouts.find(workout => String(workout.day) === form.elements.workoutDay.value);
            const past = form.elements.date.value < this.view.today;
            form.querySelector('.agenda-form-help').textContent = kind === 'gym'
                ? (selected ? `The future split recalculates from recorded training when you save ${selected.title}. You can move later dates or Undo.` : 'Choose the workout you actually performed. The future split recalculates when you save.')
                : past ? 'Record what happened on this date. The future plan updates when you save.'
                : ['run', 'activity'].includes(kind) && form.elements.date.value === this.view.today ? 'Adding this records it today. No separate completion step.'
                : 'This reserves the day. Any affected gym sessions move forward in order.';
        };
        form.addEventListener('change', update);
        update();
        form.addEventListener('submit', event => {
            event.preventDefault();
            const kind = form.elements.kind.value;
            if (kind === 'gym') this.saveWorkout({ type: 'recordGym', day: form.elements.workoutDay.value === '' ? null : Number(form.elements.workoutDay.value), date: form.elements.date.value }, submit);
            else this.commitChange({ type: 'add', kind, date: form.elements.date.value, ...(kind === 'activity' ? { title: form.elements.title.value.trim(), demanding: form.elements.demanding.checked } : {}), performed: (['run', 'activity'].includes(kind) && form.elements.date.value <= this.view.today) || (kind === 'rest' && form.elements.date.value < this.view.today) });
        });
    }

    async saveWorkout(intent, button) {
        return this.saveChange(intent, button, 'Workout saved. Future dates updated. Undo is available until affected training changes.');
    }

    async saveChange(intent, button, message = 'Calendar updated. Undo is available.') {
        if (button?.disabled || this.engine.pending) return;
        if (button) button.disabled = true;
        const errorMessage = this.dialog.querySelector('.agenda-dialog-error');
        if (errorMessage) errorMessage.textContent = '';
        try {
            const proposal = this.engine.previewSchedule(intent);
            const saved = await this.engine.applySchedule(proposal);
            if (!saved) throw new Error(this.engine.state?.scheduleNotice || 'The workout could not be saved. Try again.');
            if (!this.dialog.hidden) this.closeDialog();
            const moves = (proposal.changes || []).filter(change => change.kind === 'gym' && change.action === 'moved');
            const changedDates = moves.slice(0, 3).map(change => `${change.title} moved to ${dateLabel(change.to)}`).join('; ');
            const warnings = proposal.warnings || [];
            this.announce(`${message}${changedDates ? ` ${changedDates}${moves.length > 3 ? `; ${moves.length - 3} more workout dates changed` : ''}.` : ''}${warnings.length ? ` ${warnings[0]}${warnings.length > 1 ? ` ${warnings.length - 1} more notices.` : ''}` : ''}`);
            this.render();
        } catch (error) {
            if (errorMessage && !this.dialog.hidden) errorMessage.textContent = error.message;
            else this.announce(error.message);
            if (button) button.disabled = false;
        }
    }

    moveDialog(entry, date = entry.date) {
        this.entryDialog(entry, date);
    }

    entryDialog(entry, date = entry.date) {
        if (entry.correctable) return this.recordDialog(entry);
        const title = entry.kind === 'rest' ? 'Rest' : entry.title;
        const editable = Boolean(entry.movable);
        const currentGym = entry.kind === 'gym' && entry.cycleId === this.view.currentCycleId;
        const recordable = ['run', 'activity'].includes(entry.kind) && entry.status !== 'completed' && entry.date <= this.view.today;
        const exercises = (this.engine.summaries?.find(summary => summary.id === entry.id)?.exercises || this.engine.protocolData?.[entry.day]?.exercises || []);
        const prescription = entry.kind === 'gym' && exercises.length ? `<ul class="agenda-exercises">${exercises.map(exercise => `<li>${escape(exercise.name)}</li>`).join('')}</ul>` : '';
        const restDescription = entry.kind === 'rest' ? `<p class="agenda-form-help">${entry.recurring ? 'Recurring Rest. Repeats weekly; moving or deleting this date changes only this occurrence.' : entry.status === 'completed' ? 'Rest recorded for this date only.' : 'Manual Rest. Reserved for this date only.'}</p>` : '';
        this.dialogHTML(title, `<p class="agenda-entry-date">${escape(dateLabel(entry.date))}</p>${restDescription}${editable ? `<form id="agenda-move-form" class="agenda-form"><label>Date<input name="date" type="date" value="${date}" ${entry.kind === 'gym' ? `min="${this.view.today}"` : ''} required></label><p class="agenda-form-help"></p></form>` : `<p class="agenda-form-help">${escape(entry.movableReason || 'Recorded history stays unchanged.')}</p>`}${prescription}`, `${editable ? '<button type="button" class="agenda-remove">Delete</button>' : ''}<button type="button" data-agenda-cancel>Close</button>${entry.kind === 'rest' ? '<button type="button" data-agenda-recurring>Recurring rest days</button>' : ''}${currentGym ? '<button type="button" data-agenda-open>Open workout</button>' : ''}${recordable ? '<button type="button" data-agenda-record>Record activity</button>' : ''}${editable ? '<button type="submit" class="agenda-primary" form="agenda-move-form">Save date</button>' : ''}`);
        this.dialog.querySelector('[data-agenda-recurring]')?.addEventListener('click', () => this.officeDialog());
        this.dialog.querySelector('[data-agenda-open]')?.addEventListener('click', () => { this.closeDialog(); this.openWorkout(entry); });
        this.dialog.querySelector('[data-agenda-record]')?.addEventListener('click', () => this.commitChange({ type: 'complete', id: entry.id }));
        this.dialog.querySelector('.agenda-remove')?.addEventListener('click', event => this.saveChange({ type: 'remove', id: entry.id }, event.currentTarget, entry.kind === 'rest' ? 'Rest removed. Undo is available.' : 'Removed from the plan. Undo is available until affected training changes.'));
        if (!editable) return;
        const form = this.dialog.querySelector('form');
        const update = () => { form.querySelector('.agenda-form-help').textContent = ['run', 'activity'].includes(entry.kind) && form.elements.date.value <= this.view.today ? 'This records the existing activity on that date.' : entry.recurring ? 'Changes apply to this occurrence only.' : 'Other unfinished workouts keep their order.'; };
        form.addEventListener('change', update);
        update();
        form.addEventListener('submit', event => { event.preventDefault(); this.commitChange({ type: 'move', id: entry.id, date: form.elements.date.value, performed: ['run', 'activity'].includes(entry.kind) && form.elements.date.value <= this.view.today }); });
    }

    recordDialog(entry) {
        this.dialogHTML(entry.title, `<p class="agenda-entry-date">${escape(dateLabel(entry.date))}</p><form id="agenda-record-form" class="agenda-form"><label>Workout performed<select name="workoutDay" required>${(this.view.workouts || []).map(workout => `<option value="${workout.day}" ${workout.day === entry.day ? 'selected' : ''}>${escape(workout.title)}</option>`).join('')}</select></label><p class="agenda-form-help">Unstarted future workouts will follow the corrected record. Completed training stays unchanged.</p></form>`, '<button type="button" class="agenda-remove">Delete</button><button type="button" data-agenda-cancel>Close</button><button type="submit" class="agenda-primary" form="agenda-record-form">Save workout</button>');
        const form = this.dialog.querySelector('form');
        const submit = this.dialog.querySelector('[form="agenda-record-form"]');
        form.addEventListener('submit', event => {
            event.preventDefault();
            const day = form.elements.workoutDay.value === '' ? null : Number(form.elements.workoutDay.value);
            if (day === entry.day) { this.closeDialog(); return; }
            this.saveChange({ type: 'correctGym', id: entry.id, day }, submit, 'Workout corrected. Future plan updated. Undo is available.');
        });
        this.dialog.querySelector('.agenda-remove').addEventListener('click', event => this.saveChange({ type: 'removeGymRecord', id: entry.id }, event.currentTarget, 'Manual workout removed. Future plan updated. Undo is available.'));
    }

    officeDialog() {
        const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        this.dialogHTML('Rest days', `<form id="agenda-office-form" class="agenda-form"><p>Rest repeats on Mondays and Thursdays by default. Recorded and started workouts stay in place. Newly free days are not filled automatically.</p><label>Apply from<input name="effectiveDate" type="date" value="${this.view.today}" min="${this.view.today}" required></label><fieldset><legend>Repeat on</legend><div class="agenda-weekdays">${[1, 2, 3, 4, 5, 6, 0].map(day => `<label class="agenda-checkbox"><input type="checkbox" name="days" value="${day}" ${this.view.officeDays.includes(day) ? 'checked' : ''}>${names[day]}</label>`).join('')}</div></fieldset></form>`, '<button type="button" data-agenda-cancel>Cancel</button><button type="submit" class="agenda-primary" form="agenda-office-form">Save Rest days</button>');
        this.dialog.querySelector('form').addEventListener('submit', event => { event.preventDefault(); this.commitChange({ type: 'officeDays', days: [...this.dialog.querySelectorAll('input[name="days"]:checked')].map(input => Number(input.value)), effectiveDate: event.currentTarget.elements.effectiveDate.value }); });
    }

    async commitChange(intent) {
        const button = this.dialog.hidden ? null : this.dialog.querySelector('.agenda-primary, [data-agenda-record]');
        return this.saveChange(intent, button);
    }

    attachDrag() {
        this.element.addEventListener('pointerdown', event => {
            const card = event.target.closest('.agenda-entry[data-movable="true"]');
            const control = event.target.closest('button, input, select, a, textarea');
            if (!card || event.button !== 0 || event.isPrimary === false || (control && control !== card) || this.engine.pending) return;
            this.cancelDrag();
            this.drag = { card, id: card.dataset.entryId, pointer: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
            this.holdTimer = setTimeout(() => {
                if (!this.drag) return;
                this.drag.active = true;
                card.classList.add('is-moving');
                try { card.setPointerCapture(event.pointerId); } catch { this.cancelDrag(); return; }
                this.announce('Move to a date, then release to save. Escape cancels.');
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
            else this.commitChange({ type: 'move', id: entry.id, date });
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
                    this.announce(`Release on ${dateLabel(target.dataset.date)} to save the move.`);
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
