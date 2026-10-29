import { Modal } from './Modal.js';
import { describeSet } from '../core/SetRecord.js';

export class HistoryPanel {
    constructor(engine) {
        this.engine = engine;
        this.panel = document.createElement('section');
        this.panel.className = 'history-panel';
        this.panel.innerHTML = `<div class="history-head"><h2>Training history</h2><button aria-label="Close history">×</button></div><p class="history-intro">Sessions counted toward training, saved on this device. Finish confirms every exercise; a counted session may still be editable today.</p><button class="export-history">Export history</button><div class="history-list"></div>`;
        const privacy = document.createElement('p');
        privacy.className = 'history-intro';
        privacy.textContent = 'Export downloads a readable JSON file with workout dates, sets and your schedule. Keep it private. It excludes Coach messages, API keys and connection credentials.';
        this.panel.querySelector('.export-history').after(privacy);
        this.panel.querySelector('.history-list').after(this.panel.querySelector('.export-history'), privacy);
        document.body.append(this.panel);
        this.modal = new Modal(this.panel, () => this.modal.close(), 'Training history', () => this.open());
        this.panel.querySelector('.history-head button').onclick = () => this.modal.close();
        document.getElementById('history-btn').onclick = () => this.open();
        this.panel.querySelector('.export-history').onclick = async () => {
            try {
                const data = await engine.exportHistory();
                const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
                const link = document.createElement('a');
                link.href = url;
                link.download = `training-history-${engine.storage.getDateKey()}.json`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(url), 10000);
            } catch (error) { this.panel.querySelector('.history-intro').textContent = `Export failed: ${error.message}`; }
        };
    }

    async open() {
        this.modal.open();
        const list = this.panel.querySelector('.history-list');
        list.textContent = 'Loading sessions…';
        try {
            const data = await this.engine.exportHistory();
            list.replaceChildren();
            if (!data.workouts.length) list.textContent = 'No sessions recorded yet. Check at least half a workout’s exercises, select Finish, or record a past gym session from Calendar.';
            for (const workout of data.workouts) {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = `${workout.title} · ${new Date(workout.completedAt).toLocaleDateString()} · ${workout.source === 'manual_backfill' ? 'Recorded retrospectively · Sets not supplied' : `${workout.completedExercises}/${workout.totalExercises} checked · ${this.engine.getSessionStatus(workout.day, workout.cycleId)}`}`;
                details.append(summary);
                if (!workout.exercises) {
                    const note = document.createElement('p');
                    note.textContent = workout.source === 'manual_backfill' ? 'You recorded this session as performed. No sets or exercise checks were added.' : 'This older session has a completion count only.';
                    details.append(note);
                }
                for (const index of (workout.order || (workout.exercises || []).map((_, i) => i))) {
                    const exercise = workout.exercises[index];
                    const row = document.createElement('p');
                    const checked = workout.done?.[workout.day]?.[`ex-${workout.day}-${index}`];
                    const log = data.logs.find(l => l.workout_id === `${workout.cycleId}:${workout.day}` && l.exercise_id === exercise._exerciseId);
                    row.textContent = `${checked ? '✓ ' : ''}${exercise.name} · ${log?.sets.map(describeSet).join(' / ') || 'No sets logged'}`;
                    details.append(row);
                }
                list.append(details);
            }
        } catch (error) { list.textContent = `History could not be loaded: ${error.message}`; }
    }
}
