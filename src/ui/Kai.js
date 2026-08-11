/**
 * Kai.js (Motion & Interaction Module)
 * Responsible for UI rendering, motion physics, haptics, and event delegation.
 */
import { HeroHeader } from './HeroHeader.js?v=3';
import { ExerciseCards } from './ExerciseCards.js?v=6';

export class Kai {
    constructor(engine, chat) {
        this.engine = engine;
        this.chat = chat;
        
        this.els = {
            header: document.getElementById('header'),
            cards: document.getElementById('cards'),
            navDock: document.getElementById('nav-dock'),
            themeBtn: document.getElementById('theme-btn')
        };
        
        // Motion Physics Curve: "Memory Foam"
        this.memoryFoam = 'cubic-bezier(0.22, 1, 0.36, 1)';
        this.expandedCardId = null;
        this.heroHeader = new HeroHeader();
        this.exerciseCards = new ExerciseCards(this.els.cards, this.engine, this.memoryFoam);

        this.setupListeners();
        this.setupEventDelegation();
        this.setupNavGestures();
        
        if (this.els.themeBtn) {
            this.els.themeBtn.addEventListener('click', () => this.toggleTheme());
        }
    }

    setupListeners() {
        // Core Event Subscribers (The Listener)
        window.addEventListener('engine:ready', (e) => this.render(e.detail?.state || this.engine.state));
        window.addEventListener('engine:state_updated', (e) => {
            const state = e.detail?.state || this.engine.state;
            const type = e.detail?.type;
            if (type === 'exercise_complete') {
                this.updateCompletionState(state);
            } else if (type === 'exercise_swap') {
                this.updateSwappedCard(state, e.detail);
            } else {
                this.render(state);
            }
        });
        window.addEventListener('set:logged', (e) => this.onSetLogged(e.detail));
        window.addEventListener('workout:sync_queued', (e) => this.onSyncQueued(e.detail));
        
        this.heroHeader.bindScrollCollapse(document.getElementById('app'));
    }

    /**
     * "Invisible Luxury" Rendering:
     * Render the Bento Hero Section and the expandable Exercise Cards from state.
     * Do NOT store state locally.
     */
    render(state) {
        if (!state) return;

        const workout = this.engine?.protocolData?.[state.day] || state.currentDayOpts;
        if (!workout) return;

        this.heroHeader.renderDay(workout);
        this.heroHeader.renderTrainingFlow(this.engine?.StorageManager, this.engine?.protocolData, state.day);

        const doneIds = state.done?.[state.day]
            ? Object.keys(state.done[state.day]).filter(id => state.done[state.day][id])
            : (this.engine?.getDoneArray ? this.engine.getDoneArray(state.day) : []);
        this.exerciseCards.render(
            state.day,
            workout,
            doneIds,
            this.expandedCardId,
            card => this.toggleCard(card),
            (card, event) => this.closeExpandedCard(card, event)
        );
        this.updateNavState(state.day);
    }

    toggleCard(card) {
        const wasActive = this.expandedCardId === card.id;
        this.expandedCardId = wasActive ? null : card.id;
        document.querySelectorAll('.card-wrapper').forEach(item => item.classList.remove('active'));
        if (!wasActive) {
            card.classList.add('active');
            this.scrollCardToTop(card);
        }
    }

    closeExpandedCard(card, event) {
        if (!card.classList.contains('active') || event.target.closest('.card-head, input, button, .check-wrap')) return;
        this.expandedCardId = null;
        card.classList.remove('active');
    }

    updateSwappedCard(state, detail) {
        const day = detail?.dayIndex;
        const exerciseSlot = detail?.exerciseSlot;
        const workout = this.engine?.protocolData?.[day] || state.currentDayOpts;
        if (!Number.isInteger(day) || !Number.isInteger(exerciseSlot) || !workout) {
            this.render(state);
            return;
        }

        const doneIds = state.done?.[day]
            ? Object.keys(state.done[day]).filter(id => state.done[day][id])
            : (this.engine?.getDoneArray ? this.engine.getDoneArray(day) : []);
        this.exerciseCards.replaceCard(
            day,
            workout,
            exerciseSlot,
            doneIds,
            this.expandedCardId,
            card => this.toggleCard(card),
            (card, event) => this.closeExpandedCard(card, event)
        );
    }

