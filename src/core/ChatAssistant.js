import { StorageManager } from './StorageManager.js';
import { Modal } from '../ui/Modal.js';
import { CoachConnection } from './CoachConnection.js';
import { describeSet } from './SetRecord.js';

export class ChatAssistant {
    constructor(engine) {
        this.engine = engine;
        this.storage = engine?.storage || new StorageManager();
        this.currentReadiness = 50;
        this.hasReadiness = false;
        this.isOpen = false;
        this.sending = false;
        this.history = [];
        // Remove the retired client-side secret, never read or transmit it.
        try { localStorage.removeItem('ai_key'); } catch {}
        window.addEventListener('garminReadinessUpdated', event => {
            this.hasReadiness = Number.isFinite(event.detail?.readiness_score);
            this.currentReadiness = this.hasReadiness ? event.detail.readiness_score : 50;
        });
        this.ov = document.getElementById('chat-ov');
        this.body = document.getElementById('chat-body');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');
        if (!this.ov) return;
        this.connection = new CoachConnection();
        this.setupConnection();
        this.modal = new Modal(this.ov, () => this.close(), 'Coaching assistant', () => this.open());
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
        this.open();
    }

    open() {
        this.isOpen = true;
        this.modal.open();
        this.ov.classList.add('show');
        document.getElementById('ai-fab').setAttribute('aria-expanded', 'true');
        this.input.focus();
        this.connection.status().then(() => this.connectionStatus()).catch(() => this.connectionStatus('Backend unavailable · open AI connection'));
    }
    close() {
        const form = document.getElementById('coach-connect-form');
        if (form) { form.elements.accessCode.value = ''; form.elements.apiKey.value = ''; }
        this.isOpen = false; this.ov.classList.remove('show'); document.getElementById('ai-fab').setAttribute('aria-expanded', 'false'); this.modal.close();
    }

    connectionStatus(message) {
        document.getElementById('coach-connection-status').textContent = message || (this.connection.connected ? `${this.connection.provider} · session ready` : 'Not connected');
        document.getElementById('coach-disconnect-btn').disabled = !this.connection.connected;
    }

    setupConnection() {
        const form = document.getElementById('coach-connect-form');
        const feedback = document.getElementById('coach-connect-feedback');
        form.elements.backend.value = this.connection.base;
        form.addEventListener('submit', async event => {
            event.preventDefault();
            const submit = form.querySelector('[type="submit"]');
            submit.disabled = true;
            feedback.textContent = 'Connecting…';
            try {
                await this.connection.connect(form.elements.backend.value, form.elements.provider.value, form.elements.accessCode.value, form.elements.apiKey.value.trim());
                feedback.textContent = 'Session ready. Your API key will be checked when you send a question.';
                this.connectionStatus();
                document.getElementById('coach-connection').open = false;
            } catch (error) { feedback.textContent = error.message || 'Connection failed. Check the backend address.'; }
            finally { form.elements.accessCode.value = ''; form.elements.apiKey.value = ''; submit.disabled = false; }
        });
        document.getElementById('coach-disconnect-btn').addEventListener('click', async () => {
            try { await this.connection.disconnect(); this.history = []; this.connectionStatus(); feedback.textContent = 'Disconnected. The backend session key has been removed.'; }
            catch { feedback.textContent = 'Could not disconnect from the backend. The session expires automatically within 8 hours.'; }
        });
    }

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
        const exercise = this.engine.protocolData.flatMap(day => day.exercises).find(ex => message.toLowerCase().includes(ex.name.toLowerCase())) || workout.exercises.find(ex => ex._exerciseId === this.focusedExerciseId) || workout.exercises[0];
        const previous = this.engine.getPreviousLog(exercise._exerciseId)?.sets.at(-1);
        const next = this.engine.protocolData[this.engine._nextDay(this.engine.state, this.engine.state.activeDay)];
        const payload = {
            readiness_score: this.currentReadiness, readiness_available: this.hasReadiness, exercise_name: exercise.name,
            last_session_log: previous ? describeSet(previous) : 'First time performing this logged locally.',
            target_rir: String(exercise.rir), rep_range: exercise.reps,
            message: message.slice(0, 2000), workout_title: workout.title, next_workout: next.title,
            exercise_names: workout.exercises.map(ex => ex.name), history: this.history.slice(-8)
        };
        this.sending = true;
        this.sendBtn.disabled = true;
        this.input.value = '';
        this.addMsg('You', message, 'user');
        try {
            const data = await this.connection.request('chat', { method: 'POST', body: payload });
            if (typeof data.cue !== 'string' || !data.cue.trim()) throw new Error('Empty response');
            this.addMsg(data.source === 'local' ? 'Coach · local guidance' : 'Coach', data.cue);
            if (data.source === 'provider') this.history = [...this.history, { role: 'user', content: message.slice(0, 2000) }, { role: 'assistant', content: data.cue.slice(0, 2000) }].slice(-8);
            else this.connectionStatus('AI unavailable · check connection, key or balance');
        } catch {
            const response = /next|plan|schedule/i.test(message)
                ? `Your current workout is ${workout.title}. Next in program order is ${next.title}. Use Home for the actual planned dates.`
                : `The AI connection is unavailable, so this is general local guidance. Follow the saved prescription and use a controlled, pain-free range on ${exercise.name}. Open AI connection to check the backend and session.`;
            this.addMsg('Coach · offline guidance', response);
        } finally { this.sending = false; this.sendBtn.disabled = false; }
    }

    async generateCoachingCue(exerciseId, exerciseName = "this exercise", prescription = {}) {
        this.focusedExerciseId = exerciseId;
        let previous;
        try {
            const archiveLog = this.engine?.getPreviousLog(exerciseId) || await this.storage.getLastArchiveLog(exerciseId);
            previous = archiveLog?.sets?.at(-1);
            let lastSessionStr = 'First time performing this logged locally.';

            if (archiveLog && archiveLog.sets && archiveLog.sets.length > 0) {
                const bestSet = archiveLog.sets.reduce((max, set) => set.weight_kg > max.weight_kg ? set : max, archiveLog.sets[0]);
                lastSessionStr = describeSet(bestSet);
            }

            const payload = {
                readiness_score: this.currentReadiness,
                readiness_available: this.hasReadiness,
                exercise_name: exerciseName,
                last_session_log: lastSessionStr,
                target_rir: prescription.targetRir || '1-2',
                rep_range: prescription.repRange || ''
            };

            const data = this.connection ? await this.connection.request('coach', { method: 'POST', body: payload }) : {};
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
