export class HeroHeader {
    constructor() {
        this.dayTitle = document.getElementById('day-title');
    }

    renderDay(day) {
        if (this.dayTitle) {
            this.dayTitle.textContent = 'Workout';
            this.dayTitle.setAttribute('aria-label', day.title ? `Workout: ${day.title}` : 'Workout');
        }
    }
}
