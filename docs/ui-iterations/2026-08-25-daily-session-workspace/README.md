# UI iteration: Focused daily-session workspace

## Learner problem

An active 15-minute session presented phase guidance, selection rationale, difficulty controls, the prompt, learner response, AI proposal, and review controls as one vertical sequence. The learner had to repeatedly identify the current phase and distinguish their own language from model-generated guidance.

## Source baseline

The project is entirely untracked, so no Git commit can serve as the baseline. These SHA-256 hashes were recorded immediately before this iteration:

| File | Baseline SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `169ED70812760C52DAD92CAC195744306FA935FD59208B751E69E812BBE84E7F` |
| `apps/web/src/styles.css` | `402C06F1C4805EE435CF913D504C407CBA3440BA119E6CA8F18762A270080410` |
| `apps/web/src/App.test.tsx` | `38A80F967BE7CF2B2AEE357B279545AEC21877971004165197D7490E0F53CBCB` |

The immediately preceding iteration's controlled no-session renders remain the visual baseline for the unchanged entry state. An active-session before screenshot was not captured, so the active-state comparison is source-based rather than presented as a controlled before/after image pair.

## Hypothesis

If the session uses a stable current-task surface with a simple phase path and visibly separate learner, AI, and decision layers, the learner will reorient faster during transitions and review corrections with less ambiguity.

## Implemented experiment

- Added a five-stage path: Warm up, Produce, Repair, Transfer, and Wrap up.
- Mapped targeted practice into Repair instead of implying an extra timed stage.
- Kept phase timing estimates in the existing guidance badge, not in the progress path.
- Added a stable current-task surface that keeps the current prompt and response work together.
- Kept difficulty controls collapsed and inspectable.
- Showed the latest saved learner response during repair, transfer, and wrap-up context.
- Visually separated learner text, the AI correction proposal, and the learner-review decision.
- Added explicit language that the proposal lacks independent verification and that the learner decision is recorded separately.
- Preserved the existing session state machine, persistence, AI contract, adaptive difficulty, navigation, and data root.
- Added no timer, streak, score, animation framework, dependency, or audio behavior.

## Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Current stage is understandable without false elapsed-time precision | Pass | Five-stage path in warm-up, production, and repair captures; focused phase assertions |
| Prompt and response remain in one stable workspace | Pass | Current-task component, repair capture, and focused learner/AI text assertion |
| Difficulty controls remain collapsed but available | Pass | Native closed `details` assertion |
| Learner text and AI proposal are visually distinct | Pass | Separate learner-response and proposal surfaces in desktop and phone repair captures |
| Learner review is the obvious next action during repair | Pass | Bordered decision panel with primary/secondary/quiet actions at desktop and phone sizes |
| Existing session transitions and navigation remain intact | Pass | 82 deterministic tests passed; 2 optional tests skipped; typecheck and build passed |
| Desktop and phone layouts remain coherent | Pass | 1440 × 900, 760 × 600, and 390 × 844 controlled captures inspected |

## Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/App.test.tsx`
- `docs/ui-backlog.md`
- `docs/ui-iterations/2026-08-24-semantic-visual-system/README.md`
- This iteration record and its controlled screenshots

## Verification

- Pre-change source matched the audited UI-002 final hashes above; UI-002's focused suite was 6/6.
- Focused suite after the workspace changes: 6/6 passed.
- Full deterministic suite: 82 passed; 2 optional tests skipped.
- Typecheck: passed.
- Production web and Electron build: passed.
- Rendered inspection: warm-up, production, repair, and learner-review states inspected at applicable desktop, minimum-window, and phone widths.
- Packaging was unchanged, so `npm.cmd run dist:win` was not required.

## Visual evidence

- [Before: unchanged no-session state at 1440 × 900](../2026-08-24-semantic-visual-system/after-today-1440x900.png)
- [After: warm-up at 1440 × 900](after-warmup-1440x900.png)
- [After: production at 1440 × 900](after-production-1440x900.png)
- [After: production at 760 × 600](after-production-760x600.png)
- [After: repair at 1440 × 900](after-repair-1440x900.png)
- [After: learner review at 1440 × 900](after-repair-review-1440x900.png)
- [After: repair workspace at 390 × 844](after-repair-390x844.png)
- [After: learner review at 390 × 844](after-repair-review-390x844.png)

All new captures used an in-memory synthetic desktop bridge. No learner record, production database, network request, or live AI call was used.

## Immediate decision

**Retain and advance.** After the candidate cleared its automated and controlled-render checks, the owner explicitly directed the next visual step. That direction retains the focused session workspace and waives the longer three-session gate; it does not imply that the pending manual checks below were completed.

## Known gaps and deferred follow-ups

- No controlled active-session before screenshot exists.
- Programmatic scroll restoration was not added; the stable task container minimizes layout movement without taking scroll control away from the learner.
- A physical keyboard-only pass and Windows scaling at 125% and 150% remain manual trial checks.
- Timers, streaks, scoring, animation, and broader lesson-content changes remain deliberately out of scope.

## Exact revert procedure

Because the source is untracked, no safe Git restore command exists. Revert only this bounded iteration:

1. In `apps/web/src/App.tsx`, remove `sessionStages`, `sessionStageIndex`, the session progress list, the session-context and session-task wrappers, the saved learner-response panel, and the independent-verification note; restore the prior active-session sequence from the source baseline.
2. In `apps/web/src/styles.css`, remove only the `session-path`, stage-marker, session-context, session-task, context-label, prompt-block, learner-response, nested proposal, and session-decision rules; restore the prior session-body gap and mobile rules.
3. In `apps/web/src/App.test.tsx`, remove only Iteration 3 response fixtures and progress/workspace assertions; restore the prior hidden-section selector.
4. Rerun `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.
5. Verify the restored files match the source-baseline hashes above.

Do not remove the backlog or this decision record when reverting; update UI-003 to `reverted` and record why.

## Trial follow-up

- **Sessions observed:** Candidate reviewed through controlled evidence; no three-session count was recorded
- **Phase orientation:** Pending
- **Prompt/response continuity:** Pending
- **Learner-versus-AI distinction:** Pending
- **Decision clarity:** Pending
- **New friction:** Pending
- **Decision:** `retained` by explicit owner direction on 2026-08-25
