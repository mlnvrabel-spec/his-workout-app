---
name: luxury-ui-review
description: Review or implement dashboard UI changes against the Invisible Luxury visual system, usability constraints, performance expectations, and motion language. Use for changes to HTML, CSS, UI modules, interaction flows, or visual QA.
---

# Luxury UI Review

1. Read `../../../AGENT_GUIDE.md`, the relevant `../../../PRODUCT_SPEC.md` sections, and only the role briefs needed for the task.
2. Preserve vanilla ES modules, engine-owned state, and existing event contracts. Do not introduce a second UI state store.
3. Prefer typography, spacing, depth, and restrained color over decorative surfaces. Keep core interactions within two taps.
4. Evaluate only applicable keyboard, touch, reduced-motion, responsiveness, and narrow-mobile behavior. Use deterministic checks and existing components where possible.
5. Prefer transform/opacity for animations; protect usability, performance and accessibility.
6. For reviews, supply concrete findings with relevant UI evidence. Distinguish verified behavior from proposed changes and device-only checks not run.
