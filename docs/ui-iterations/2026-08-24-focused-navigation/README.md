# UI iteration: Focused Today, Progress, and Settings

## Learner problem

The original long page gave diagnostics, historical evidence, assessments, daily practice, and open practice similar visual priority. The learner had to scan past secondary information to identify the recommended daily action.

## Source baseline

The project was entirely untracked, so no Git commit could serve as the baseline. These SHA-256 hashes were recorded immediately before implementation:

| File | Baseline SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `F09C4E1F4305DD4288C9D1EFD164193F3367FF29550194D8AE900D2596356C2C` |
| `apps/web/src/styles.css` | `75D63E852B677C5F8C21A33B99DF379D2ED6DA3A726F29997A24DA77431B1347` |
| `apps/web/src/App.test.tsx` | `FF73DA31E2D843487C57856BC6172811B015752226E843419AB27A2FE5B8370A` |

No controlled before screenshot was captured. The baseline comparison is therefore source-based and observational; it is not presented as a controlled before/after image study.

## Hypothesis

If the app opens on a focused Today view with the active or recommended session as the only dominant action, resuming daily practice will require less scanning while Progress and Settings remain easy to reach.

## Implemented experiment

- Added keyboard-accessible Today, Progress, and Settings navigation using native buttons and `aria-current`.
- Kept Today as the default and preserved active session state while changing views.
- Placed the 15-minute session in the strongest visual card on Today.
- Kept Open Practice on Today with a quieter secondary action.
- Placed weakness evidence and assessments under Progress.
- Placed local-AI diagnostics and learning-data information under Settings.
- Preserved the existing palette, typography family, domain behavior, persistence, AI contracts, and desktop shell.

## Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Session action visible without scrolling at 1440 × 900 | Pass | `after-today-1440x900.png` |
| Only one learning action dominates Today | Pass | Controlled Today render; Open Practice remains lower and visually secondary |
| Restored active session remains obvious | Pass | Focused component test restores a production session, navigates away, and returns to the same prompt |
| Existing functions remain reachable | Pass with manual follow-up | Native buttons/forms and accessible-role tests cover navigation and workflows; a physical keyboard-only trial remains pending |
| No-session, active, completed, and Ollama-unavailable states remain understandable | Pass | Focused UI tests cover those paths; the unavailable state is exposed in Settings as an alert |
| Narrow layouts remain coherent | Pass | `after-today-760x600.png` and `after-today-390x844.png` |
| Long local paths do not break Settings | Pass | `after-settings-1440x900.png` |

## Verification

- Baseline focused suite before editing: 4/4 passed.
- Final focused UI suite: 6/6 passed.
- Full deterministic suite: 82 passed; 2 optional tests skipped.
- Typecheck: passed.
- Production web and Electron build: passed.
- Rendered inspection: Today, Progress, Settings, 760 × 600, and 390 × 844 inspected using an empty synthetic data root.
- Packaging was unchanged, so `npm.cmd run dist:win` was not required.

## Visual evidence

- [Today at 1440 × 900](after-today-1440x900.png)
- [Progress at 1440 × 900](after-progress-1440x900.png)
- [Settings at 1440 × 900](after-settings-1440x900.png)
- [Today at Electron minimum 760 × 600](after-today-760x600.png)
- [Today at 390 × 844](after-today-390x844.png)

All captures used an empty synthetic data root. No learner response or production learning record appears in them.

## Immediate decision

**Retain and advance.** After opening the candidate for live inspection, the owner explicitly directed the next visual iteration. That direction retains the focused-navigation structure and waives the longer three-session trial gate; it does not imply that the pending manual checks below were completed.

## Exact revert procedure

Because the source is untracked, no safe Git restore command exists. Revert only this bounded iteration:

1. In `apps/web/src/App.tsx`, remove `AppView`, `viewCopy`, `activeView`, `currentView`, the primary navigation, and the active-view introduction; restore the original brand-only header; remove the six view-specific `hidden` attributes; restore the original daily-session and Open Practice class names.
2. In `apps/web/src/styles.css`, remove `[hidden]`, navigation, view-introduction, Today-summary, primary-session, and secondary-action rules; restore `main` to 980 px/44 px top padding and restore the original `h1` clamp; remove the new responsive navigation/summary rules.
3. In `apps/web/src/App.test.tsx`, remove the navigation/restoration and Settings-error tests; remove the Progress-navigation steps from the three existing Progress tests.
4. Rerun `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.
5. Verify the restored file hashes match the source-baseline table above.

Do not remove the backlog or this decision record when reverting; update UI-001 to `reverted` and record why.

## Trial follow-up

- **Sessions observed:** Live inspection completed; no three-session count was recorded
- **Original friction:** Pending
- **New friction:** Pending
- **Physical keyboard-only traversal:** Pending
- **Windows scaling at 125% and 150%:** Pending
- **Decision:** `retained` by explicit owner direction on 2026-08-24