    /**
     * Surgically update the DOM for exercise completions without destroying existing elements,
     * preventing visual blinking and loss of expanded state.
     */
    updateCompletionState(state) {
        if (!state) return;
        
        const doneArr = state.done?.[state.day] 
            ? Object.keys(state.done[state.day]).filter(id => state.done[state.day][id])
            : (this.engine?.getDoneArray ? this.engine.getDoneArray(state.day) : []);
            
        // 1. Update Exercise Cards
        const cards = document.querySelectorAll('.card-wrapper');
        cards.forEach(card => {
            if (doneArr.includes(card.id)) {
                card.classList.add('done');
            } else {
                card.classList.remove('done');
            }
        });

        // 2. Update Finish Session Button State
        const protocolLen = this.engine?.protocolData?.length || 1;
        const mappedDay = state.day % protocolLen;
        const dOpts = this.engine?.protocolData?.[mappedDay] || state.currentDayOpts;
        if (dOpts && dOpts.exercises) {
            const isDayFinished = doneArr.length === dOpts.exercises.length && dOpts.exercises.length > 0;
            const finishBtn = document.getElementById('finish-workout-btn');
            if (finishBtn) {
                finishBtn.textContent = isDayFinished ? 'Uncheck All' : 'Complete All';
                finishBtn.classList.toggle('finish-btn--undo', isDayFinished);
            }
        }
    }

    /**
     * DOM Decoupling: Event Delegation on #cards
     */
    setupEventDelegation() {
        if (!this.els.cards) return;

        // Pointer state for swipes
        let isDragging = false;
        let isVerticalScroll = false;
        let isSwapping = false;
        let startX = 0, startY = 0, currentX = 0;
        let activeCard = null, activeWrap = null, activeBg = null, activeHead = null;

        // 1. Click Handling
        this.els.cards.addEventListener('click', async (e) => {
            // Stepper -
            if (e.target.closest('.step-down')) {
                e.stopPropagation();
                if (navigator.vibrate) navigator.vibrate(75); // Haptic Language
                const input = e.target.closest('.stepper').querySelector('input');
                if(!input.value && input.placeholder && input.placeholder !== '0') input.value = input.placeholder;
                input.stepDown();
                this.triggerSave(input);
                return;
            }
            // Stepper +
            if (e.target.closest('.step-up')) {
                e.stopPropagation();
                if (navigator.vibrate) navigator.vibrate(75); // Haptic Language
                const input = e.target.closest('.stepper').querySelector('input');
                if(!input.value && input.placeholder && input.placeholder !== '0') input.value = input.placeholder;
                input.stepUp();
                this.triggerSave(input);
                return;
            }
            
            // Bulk Completion Button
            const finishBtn = e.target.closest('#finish-workout-btn');
            if (finishBtn) {
                const protocolLen = this.engine?.protocolData?.length || 1;
                const mappedDay = this.engine.state.day % protocolLen;
                const dOpts = this.engine?.protocolData?.[mappedDay] || this.engine.state.currentDayOpts;
                const exercises = dOpts?.exercises || [];
                const dayKey = this.engine.state.day;
                
                const doneCount = Object.values(this.engine.state.done[dayKey] || {}).filter(Boolean).length;
                const isDayFinished = exercises.length > 0 && doneCount >= exercises.length;

                if (navigator.vibrate) navigator.vibrate(isDayFinished ? 40 : [80, 50, 120]);
                this.engine?.toggleAll?.(dayKey, !isDayFinished, exercises);
                return;
            }

            // Checkbox completion
            if (e.target.closest('.check-wrap')) {
                e.stopPropagation();
                const wrap = e.target.closest('.card-wrapper');
                if (wrap && this.engine?.toggleComplete) {
                    this.engine.toggleComplete(wrap.id, this.engine.state.day);
                }
                return;
            }

            // Card Expansion
            if (e.target.closest('.card-head')) {
                const now = Date.now();
                if (now - (this.lastCardToggleAt || 0) < 250) return;
                this.lastCardToggleAt = now;
                const wrap = e.target.closest('.card-wrapper');
                if (!wrap) return;
                
                const wasActive = wrap.classList.contains('active');
                document.querySelectorAll('.card-wrapper').forEach(w => w.classList.remove('active'));
                
                if (!wasActive) {
                    wrap.classList.add('active');
                    setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);

                    // AI Coaching integration (if ChatAssistant exists)
                    if (this.chat) {
                        const vizNode = wrap.querySelector('.detail-text');
                        if (vizNode) {
                            const originalViz = vizNode.dataset.orig || vizNode.innerText;
                            if(!vizNode.dataset.orig) vizNode.dataset.orig = originalViz;
                            const exName = wrap.querySelector('.ex-name').innerText;
                            vizNode.innerHTML = `<span style="opacity:0.5">Olympia AI analyzing ${exName}...</span>`;
                            this.chat.generateCoachingCue('ex_'+wrap.id, exName)
                                .then(cue => vizNode.innerHTML = `<strong style="color:var(--teal)">ðŸ§  ${cue}</strong><br><br><span style="opacity:0.6">${originalViz}</span>`)
                                .catch(() => vizNode.innerText = originalViz);
                        }
                    }
                }
            }
        });

