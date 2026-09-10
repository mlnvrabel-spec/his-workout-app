import { Modal } from './Modal.js';

export class HistoryPanel {
    constructor(engine) {
        this.engine = engine;
        this.panel = document.createElement('section');
        this.panel.className = 'history-panel';
        this.panel.innerHTML = `<div class="history-head"><h2>Training history</h2><button aria-label="Close history">×</button></div><p class="history-intro">Your completed sessions, saved on this device.</p><button class="export-history">Export history</button><div class="history-list"></div>`;
        document.body.append(this.panel);
        this.modal = new Modal(this.panel, () => this.modal.close(), 'Training history');
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
            if (!data.workouts.length) list.textContent = 'Your first finished workout will appear here.';
            for (const workout of data.workouts) {
                const details = document.createElement('details');
                const summary = document.createElement('summary');
                summary.textContent = `${workout.title} · ${new Date(workout.completedAt).toLocaleDateString()} · ${workout.completedExercises}/${workout.totalExercises} checked`;
                details.append(summary);
                if (!workout.exercises) {
                    const note = document.createElement('p');
                    note.textContent = 'This older session has a completion count only.';
                    details.append(note);
                }
                for (const [index, exercise] of (workout.exercises || []).entries()) {
                    const row = document.createElement('p');
                    const checked = workout.done?.[workout.day]?.[`ex-${workout.day}-${index}`];
                    const log = data.logs.find(l => l.workout_id === `${workout.cycleId}:${workout.day}` && l.exercise_id === exercise._exerciseId);
                    row.textContent = `${checked ? '✓ ' : ''}${exercise.name} · ${log?.sets.map(set => `${set.weight_kg} kg × ${set.reps}`).join(' / ') || 'No sets logged'}`;
                    details.append(row);
                }
                list.append(details);
            }
        } catch (error) { list.textContent = `History could not be loaded: ${error.message}`; }
    }
}
