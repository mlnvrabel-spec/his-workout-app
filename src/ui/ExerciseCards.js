export class ExerciseCards {
    constructor(cards, engine, motionCurve) {
        this.cards = cards;
        this.engine = engine;
        this.motionCurve = motionCurve;
    }

    render(day, workout, doneIds, expandedCardId, onToggleCard, onCloseCard) {
        if (this.cards) this.cards.innerHTML = '';

        workout.exercises.forEach((exercise, index) => {
            const id = `ex-${day}-${index}`;
            const isDone = doneIds.includes(id);
            const cardWrap = this.createCard(day, workout, exercise, index, id, isDone, expandedCardId === id);
            if (!this.cards) return;
            this.cards.appendChild(cardWrap);
            this.bindCardInteractions(cardWrap, onToggleCard, onCloseCard);
        });

        this.renderFinishButton(this.engine?.getCompletionSummary?.(day));
    }

    replaceCard(day, workout, exerciseSlot, doneIds, expandedCardId, onToggleCard, onCloseCard) {
        const id = `ex-${day}-${exerciseSlot}`;
        const existingCard = document.getElementById(id);
        const exercise = workout.exercises[exerciseSlot];
        if (!existingCard || !exercise) return;

        const replacement = this.createCard(
            day,
            workout,
            exercise,
            exerciseSlot,
            id,
            doneIds.includes(id),
            expandedCardId === id
        );
        this.bindCardInteractions(replacement, onToggleCard, onCloseCard);
        replacement.querySelector('.ex-name')?.classList.add('ex-name--swap');
        existingCard.replaceWith(replacement);
    }

    createCard(day, workout, exercise, index, id, isDone, isExpanded) {
        const originalExerciseId = this.engine?.rawWorkouts?.[day]?.exercises?.[index]?.id;
        const isCustom = originalExerciseId && exercise._exerciseId !== originalExerciseId;
        const intensityClass = exercise.rir === 0 || exercise.rir === '0' ? 'intense' : 'controlled';
        const setPrescription = typeof exercise.sets === 'string'
            ? exercise.sets
            : `${exercise.sets}&times;${exercise.reps || ''}`;
        const technique = exercise.technique?.map((tip, tipIndex) => `<li><div class="step-n">${tipIndex + 1}</div><div class="detail-text">${tip}</div></li>`).join('') || '';
        const mistakes = exercise.mistakes?.map(mistake => `<li><div class="mistake-x">&times;</div><div class="detail-text">${mistake}</div></li>`).join('') || '';
        const swapInfo = this.engine?.getSwapGroupInfo?.(exercise._exerciseId);
        const swapDots = swapInfo?.options.length > 1
            ? `<div class="swap-dots" data-slot="${index}" aria-label="Swipe to change exercise">${swapInfo.options.map((_, optionIndex) => `<span class="swap-dot ${optionIndex === swapInfo.currentIndex ? 'active' : ''}"></span>`).join('')}</div>`
            : '';
        const originalName = isCustom ? (this.engine?.exerciseLibrary?.[originalExerciseId]?.name || originalExerciseId) : '';
        const customTag = isCustom ? `<div class="ex-custom-tag">&#8634; ${originalName}</div>` : '';
        const cardWrap = document.createElement('div');

        cardWrap.id = id;
        cardWrap.className = `card-wrapper ${isDone ? 'done' : ''} ${isCustom ? 'custom' : ''} ${isExpanded ? 'active' : ''}`;
        cardWrap.dataset.idx = index;
        cardWrap.dataset.exname = exercise.name;
        cardWrap.innerHTML = `
            <div class="swipe-bg" style="transition: opacity 0.3s ${this.motionCurve}">
                <svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg>
            </div>
            <div class="card" data-id="${id}" style="transition: transform 0.3s ${this.motionCurve}, height 0.4s ${this.motionCurve}">
                <div class="intensity-bar ${intensityClass}"></div>
                <div class="card-head" ${swapInfo?.options.length > 1 ? 'data-swappable="true"' : ''}>
                    <div class="ex-num">${index + 1}</div>
                    <div class="ex-info">
                        <div class="ex-name">${exercise.name}</div>
                        ${customTag}
                        <div class="ex-meta">
                            <span class="pill sets">${setPrescription}</span>
                            <span class="pill rir-${exercise.rirClass}">RIR ${exercise.rir}</span>
                            <span class="pill sets rest">${exercise.rest} rest</span>
                            ${swapDots}
                        </div>
                    </div>
                    <div class="check-wrap"><div class="check-box"><svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" /></svg></div></div>
                </div>
                <div class="card-details"><div class="details-inner">
                    ${exercise.technique ? `<div class="detail-section"><span class="detail-label tech">Technique</span><ul class="detail-list">${technique}</ul></div>` : ''}
                    ${exercise.mistakes ? `<div class="detail-section"><span class="detail-label warn">Common Mistakes</span><ul class="detail-list">${mistakes}</ul></div>` : ''}
                    ${exercise.visualization ? `<div class="detail-section"><span class="detail-label viz">${exercise.visualization}</span><p class="detail-text" style="color:var(--text1)">${exercise.vizText || ''}</p></div>` : ''}
                </div></div>
            </div>`;

        return cardWrap;
    }

    bindCardInteractions(cardWrap, onToggleCard, onCloseCard) {
        const cardHead = cardWrap.querySelector('.card-head');
        cardHead.addEventListener('click', event => {
            if (event.target.closest('.check-wrap')) return;
            if (cardWrap.dataset.swipeHandled === 'true') {
                delete cardWrap.dataset.swipeHandled;
                return;
            }
            event.stopPropagation();
            onToggleCard(cardWrap);
        });
        cardWrap.addEventListener('click', event => onCloseCard(cardWrap, event));
    }

    renderFinishButton(completion) {
        if (!this.cards) return;
        const actions = document.createElement('div');
        actions.id = 'workout-actions';
        actions.className = 'workout-actions';
        if (completion?.isFinished) {
            actions.innerHTML = '<button class="finish-btn finish-btn--undo" disabled>Workout complete</button>';
        } else {
            actions.innerHTML = `<button class="finish-btn" id="finish-workout-btn">Finish workout · ${completion?.completed || 0} of ${completion?.total || 0}</button>`;
        }
        const existingActions = document.getElementById('workout-actions');
        if (existingActions) existingActions.replaceWith(actions);
        else this.cards.appendChild(actions);
    }
}