        // 2. Input changes (Logs)
        this.els.cards.addEventListener('input', (e) => {
            if (e.target.tagName === 'INPUT') {
                clearTimeout(e.target.saveTimeout);
                e.target.saveTimeout = setTimeout(() => this.triggerSave(e.target), 500);
            }
        });

        // 3. Pointer Gestures (Swipe to complete & Swipe to swap)
        this.els.cards.addEventListener('pointerdown', (e) => {
            if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.check-wrap')) return;
            
            // Check if we're hitting a swappable head
            activeHead = e.target.closest('.card-head[data-swappable="true"]');
            
            const card = e.target.closest('.card');
            if (!card) return;

            isDragging = true;
            isVerticalScroll = false;
            isSwapping = false;
            startX = e.clientX;
            startY = e.clientY;
            currentX = 0;
            activeCard = card;
            activeWrap = card.closest('.card-wrapper');
            activeBg = activeWrap.querySelector('.swipe-bg');

            if (!activeHead) {
                try { activeCard.setPointerCapture(e.pointerId); } catch(err) {}
            }
            
            if (!activeHead) {
                activeWrap.classList.add('dragging');
                activeCard.style.transition = 'none';
            }
        });

        this.els.cards.addEventListener('pointermove', (e) => {
            if (!isDragging || !activeCard) return;

            const diffY = Math.abs(e.clientY - startY);
            const diffX = e.clientX - startX;

            // Detect vertical scroll and abort swipe
            if (!isSwapping && diffY > 10 && Math.abs(diffX) < 15) {
                isVerticalScroll = true;
                isDragging = false;
                if (!activeHead) {
                    activeWrap.classList.remove('dragging');
                    activeCard.style.transition = `transform 0.3s ${this.memoryFoam}, height 0.4s ${this.memoryFoam}`;
                }
                try { (activeHead || activeCard).releasePointerCapture(e.pointerId); } catch(err) {}
                activeCard = null; activeHead = null;
                return;
            }

            // Handle horizontal move
            if (activeHead) {
                // Swap logic (left or right)
                if (Math.abs(diffX) > 8 && Math.abs(diffX) > diffY * 1.5) {
                    isSwapping = true;
                    e.preventDefault(); // prevent scroll
                    const nameEl = activeHead.querySelector('.ex-name');
                    if (nameEl) nameEl.style.transform = `translateX(${Math.round(diffX * 0.25)}px)`;
                }
            } else {
                // Swipe to complete logic (right only)
                currentX = diffX;
                if (currentX < 0) currentX = 0;
                activeCard.style.transform = `translateX(${currentX}px)`;
                if (activeBg) {
                    activeBg.style.opacity = Math.min(currentX / 100, 1);
                    if (currentX > 60) activeBg.classList.add('active');
                    else activeBg.classList.remove('active');
                }
            }
        });

