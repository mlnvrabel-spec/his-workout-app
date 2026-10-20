import { Modal } from './Modal.js';
import { effortLabel } from '../core/SetRecord.js';

export class SetEditor {
    constructor(engine, feedback) {
        this.engine = engine;
        this.feedback = feedback;
        this.panel = document.createElement('section');
        this.panel.className = 'set-editor';
        this.panel.innerHTML = `<form class="set-editor-form">
            <div class="history-head"><h2>Edit set</h2><button type="button" aria-label="Close set editor">×</button></div>
            <p class="set-editor-context"></p>
            <div class="set-editor-fields">
                <label>Load · kg<input name="weight" type="number" inputmode="decimal" min="0" max="2000" step="0.25" required></label>
                <label>Reps<input name="reps" type="number" inputmode="numeric" min="1" max="1000" step="1" required></label>
            </div>
            <p class="set-editor-effort"></p>
            <p class="set-editor-error" role="alert"></p>
            <div class="set-editor-actions"><button type="button" data-cancel>Cancel</button><button type="submit">Save changes</button></div>
        </form>`;
        document.body.append(this.panel);
        this.form = this.panel.querySelector('form');
        this.modal = new Modal(this.panel, () => this.close(), 'Edit set');
        this.panel.querySelector('[aria-label="Close set editor"]').onclick = () => this.close();
        this.panel.querySelector('[data-cancel]').onclick = () => this.close();
        this.form.addEventListener('submit', async event => {
            event.preventDefault();
            if (this.saving || !this.edit) return;
            this.saving = true;
            const button = this.form.querySelector('[type="submit"]');
            button.disabled = true;
            this.panel.querySelector('.set-editor-error').textContent = '';
            const { exerciseId, original, sessionId } = this.edit;
            const saved = await this.engine.editSet(exerciseId, original.set_number,
                Number(this.form.elements.weight.value), Number(this.form.elements.reps.value), original, sessionId);
            this.saving = false;
            button.disabled = false;
            if (saved) {
                this.close();
                this.feedback('Set corrected on this device');
            } else {
                this.panel.querySelector('.set-editor-error').textContent = 'Changes were not saved. If this set changed elsewhere, cancel and open Edit again.';
            }
        });
    }

    open(exerciseId, setNumber) {
        const original = this.engine.getExerciseLogs(exerciseId).find(set => set.set_number === setNumber);
        if (!original || this.engine.isDaySealed()) return;
        this.edit = { exerciseId, original: structuredClone(original), sessionId: this.engine.currentSession.session_id };
        const exercise = this.engine.protocolData[this.engine.state.day].exercises.find(ex => ex._exerciseId === exerciseId);
        this.panel.querySelector('.set-editor-context').textContent = `${exercise?.name || 'Exercise'} · Set ${setNumber}`;
        this.panel.querySelector('.set-editor-effort').textContent = effortLabel(original);
        this.panel.querySelector('.set-editor-error').textContent = '';
        this.form.elements.weight.value = original.weight_kg;
        this.form.elements.reps.value = original.reps;
        this.modal.open();
        this.form.elements.weight.focus();
    }

    close() {
        this.modal.close();
        const editButton = [...document.querySelectorAll('[data-edit-set]')]
            .find(button => button.dataset.exercise === this.edit?.exerciseId && Number(button.dataset.editSet) === this.edit?.original.set_number);
        editButton?.focus({ preventScroll: true });
    }
}
