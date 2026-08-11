/**
 * ChatAssistant.js
 * 
 * Handles the Mr. Olympia AI interface, keeping the "Brain" separate from the "State".
 * Consumes state from the WorkoutEngine via CustomEvents.
 */
import { StorageManager } from './StorageManager.js';

export class ChatAssistant {
    constructor() {
        this.isOpen = false;
        this.history = [];
        this.currentWorkoutInfo = { title: 'Unknown', logsText: 'No logs available.' };
        this.currentReadiness = 50; // default medium readiness
        this.storage = new StorageManager();
        
        // Listen to updates from the Engine to keep context fresh
        window.addEventListener('workoutStateUpdated', (e) => {
            this.currentWorkoutInfo = e.detail;
        });

        // Listen for Garmin Readiness updates
        window.addEventListener('garminReadinessUpdated', (e) => {
            if (e.detail && typeof e.detail.readiness_score === 'number') {
                this.currentReadiness = e.detail.readiness_score;
            }
        });

        this.initDOM();
    }

    initDOM() {
        this.ov = document.getElementById('chat-ov');
        this.btn = document.getElementById('ai-fab');
        this.close = document.getElementById('chat-close-btn');
        this.setBtn = document.querySelector('.settings-btn');
        this.cfg = document.getElementById('api-cfg');
        this.input = document.getElementById('chat-input');
        this.sendBtn = document.getElementById('chat-send-btn');
        this.body = document.getElementById('chat-body');
        this.keyInput = document.getElementById('api-key-input');
        
        if(this.cfg) {
            const ver = document.createElement('div');
            ver.style = 'font-size:10px; opacity:0.5; margin-top:10px;';
            ver.innerText = 'Logic Version: 4.0.4 - Modular Service';
            this.cfg.appendChild(ver);
        }

        // Bind events if elements exist
        if(this.btn) this.btn.addEventListener('click', () => this.toggle());
        if(this.close) this.close.addEventListener('click', () => { this.isOpen = false; this.updateUI(); });
        
        if(this.setBtn && this.cfg) {
            this.setBtn.addEventListener('click', () => {
                this.cfg.classList.toggle('show');
                if(this.cfg.classList.contains('show')) {
                    const saved = localStorage.getItem('ai_key');
                    if(saved) {
                        this.keyInput.value = saved;
                        this.keyInput.type = 'password';
                    }
                }
            });

            this.cfg.addEventListener('submit', (e) => {
                e.preventDefault();
                const val = this.keyInput.value.trim();
                if(val) {
                    localStorage.setItem('ai_key', val);
                    this.keyInput.type = 'password';
                    this.cfg.classList.remove('show');
                    this.addMsg('System', '✅ API Key saved. You\'re all set!', 'system');
                }
            });
        }

        if(this.sendBtn && this.input) {
            this.sendBtn.addEventListener('click', () => this.send());
            this.input.addEventListener('keypress', e => { if(e.key === 'Enter') this.send(); });
        }

        this.addMsg('Mr. Olympia', "Ready when you are. Ask me about technique, swaps, or your plan.", 'ai');
        
        // Dispatch event asking for initial state injection
        window.dispatchEvent(new CustomEvent('requestWorkoutState'));
    }

    toggle() {
        this.isOpen = !this.isOpen;
        this.updateUI();
        if(this.isOpen && this.input) setTimeout(() => this.input.focus(), 300);
    }

    updateUI() {
        if(!this.ov) return;
        if(this.isOpen) this.ov.classList.add('show');
        else this.ov.classList.remove('show');
    }

    addMsg(sender, text, type) {
        if(!this.body) return;
        const d = document.createElement('div');
        d.className = 'chat-msg ' + type;
        d.innerHTML = type === 'system' ? text : `<strong>${sender}</strong><br/>${text.replace(/\n/g, '<br/>')}`;
        this.body.appendChild(d);
        this.body.scrollTop = this.body.scrollHeight;
    }

