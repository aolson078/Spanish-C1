# UI iteration: Semantic visual system

## Learner problem

The focused navigation clarified where to work, but equivalent visual meanings were still encoded through repeated literal values and structural selectors. As the interface grows, that makes it easy for action priority and learning states to drift apart.

## Source baseline

The project is entirely untracked, so no Git commit can serve as the baseline. These SHA-256 hashes were recorded immediately before this iteration:

| File | Baseline SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `7804A6FD4F0AD4989F5F4747A3BA17E2133B273D48971A692EB67E4475BCA881` |
| `apps/web/src/styles.css` | `15861D3E579492D66A21E074455D1400892FB32FFE91AE97B655B7F27E5F9DF0` |
| `apps/web/src/App.test.tsx` | `E73298CE165B25EA2F8BBEE559F7706916DABAE817EC81958606E64017A89B99` |

## Hypothesis

If repeated visual meanings are expressed through semantic tokens and explicit component variants, the existing interface will remain familiar while action priority, selection, paused state, loading, warnings, and errors become easier to distinguish and safer to extend.

## Implemented experiment

- Centralized the established canvas, surface, primary, accent, border, text, warning, and danger palette as CSS custom properties.
- Centralized repeated card radii, pill radii, and shadow treatments.
- Replaced structural action styling with explicit primary, secondary, and quiet button variants.
- Kept the default action style primary; made Open Practice, checkpoint alternatives, pause/reopen, and correction-review alternatives match their intent.
- Added an explicit pressed state for the selected weakness and a muted state for paused weaknesses.
- Standardized local-AI loading and inline-error presentation while preserving accessible status and alert announcements.
- Preserved the current typography, palette, navigation, domain behavior, persistence, AI contracts, and desktop shell.

There is no destructive learner action in the current interface, so this iteration does not add or apply a speculative destructive button variant.

## Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Existing appearance remains recognizable | Pass | Previous-iteration and current controlled captures linked below |
| Repeated palette values have semantic names | Pass | `:root` custom properties and token references in `apps/web/src/styles.css` |
| Primary, secondary, and quiet actions are explicit | Pass | Component class assignments and focused UI assertions |
| Selected and paused weakness states are visually distinct | Pass | `aria-pressed`, `.is-paused`, and focused UI assertions |
| Loading and local-AI failure states remain understandable | Pass | Status/alert roles and focused Settings failure test |
| Existing workflows remain intact | Pass | 82 deterministic tests passed; 2 optional tests skipped; typecheck and build passed |
| Narrow layouts remain coherent | Pass | 760 × 600 and 390 × 844 controlled captures inspected |

## Files changed

- `apps/web/src/styles.css`
- `apps/web/src/App.tsx`
- `apps/web/src/App.test.tsx`
- `docs/ui-backlog.md`
- `docs/ui-iterations/2026-08-24-focused-navigation/README.md`
- This iteration record and its controlled screenshots

## Verification

- Baseline focused suite before editing: 6/6 passed.
- Focused suite after component and CSS changes: 6/6 passed.
- Full deterministic suite: 82 passed; 2 optional tests skipped.
- Typecheck: passed.
- Production web and Electron build: passed.
- Rendered inspection: Today, Progress, Settings, 760 × 600, and 390 × 844 inspected using an empty synthetic data root.
- Packaging was unchanged, so `npm.cmd run dist:win` was not required.

## Visual evidence

The immediately preceding focused-navigation captures are the controlled visual baseline:

- [Before: Today at 1440 × 900](../2026-08-24-focused-navigation/after-today-1440x900.png)
- [Before: Progress at 1440 × 900](../2026-08-24-focused-navigation/after-progress-1440x900.png)
- [Before: Settings at 1440 × 900](../2026-08-24-focused-navigation/after-settings-1440x900.png)
- [Before: Today at 760 × 600](../2026-08-24-focused-navigation/after-today-760x600.png)
- [Before: Today at 390 × 844](../2026-08-24-focused-navigation/after-today-390x844.png)

The Iteration 2 candidate captures are:

- [After: Today at 1440 × 900](after-today-1440x900.png)
- [After: Progress at 1440 × 900](after-progress-1440x900.png)
- [After: Settings at 1440 × 900](after-settings-1440x900.png)
- [After: Today at 760 × 600](after-today-760x600.png)
- [After: Today at 390 × 844](after-today-390x844.png)

All current captures used an empty synthetic data root. No learner response or production learning record appears in them. The unavailable Ollama state in Settings is intentional capture evidence, not a claim about the user's normal runtime.

## Immediate decision

**Retain and advance.** After launching the candidate for use, the owner explicitly directed the next visual step. That direction retains the semantic visual system and waives the longer three-session gate; it does not imply that the pending manual checks below were completed.

## Known gaps and deferred follow-ups

- Selected and paused weakness states are covered by component evidence but were not available in the empty-data screenshots.
- A physical keyboard-only pass and Windows scaling at 125% and 150% remain manual trial checks.
- No broader palette change, typography replacement, animation system, destructive action, or design-system dependency was introduced.
- Further component extraction remains out of scope until repeated visual drift demonstrates a need.

## Exact revert procedure

Because the source is untracked, no safe Git restore command exists. Revert only this bounded iteration:

1. In `apps/web/src/styles.css`, replace semantic `var(...)` references with the values from the source baseline, remove the Iteration 2 custom properties, restore the original default/secondary button selectors, and remove selected, paused, loading, inline-error, and quiet-button rules.
2. In `apps/web/src/App.tsx`, remove the weakness `aria-pressed` and paused class, restore the original diagnostic paragraph, remove explicit button-variant classes, and restore Open Practice's `secondary-action` class.
3. In `apps/web/src/App.test.tsx`, remove only the Iteration 2 class and `aria-pressed` assertions.
4. Rerun `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.
5. Verify the restored file hashes match the source-baseline table above.

Do not remove the backlog or this decision record when reverting; update UI-002 to `reverted` and record why.

## Trial follow-up

- **Sessions observed:** Candidate launched for use; no three-session count was recorded
- **Action hierarchy clear:** Pending
- **Selected and paused states clear:** Pending
- **Loading and failure language clear:** Pending
- **Physical keyboard-only traversal:** Pending
- **Windows scaling at 125% and 150%:** Pending
- **Decision:** `retained` by explicit owner direction on 2026-08-25
