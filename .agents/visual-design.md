# Visual design

This is the dashboard visual brief. [PRODUCT_SPEC.md](../PRODUCT_SPEC.md), sections 12–15, governs behavior. Record evidence in [REVIEW_VERIFICATION.md](../REVIEW_VERIFICATION.md).

## Direction

Invisible Luxury means calm, legible training tools with restrained color and clear hierarchy. Use spacing, alignment and type before adding surfaces. Do not hide required information to make a screenshot cleaner. Inspiration: Linear for alignment, Raycast for icon discipline, Copilot for numeric hierarchy; do not copy branding.

## Type and color

- Inter throughout, including headings. Earlier decorative serif guidance is superseded.
- Page/overlay titles: 28px, weight 550, line-height 1.2, restrained negative tracking. Exercise names: 17px. Meaningful labels/helpers: at least 12px. Inputs: at least 16px.
- Sentence-case labels, modest tracking, tabular training figures and explicit units/provenance.
- Preserve charcoal/warm white and warm off-white themes. Base colors: #17191c / #f1f0eb; muted gold: #c9b179 / #8e723d. Use semantic CSS tokens. Secondary text must remain readable; color alone must not convey state.

## Layout and controls

- Workout cards: 18px radius, desktop content 696px inside a 744px padded container. Calendar retains its 832px container.
- Exercise number actions: at least 44px square. Tighten adjacent spacing first. No visible Actions label below the number.
- Saved sets: horizontal rows with a reachable Edit control. Prioritize logging inputs; group helper copy below. Preserve combined dumbbell-pair units and previous-session provenance.
- Alternatives use a stroked swap symbol, not progress-like dots. Overlay close icons share 20px stroked geometry.
- Calendar averages remain visible and explicitly use saved history. Planning context sits beside averages from 720px, below on phones. Preserve cadence, recovery and conflict context.
- Preserve common past/future date-row geometry. Highlight the date button, avoiding a second broad tinted box around activity surfaces.
- Keep Workout/Calendar as two floating destinations and Coach separate. Selected navigation uses a fill. Restrain shadows/blur and retain bottom scroll clearance.
- Glass is optional, localized material. Respect reduced transparency, contrast and motion preferences.

## Review

Inspect dark/light themes, 360–390px phone widths and desktop; long names, empty/filled logs, Calendar, Preferences, Plan settings, History and Coach. Verify focus visibility, dismissal and targets. Use isolated local origins for synthetic records. Browser emulation is not real-device verification. Record actual checks and limitations in the existing verification record.