        const onPointerEnd = (e) => {
            if (isVerticalScroll || !isDragging || !activeCard) {
                isVerticalScroll = false;
                return;
            }
            isDragging = false;
            try { (activeHead || activeCard).releasePointerCapture(e.pointerId); } catch(err) {}

            if (activeHead) {
                const diffX = e.clientX - startX;
                if (isSwapping) {
                    activeWrap.dataset.swipeHandled = 'true';
                    setTimeout(() => delete activeWrap.dataset.swipeHandled, 300);
                }
                const nameEl = activeHead.querySelector('.ex-name');
                if (nameEl) {
                    nameEl.style.transform = '';
                    nameEl.style.transition = `transform 0.25s ${this.memoryFoam}`;
                    setTimeout(() => nameEl.style.transition = '', 300);
                }
                
                if (isSwapping && Math.abs(diffX) > 44) {
                    const direction = diffX < 0 ? 1 : -1;
                    if (navigator.vibrate) navigator.vibrate([30, 20, 60]); // minor swap feedback
                    if (nameEl) {
                        nameEl.classList.add('ex-name--swap');
                        setTimeout(() => nameEl.classList.remove('ex-name--swap'), 350);
                    }
                    if (this.engine?.cycleSwap) {
                        const slot = parseInt(activeWrap.dataset.idx);
                        this.engine.cycleSwap(this.engine.state.day, slot, direction);
                    }
                }
            } else {
                activeWrap.classList.remove('dragging');
                if (currentX > 60) {
                    if (navigator.vibrate) navigator.vibrate([100, 50, 100]); // swipe-to-complete threshold
                    if (this.engine?.toggleComplete) {
                        this.engine.toggleComplete(activeWrap.id, this.engine.state.day);
                    }
                }

                activeCard.style.transition = `transform 0.3s ${this.memoryFoam}`;
                activeCard.style.transform = 'translateX(0px)';
                if (activeBg) {
                    activeBg.style.opacity = 0;
                    activeBg.classList.remove('active');
                }

                // Restore height transition after transform settles
                const c = activeCard;
                setTimeout(() => {
                    if (c) c.style.transition = `transform 0.3s ${this.memoryFoam}, height 0.4s ${this.memoryFoam}`;
                }, 300);
            }
            
            activeCard = null; activeWrap = null; activeBg = null; activeHead = null;
        };

