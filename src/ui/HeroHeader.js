export class HeroHeader {
    constructor() {
        this.els = {
            dayTitle: document.getElementById('day-title'),
            daySub: document.getElementById('day-sub'),
            lastTitle: document.getElementById('flow-last-title'),
            currentTitle: document.getElementById('flow-current-title'),
            weekRhythm: document.getElementById('week-rhythm')
        };
    }

    renderDay(day) {
        if (this.els.dayTitle) this.els.dayTitle.innerText = day.title || 'Workout';
        if (this.els.daySub) this.els.daySub.innerText = day.subtitle || '';
    }

    renderTrainingFlow(storage, workouts, currentDay) {
        if (!workouts?.length) return;

        const current = workouts[((currentDay % workouts.length) + workouts.length) % workouts.length];
        const memory = storage?.loadMemory?.();

        if (this.els.lastTitle) this.els.lastTitle.innerText = memory?.title || 'Start';
        if (this.els.currentTitle) this.els.currentTitle.innerText = current.title || 'Workout';
        this.renderWeekRhythm(storage?.getWeeklyStats?.().days || []);
    }

    renderWeekRhythm(days) {
        if (!this.els.weekRhythm) return;
        this.els.weekRhythm.replaceChildren(...days.map(day => {
            const item = document.createElement('div');
            const label = document.createElement('span');
            const marker = document.createElement('span');
            const date = new Date(`${day.date}T00:00:00`);

            item.className = 'week-day';
            item.setAttribute('aria-label', `${new Intl.DateTimeFormat(undefined, { weekday: 'long' }).format(date)}: ${day.completed ? 'trained' : 'not trained'}`);
            label.className = 'week-day-label';
            label.textContent = new Intl.DateTimeFormat(undefined, { weekday: 'narrow' }).format(date);
            marker.className = `week-day-marker${day.completed ? ' is-complete' : ''}`;
            item.append(label, marker);
            return item;
        }));
    }

    bindScrollCollapse(app) {
        const header = document.getElementById('header');
        if (!app || !header) return;
        const collapseAt = 72;
        const expandAt = 18;
        const layoutSettleMs = 280;
        let isCollapsed = header.classList.contains('scrolled');
        let frameRequested = false;
        let lastScrollTop = app.scrollTop;
        let lockedUntil = 0;
        let touchStartY = 0;

        const setCollapsed = (next) => {
            if (next === isCollapsed) return;
            isCollapsed = next;
            header.classList.toggle('scrolled', isCollapsed);
            lockedUntil = performance.now() + layoutSettleMs;
        };

        const updateCollapse = () => {
            const scrollTop = app.scrollTop;
            const delta = scrollTop - lastScrollTop;
            lastScrollTop = scrollTop;

            if (performance.now() >= lockedUntil) {
                if (!isCollapsed && delta > 1 && scrollTop >= collapseAt) {
                    setCollapsed(true);
                } else if (isCollapsed && delta < -1 && scrollTop <= expandAt) {
                    setCollapsed(false);
                }
            }
            frameRequested = false;
        };

        app.addEventListener('scroll', () => {
            if (frameRequested) return;
            frameRequested = true;
            requestAnimationFrame(updateCollapse);
        }, { passive: true });

        app.addEventListener('wheel', (event) => {
            if (isCollapsed && event.deltaY < 0 && app.scrollTop <= expandAt && performance.now() >= lockedUntil) {
                setCollapsed(false);
            }
        }, { passive: true });

        app.addEventListener('touchstart', (event) => {
            touchStartY = event.touches[0]?.clientY ?? 0;
        }, { passive: true });

        app.addEventListener('touchend', (event) => {
            const pullDistance = (event.changedTouches[0]?.clientY ?? touchStartY) - touchStartY;
            if (isCollapsed && pullDistance > 18 && app.scrollTop <= expandAt && performance.now() >= lockedUntil) {
                setCollapsed(false);
            }
        }, { passive: true });

        if (app.scrollTop >= collapseAt) setCollapsed(true);
    }
}
