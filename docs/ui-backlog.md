# UI Improvement Backlog

This is the single backlog for evidenced Spanish C1 interface improvements. Only one item may have status `selected` or `trial` at a time.

## UI-001 — Focus the default view on daily practice

- **Status:** `retained`
- **Observation:** Diagnostics, weakness history, settings, assessments, the daily session, and open practice appeared together in one long page.
- **Learner consequence:** The recommended daily action competed with operational and historical information, increasing scanning before practice.
- **Evidence:** Pre-iteration source structure in `apps/web/src/App.tsx`; controlled candidate renders and automated checks in [the iteration record](ui-iterations/2026-08-24-focused-navigation/README.md).
- **Frequency:** Structurally present on every launch before this iteration.
- **Severity:** Inconvenient; not task-blocking.
- **Smallest experiment:** Separate Today, Progress, and Settings while preserving every existing workflow and making the 15-minute session dominant on Today.
- **Decision record:** [2026-08-24 focused navigation](ui-iterations/2026-08-24-focused-navigation/README.md)

## UI-002 — Establish a semantic visual system

- **Status:** `retained`
- **Observation:** Repeated colors, radii, shadows, and action styles were encoded as individual CSS values or structural selectors.
- **Learner consequence:** Equivalent actions and states could drift visually as the interface grows, making priority and state harder to recognize.
- **Evidence:** Pre-iteration source structure in `apps/web/src/styles.css` and `apps/web/src/App.tsx`; focused component assertions and controlled renders in [the iteration record](ui-iterations/2026-08-24-semantic-visual-system/README.md).
- **Frequency:** Structurally present throughout every view before this iteration.
- **Severity:** Preventive consistency issue; not task-blocking.
- **Smallest experiment:** Preserve the established appearance while centralizing repeated visual values and applying explicit primary, secondary, quiet, selected, paused, loading, warning, and error treatments.
- **Decision record:** [2026-08-24 semantic visual system](ui-iterations/2026-08-24-semantic-visual-system/README.md)

## UI-003 — Focus the daily-session workspace

- **Status:** `retained`
- **Observation:** An active session showed phase text, rationale, difficulty, prompt, response, AI proposal, and learner controls in one undifferentiated vertical sequence.
- **Learner consequence:** The learner had to re-establish the current phase and distinguish their own work from the AI proposal during every transition.
- **Evidence:** Pre-iteration source structure in `apps/web/src/App.tsx` and `apps/web/src/styles.css`; focused workflow assertions and controlled candidate renders in [the iteration record](ui-iterations/2026-08-25-daily-session-workspace/README.md).
- **Frequency:** Present throughout every active 15-minute session.
- **Severity:** Inconvenient and potentially confusing during correction review; not task-blocking.
- **Smallest experiment:** Add a simple five-stage path and a stable task surface that visibly separates the current prompt, latest learner response, AI proposal, and learner decision without changing session behavior.
- **Decision record:** [2026-08-25 daily-session workspace](ui-iterations/2026-08-25-daily-session-workspace/README.md)

## UI-004 — Make weakness evidence scannable

- **Status:** `retained`
- **Observation:** Weaknesses appeared in one technical-key list, and evidence events were compressed into unlabelled text rows.
- **Learner consequence:** The learner had to decode internal identifiers and could not quickly distinguish due, active, improved, or paused work—or understand how evidence progressed from detection to verification.
- **Evidence:** Pre-iteration source structure in `apps/web/src/App.tsx` and `apps/web/src/styles.css`; focused grouping/evidence assertions and controlled candidate renders in [the iteration record](ui-iterations/2026-08-25-weakness-evidence/README.md).
- **Frequency:** Present whenever at least one weakness is tracked.
- **Severity:** Inconvenient and potentially trust-reducing when reviewing evidence; not task-blocking.
- **Smallest experiment:** Group weakness cards by learning state, add plain-language names and consistent evidence metrics, and turn the selected weakness history into a chronological evidence sequence.
- **Decision record:** [2026-08-25 weakness evidence](ui-iterations/2026-08-25-weakness-evidence/README.md)

## UI-005 — Explain each session answer

- **Status:** `retained`
- **Observation:** During the first representative session after UI-004, the learner received no visible explanation after answering the targeted-practice and transfer prompts.
- **Learner consequence:** The session advanced without showing why the answer was accepted or what remained uncertain, weakening the repair loop and trust in difficulty adjustment.
- **Evidence:** Owner trial report on 2026-08-25; red-first component assertion; source trace showing that `submitTargetedPractice` and `submitTransfer` stored proposals while `App.tsx` rendered them only during the initial repair phase.
- **Frequency:** Observed in one representative session and structurally present after both later written-response phases.
- **Severity:** Repeated learning-feedback failure; potentially trust-reducing.
- **Smallest experiment:** Render the already-returned correction proposal after targeted practice and transfer, including its explanation, Mexican-Spanish notes, and uncertainties; make no additional AI call and change no scoring or persistence behavior.
- **Decision record:** [2026-08-25 session answer feedback](ui-iterations/2026-08-25-session-answer-feedback/README.md)

## UI-006 — Make assessment reports actionable

- **Status:** `retained`
- **Observation:** Completed baseline and checkpoint reports presented raw skill keys, evidence-band identifiers, model confidence, uncertainty, prompt IDs, and trends as equally weighted text in a flat card grid.
- **Learner consequence:** The learner had to translate technical identifiers and reconstruct demonstrated strengths, priorities, changes, and assessment limits before deciding what to practice next.
- **Evidence:** Pre-iteration structure in `apps/web/src/App.tsx` and `apps/web/src/styles.css`; red-first report assertions and the [iteration record](ui-iterations/2026-08-25-assessment-report/README.md).
- **Frequency:** Structurally present in every completed baseline and checkpoint report.
- **Severity:** Repeated interpretation friction with trust implications; not task-blocking.
- **Smallest experiment:** Lead with a strengths/priorities/limits summary, group dimensions by human-readable evidence band, translate comparison movement, isolate the deferred spoken dimension, and collapse confidence, prompt IDs, and detailed uncertainty.
- **Decision record:** [2026-08-25 assessment report](ui-iterations/2026-08-25-assessment-report/README.md)

## UI-007 — Protect responsive and accessible operation

- **Status:** `trial`
- **Observation:** The supported 760 px Electron width did not trigger the compact header, interactive target sizing was not guaranteed outside the primary navigation, long learner and diagnostic content had uneven wrapping protection, and the amber-only focus outline had weak contrast on light surfaces.
- **Learner consequence:** Narrow windows, keyboard navigation, display scaling, or unusually long Spanish and diagnostic content could make actions harder to locate or cause avoidable layout friction.
- **Evidence:** Source inspection of `apps/web/src/styles.css` against Iteration 6 of the visual-improvement playbook; focused semantic assertion in `apps/web/src/App.test.tsx`.
- **Frequency:** Structural risk across every view at narrow widths or keyboard focus; no production failure was reported.
- **Severity:** Accessibility and layout resilience issue; potentially task-blocking under keyboard-only or enlarged-display use.
- **Smallest experiment:** Reflow the application header at the supported desktop minimum, guarantee 44 px interactive targets, add a skip link and stronger focus ring, protect long content, and honor reduced-motion and forced-color preferences without changing application behavior.
- **Decision record:** [2026-08-25 responsive and accessibility polish](ui-iterations/2026-08-25-responsive-accessibility/README.md)

## Next selection

Do not select another visual change until UI-007 is retained, revised, or reverted after responsive, keyboard, and scaling review.