        this.els.cards.addEventListener('pointerup', onPointerEnd);
        this.els.cards.addEventListener('pointercancel', onPointerEnd);
    }

    triggerSave(inputEl) {
        const wrap = inputEl.closest('.card-wrapper');
        if (!wrap) return;
        const exName = wrap.dataset.exname;
        const wt = wrap.querySelector('.log-wt').value;
        const reps = wrap.querySelector('.log-reps').value;
        
        // This triggers engine to eventually fire `set:logged` and `workout:sync_queued`.
        if (this.engine?.logExercise) {
            this.engine.logExercise(exName, wt, reps);
        }
    }

    scrollCardToTop(cardWrap) {
        const app = document.getElementById('app');
        if (!app || !this.els.header) return;

        const cardTop = cardWrap.getBoundingClientRect().top - app.getBoundingClientRect().top + app.scrollTop;
        app.scrollTo({ top: Math.max(0, cardTop - this.els.header.offsetHeight), behavior: 'smooth' });
    }

    /**
     * Micro-Interactions
     */
    onSetLogged(detail) {
        if (!detail || !detail.exerciseId) return;
        
        const cards = document.querySelectorAll('.card-wrapper');
        let targetCard = null;
        for (let c of cards) {
            // Find by matching id (e.g. ex-0-1), dataset exercise name, or the resolved exerciseName
            if (c.id === detail.exerciseId || 
                c.dataset.exname === detail.exerciseId || 
                (detail.exerciseName && c.dataset.exname === detail.exerciseName)) {
                targetCard = c;
                break;
            }
        }

        if (targetCard) {
            // Subtle Green Glow confirming the save
            const innerCard = targetCard.querySelector('.card');
            if (innerCard) {
                const originalShadow = innerCard.style.boxShadow;
                innerCard.style.transition = `box-shadow 0.3s ${this.memoryFoam}`;
                innerCard.style.boxShadow = '0 0 15px rgba(74, 222, 128, 0.6)';
                setTimeout(() => innerCard.style.boxShadow = originalShadow, 800);
            }
        }
    }

    onSyncQueued(detail) {
        // Frosted-glass "Syncing..." pill
        let pill = document.getElementById('kai-sync-pill');
        if (!pill) {
            pill = document.createElement('div');
            pill.id = 'kai-sync-pill';
            pill.innerText = 'Syncing...';
            Object.assign(pill.style, {
                position: 'fixed',
                top: '20px',
                left: '50%',
                transform: 'translateX(-50%)',
                padding: '8px 16px',
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                WebkitBackdropFilter: 'blur(10px)',
                borderRadius: '20px',
                color: 'var(--text1)',
                fontSize: '0.9rem',
                fontWeight: '600',
                zIndex: '9999',
                opacity: '0',
                transition: `opacity 0.3s ${this.memoryFoam}`
            });
            document.body.appendChild(pill);
            void pill.offsetWidth; // Reflow
        }

        pill.style.opacity = '1';
        clearTimeout(this.syncPillTimeout);
        this.syncPillTimeout = setTimeout(() => pill.style.opacity = '0', 1500);
    }

    setupNavGestures() {
        if (!this.els.navDock) return;
        
        const navItems = this.els.navDock.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            let pressTimer;
            let longPressed = false;
            
            const startPress = () => {
                longPressed = false;
                pressTimer = setTimeout(() => {
                    longPressed = true;
                    if(navigator.vibrate) navigator.vibrate([100, 50, 100]); // medium feedback
                    const dIdx = parseInt(item.dataset.day);
                    if(confirm(`Reset Day ${dIdx + 1}?`)) {
                        this.engine?.resetDayLogs?.(dIdx);
                    }
                }, 800);
            };
            
            const cancelPress = () => clearTimeout(pressTimer);

            item.addEventListener('pointerdown', startPress);
            item.addEventListener('pointerup', cancelPress);
            item.addEventListener('pointerleave', cancelPress);
            item.addEventListener('pointercancel', cancelPress);
            item.addEventListener('contextmenu', e => e.preventDefault());

            item.addEventListener('click', (e) => {
                if (longPressed) { e.preventDefault(); return; }
                if (this.engine?.setDay) {
                    this.engine.setDay(parseInt(item.dataset.day));
                }
            });
        });
    }

    updateNavState(activeDay) {
        if (!this.els.navDock) return;
        this.els.navDock.querySelectorAll('.nav-item').forEach((n) => {
            if (parseInt(n.dataset.day) === activeDay) n.classList.add('active');
            else n.classList.remove('active');
        });
    }

    toggleTheme() {
        const isL = document.body.getAttribute('data-theme') === 'light';
        document.body.setAttribute('data-theme', isL ? 'dark' : 'light');
        localStorage.setItem('hv2_theme', isL ? 'dark' : 'light');
    }

    initWebGL() {
        const wrap = document.getElementById('canvas-wrap');
        if (!wrap || !window.THREE) return;
        const scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(0x0a0a0d, 0.002);

        const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
        camera.position.z = 40;

        const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        wrap.appendChild(renderer.domElement);

        const geometry = new THREE.BufferGeometry();
        const vertices = [];
        const size = 200;
        for ( let i = 0; i < 800; i ++ ) {
            const x = (Math.random() - 0.5) * size;
            const y = (Math.random() - 0.5) * size;
            const z = (Math.random() - 0.5) * size;
            vertices.push(x, y, z);
        }
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));

        const material = new THREE.PointsMaterial({
            color: 0xc9a96e,
            size: 0.3,
            transparent: true,
            opacity: 0.15
        });

        const particles = new THREE.Points(geometry, material);
        scene.add(particles);

        let mx = 0, my = 0;
        window.addEventListener('mousemove', e => {
            mx = (e.clientX / window.innerWidth) * 2 - 1;
            my = -(e.clientY / window.innerHeight) * 2 + 1;
        });

        function animate() {
            requestAnimationFrame(animate);
            particles.rotation.y += 0.0002;
            particles.rotation.x += 0.0001;
            camera.position.x += (mx * 5 - camera.position.x) * 0.02;
            camera.position.y += (my * 5 - camera.position.y) * 0.02;
            camera.lookAt(scene.position);
            renderer.render(scene, camera);
        }
        animate();

        window.addEventListener('resize', () => {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        });
    }
}