    async send() {
        if(!this.input) return;
        const text = this.input.value.trim();
        if(!text) return;
        
        const key = localStorage.getItem('ai_key');
        if(!key) {
            this.addMsg('System', '⚠️ No API Key found. Tap the ⚙️ icon above, paste your Gemini (AIza...) or OpenAI (sk-...) key, and hit Save.', 'system');
            if(this.cfg) this.cfg.classList.add('show');
            return;
        }

        this.input.value = '';
        this.addMsg('You', text, 'user');
        this.history.push({role: 'user', content: text});

        const isGemini = key.startsWith('AIza');
        const isAnthropic = key.startsWith('sk-ant');
        
        const sysPrompt = `Coach Olympia. Concise advice. Workout: ${this.currentWorkoutInfo.title}. Logs: ${this.currentWorkoutInfo.logsText}`;

        const typingDiv = document.createElement('div');
        typingDiv.className = 'chat-msg ai';
        typingDiv.innerText = 'Analyzing...';
        this.body.appendChild(typingDiv);
        this.body.scrollTop = this.body.scrollHeight;

        try {
            let replyText = '';
            if(isGemini) {
                const tryModel = async (modelName, retryOn429 = true) => {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${key}`;
                    const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            contents: [{ parts: [{ text: sysPrompt + '\n' + text }] }]
                        })
                    });
                    if(res.status === 429 && retryOn429) {
                        typingDiv.innerText = 'Rate limited, retrying...';
                        await new Promise(r => setTimeout(r, 3000));
                        return tryModel(modelName, false);
                    }
                    const data = await res.json();
                    if(data.error) {
                        const e = new Error(data.error.message);
                        e.status = data.error.code || res.status;
                        throw e;
                    }
                    return data.candidates[0].content.parts[0].text;
                };
                
                try {
                    replyText = await tryModel('gemini-2.0-flash');
                } catch (e) {
                    try {
                        replyText = await tryModel('gemini-2.0-flash-lite');
                    } catch (e2) {
                        throw e2;
                    }
                }
            } else if (isAnthropic) {
                const res = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-api-key': key,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true'
                    },
                    body: JSON.stringify({ 
                        model: 'claude-3-haiku-20240307', 
                        max_tokens: 400,
                        system: sysPrompt,
                        messages: [...this.history]
                    })
                });
                const data = await res.json();
                if(data.error) {
                    const e = new Error(data.error.message);
                    e.status = res.status;
                    throw e;
                }
                replyText = data.content[0].text;
            } else {
                const msgs = [{ role: 'system', content: sysPrompt }, ...this.history];
                const res = await fetch('https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
                    body: JSON.stringify({ 
                        model: 'gpt-4o-mini', 
                        messages: msgs.map(m => ({role: m.role === 'system' ? 'system' : (m.role === 'user' ? 'user' : 'assistant'), content: m.content})) 
                    })
                });
                const data = await res.json();
                if(data.error) throw new Error(data.error.message);
                replyText = data.choices[0].message.content;
            }

            typingDiv.remove();
            this.addMsg('Mr. Olympia', replyText, 'ai');
            this.history.push({role: 'assistant', content: replyText});
        } catch(err) {
            console.error("Mr. Olympia API Error:", err);
            typingDiv.remove();
            const msg = err.message || 'Unknown error';
            const status = err.status || 0;
            
            if(status === 429 || msg.includes('quota') || msg.includes('RATE') || msg.includes('exhausted')) {
                this.addMsg('System', '⚠️ Rate limited or quota exhausted. Wait a minute and try again.', 'system');
            } else if(status === 403 || msg.includes('API key') || msg.includes('PERMISSION') || msg.includes('forbidden')) {
                this.addMsg('System', '⚠️ Invalid API Key. Please check your key in ⚙️ settings.', 'system');
            } else if(status === 404 || msg.includes('not found')) {
                this.addMsg('System', '⚠️ Model not available for this key. Try a different API key.', 'system');
            } else {
                this.addMsg('System', '⚠️ Error: ' + msg, 'system');
            }
        }
    }

    /**
     * Mr. Olympia Pre-Workout/In-Workout Coaching Cue.
     * Hits the Python backend `/api/ai/coach` matching RAG constraints.
     * @param {string} exerciseId - e.g., 'ex_001'
     * @param {string} exerciseName - Optional display name
     * @returns {Promise<string>} The coaching cue text.
     */
    async generateCoachingCue(exerciseId, exerciseName = "this exercise") {
        try {
            const archiveLog = await this.storage.getLastArchiveLog(exerciseId);
            let lastSessionStr = 'First time performing this logged locally.';
            
            if (archiveLog && archiveLog.sets && archiveLog.sets.length > 0) {
                const bestSet = archiveLog.sets.reduce((max, set) => set.weight_kg > max.weight_kg ? set : max, archiveLog.sets[0]);
                lastSessionStr = `${bestSet.weight_kg}kg x ${bestSet.reps} reps @ rpe ${bestSet.rpe}`;
            }

            const payload = {
                readiness_score: this.currentReadiness,
                exercise_name: exerciseName,
                last_session_log: lastSessionStr
            };

            const response = await fetch('http://localhost:8001/api/ai/coach', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Backend failed');
            }
            
            const data = await response.json();
            return data.cue || `Focus purely on technique today with a 3-second eccentric on ${exerciseName}.`;
            
        } catch (error) {
            console.error('[ChatAssistant] Error generating coaching cue:', error);
            return `Focus purely on technique today with a 3-second eccentric on ${exerciseName}.`;
        }
    }
}
