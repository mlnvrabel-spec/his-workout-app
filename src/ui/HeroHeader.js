export class HeroHeader {
    constructor() {
        this.expandForCompletion = () => {};
        this.els = {
            dayTitle: document.getElementById('day-title'),
            daySub: document.getElementById('day-sub')
        };
    }

    renderDay(day) {
        if (this.els.dayTitle) this.els.dayTitle.innerText = day.title || 'Workout';
        if (this.els.daySub) {
            const subtitle = day.subtitle || '';
            const parts = subtitle.split(/([+&])/);
            const fragment = document.createDocumentFragment();

            parts.forEach((part, index) => {
                if (!part) return;
                const text = index > 0 && parts[index - 1] === '+' || index > 0 && parts[index - 1] === '&'
                    ? part.replace(/^\s+/, '')
                    : part;
                fragment.append(document.createTextNode(text));
                if (part === '+' || part === '&') fragment.append(document.createElement('br'));
            });

            this.els.daySub.replaceChildren(fragment);
        }
    }


    bindScrollCollapse(app) {
        const header = document.getElementById('header');
        if (!app || !header) return;
        const collapseAt = 72;
        // Header padding/hero transitions change the sticky element's height. Keep
        // scroll-driven state locked until that layout settles so one fast fling
        // cannot be interpreted as alternating up/down intent.
        const layoutSettleMs = 460;
        const collapseDistance = 24;
        const expandDistance = 36;
        let isCollapsed = header.classList.contains('scrolled');
        let frameRequested = false;
        let lastScrollTop = app.scrollTop;
        let lockedUntil = 0;
        let directionTravel = 0;
        let pullStartY = null;

        const setCollapsed = (next) => {
            if (next === isCollapsed) return;
            isCollapsed = next;
            header.classList.toggle('scrolled', isCollapsed);
            lockedUntil = performance.now() + layoutSettleMs;
        };

        this.expandForCompletion = () => {
            directionTravel = 0;
            lastScrollTop = app.scrollTop;
            setCollapsed(false);
        };

        const updateCollapse = () => {
            const scrollTop = app.scrollTop;
            const delta = scrollTop - lastScrollTop;
            lastScrollTop = scrollTop;

            if (Math.abs(delta) > 0.5) {
                directionTravel = delta > 0
                    ? Math.max(0, directionTravel) + delta
                    : Math.min(0, directionTravel) + delta;
            }

            if (performance.now() >= lockedUntil) {
                if (!isCollapsed && directionTravel >= collapseDistance && scrollTop >= collapseAt) {
                    setCollapsed(true);
                    directionTravel = 0;
                } else if (isCollapsed && directionTravel <= -expandDistance) {
                    setCollapsed(false);
                    directionTravel = 0;
                }
            } else {
                // Do not let movement during the header's own layout transition
                // become stale direction intent on the next frame.
                directionTravel = 0;
            }
            frameRequested = false;
        };

        app.addEventListener('scroll', () => {
            if (frameRequested) return;
            frameRequested = true;
            requestAnimationFrame(updateCollapse);
        }, { passive: true });

        // Shorter workouts can reach the scroll boundary while the header is
        // collapsed. A pull at that boundary does not emit a scroll event, so
        // treat the deliberate reversal gesture itself as the reveal intent.
        const revealFromGesture = (distance) => {
            if (!isCollapsed || performance.now() < lockedUntil || distance < expandDistance) return;
            setCollapsed(false);
            directionTravel = 0;
            pullStartY = null;
        };

        app.addEventListener('wheel', (event) => {
            if (event.deltaY < 0) revealFromGesture(-event.deltaY);
        }, { passive: true });

        app.addEventListener('touchstart', (event) => {
            pullStartY = event.touches[0]?.clientY ?? null;
        }, { passive: true });

        app.addEventListener('touchmove', (event) => {
            const currentY = event.touches[0]?.clientY;
            if (pullStartY === null || currentY === undefined) return;
            revealFromGesture(currentY - pullStartY);
        }, { passive: true });

        app.addEventListener('touchend', () => {
            pullStartY = null;
        }, { passive: true });

        app.addEventListener('touchcancel', () => {
            pullStartY = null;
        }, { passive: true });

        if (app.scrollTop >= collapseAt) setCollapsed(true);
    }
}
