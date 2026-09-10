import { StorageManager } from './StorageManager.js';
import { Modal } from '../ui/Modal.js';

export class ChatAssistant {
    constructor(engine) {
        this.engine = engine;
        this.storage = engine?.storage || new StorageManager();
        this.currentReadiness = 50;
        this.isOpen = false;
        this.sending = false;
        // Remove the retired client-side secret, never read or transmit it.
        try { localStorage.removeItem('ai_key'); } catch {}
        window.addEventListener('garminReadinessUpdated', event => {
            this.currentReadiness = typeof event.detail?.readiness_score === 'number' ? event.detail.readiness_score : 50;
        });
        this.ov = document.getElementById('chat-ov');
        this.body = document.getElementById('chat-body');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');
        if (!this.ov) return;
        this.modal = new Modal(this.ov, () => this.close(), 'Coaching assistant');
        document.getElementById('ai-fab').onclick = () => this.toggle();
        document.getElementById('chat-close-btn').onclick = () => this.close();
        this.sendBtn.onclick = () => this.send();
        this.input.addEventListener('keydown', event => { if (event.key === 'Enter') this.send(); });
        this.body.setAttribute('role', 'log');
        this.body.setAttribute('aria-live', 'polite');
        this.addMsg('Coach', 'Ask about your current workout, previous sets, technique, or what comes next.');
    }

    toggle() {
        if (this.isOpen) return this.close();
        this.isOpen = true;
        this.modal.open();
        this.ov.classList.add('show');
        this.input.focus();
    }
    close() { this.isOpen = false; this.ov.classList.remove('show'); this.modal.close(); }

    addMsg(sender, text, type = 'ai') {
        if (!this.body) return;
        const row = document.createElement('div');
        row.className = `chat-msg ${type}`;
        const label = document.createElement('strong');
        label.textContent = sender;
        row.append(label, document.createElement('br'), document.createTextNode(text));
        this.body.append(row);
        this.body.scrollTop = this.body.scrollHeight;
    }

    async send() {
        const message = this.input.value.trim();
        if (!message || this.sending || !this.engine?.protocolData) return;
        const workout = this.engine.protocolData[this.engine.state.day];
        const exercise = workout.exercises.find(ex => message.toLowerCase().includes(ex.name.toLowerCase())) || workout.exercises[0];
        const previous = this.engine.getPreviousLog(exercise._exerciseId)?.sets.at(-1);
        const next = this.engine.protocolData[this.engine._nextDay(this.engine.state, this.engine.state.activeDay)];
        const payload = {
            readiness_score: this.currentReadiness, exercise_name: exercise.name,
            last_session_log: previous ? `${previous.weight_kg}kg x ${previous.reps}` : 'First time performing this logged locally.',
            target_rir: String(exercise.rir), rep_range: exercise.reps,
            message: message.slice(0, 2000), workout_title: workout.title, next_workout: next.title,
            exercise_names: workout.exercises.map(ex => ex.name)
        };
        this.sending = true;
        this.sendBtn.disabled = true;
        this.input.value = '';
        this.addMsg('You', message, 'user');
        try {
            const response = await fetch('http://localhost:8001/api/ai/chat', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload), signal: AbortSignal.timeout(7000)
            });
            if (!response.ok) throw new Error('Coach unavailable');
            const data = await response.json();
            if (typeof data.cue !== 'string' || !data.cue.trim()) throw new Error('Empty response');
            this.addMsg(data.source === 'local' ? 'Coach · local guidance' : 'Coach', data.cue);
        } catch {
            const response = /next|plan|schedule/i.test(message)
                ? `Your current workout is ${workout.title}. Next in program order is ${next.title}. Finish explicitly when you are ready; exercise checks are optional.`
                : this._fallbackCoachingCue(exercise.name, { targetRir: exercise.rir, repRange: exercise.reps }, previous);
            this.addMsg('Coach · offline guidance', response);
        } finally { this.sending = false; this.sendBtn.disabled = false; }
    }

    async generateCoachingCue(exerciseId, exerciseName = "this exercise", prescription = {}) {
        let previous;
        try {
            const archiveLog = this.engine?.getPreviousLog(exerciseId) || await this.storage.getLastArchiveLog(exerciseId);
            previous = archiveLog?.sets?.at(-1);
            let lastSessionStr = 'First time performing this logged locally.';

            if (archiveLog && archiveLog.sets && archiveLog.sets.length > 0) {
                const bestSet = archiveLog.sets.reduce((max, set) => set.weight_kg > max.weight_kg ? set : max, archiveLog.sets[0]);
                lastSessionStr = `${bestSet.weight_kg}kg x ${bestSet.reps} reps @ rpe ${bestSet.rpe}`;
            }

            const payload = {
                readiness_score: this.currentReadiness,
                exercise_name: exerciseName,
                last_session_log: lastSessionStr,
                target_rir: prescription.targetRir || '1-2',
                rep_range: prescription.repRange || ''
            };

            const response = await fetch('http://localhost:8001/api/ai/coach', {
                signal: AbortSignal.timeout(7000),
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Backend failed');
            }

            const data = await response.json();
            return data.cue || this._fallbackCoachingCue(exerciseName, prescription, previous);

        } catch (error) {

            return this._fallbackCoachingCue(exerciseName, prescription, previous);
        }
    }

    _fallbackCoachingCue(exerciseName, prescription, previous = null) {
        const repRange = prescription.repRange || 'the prescribed range';
        const targetRir = prescription.targetRir || '1-2';
        const target = this.currentReadiness > 75
            ? `Readiness is high: add one rep within ${repRange} at ${targetRir} RIR before increasing load.`
            : this.currentReadiness < 40
                ? `Readiness is low: match or reduce the prior load and stay within ${repRange} at ${targetRir} RIR.`
                : `Use a repeatable load within ${repRange} and finish around ${targetRir} RIR.`;
        const history = previous ? `You previously logged ${previous.weight_kg}kg for ${previous.reps} reps.` : 'No prior session is available, so establish a clean baseline today.';
        return `${history} ${target} Use a controlled eccentric and full pain-free range on ${exerciseName}.`;
    }
}
