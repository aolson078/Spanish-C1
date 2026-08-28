# UI iteration: Explain each session answer

## Learner problem

During a representative 15-minute session, the learner reported that the interface advanced after an answer without explaining the result. Source inspection confirmed that targeted-practice and transfer submissions both stored a correction proposal, but the renderer showed proposals only during the initial repair phase.

## Source baseline

The project is entirely untracked, so no Git commit can serve as the baseline. These SHA-256 hashes were recorded before this iteration:

| File | Baseline SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `9FC276DB80DC5DC7983120B54BEEA0865F30E0B971C4D7AD7A0646164563AF7B` |
| `apps/web/src/styles.css` | `0B8F24B288F78B6991E4D18BD232A848BDDEAF5FC8C80771C64B85D3BAD22865` |
| `apps/web/src/App.test.tsx` | `A23B49A435AAEBEE6844457C0DFA61B400B4CE2EB8A56089062DCABC2116C0A7` |

No controlled pre-change screenshot exists for the missing state because the absence of feedback was discovered during real use. The baseline is the owner observation, red-first test, and source trace rather than a claimed visual before/after pair.

## Hypothesis

If the interface displays the correction proposal already returned after each later session answer, the learner can understand what changed and what remains uncertain before continuing because feedback is no longer discarded at the phase transition.

## Implemented experiment

- Display the stored proposal after targeted practice and after changed-context transfer.
- Label it as feedback on the previous response while preserving the AI-proposal warning.
- Rename the explanation section to `Why`.
- Show Mexican-Spanish notes and model uncertainties when present.
- Explain explicitly when the model proposes no specific issue.
- Make no additional model request and change no domain, difficulty, persistence, or assessment behavior.

## Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Targeted-practice feedback appears before the transfer prompt | Pass | Focused assertion verifies the feedback heading and explanation after transition to transfer |
| Transfer feedback appears before session completion | Pass | Focused assertion verifies no-issue feedback and uncertainty after transition to summary |
| A specific issue includes its explanation | Pass | Focused assertion verifies the returned issue explanation |
| No-issue feedback still explains uncertainty | Pass | Focused assertion verifies explicit no-issue copy and the returned uncertainty |
| AI judgment remains visibly unverified | Pass | Focused assertion verifies the existing AI-proposal warning in the newly exposed state |
| Mexican-Spanish notes remain visible when returned | Pass | Focused assertion verifies the returned note |
| No model, scoring, difficulty, or persistence behavior changes | Pass | Production change is confined to rendering fields already present on `activeSession.proposal` |
| Desktop and phone layouts remain coherent | Unverified | CSS and the proposal component are unchanged, but the local Electron capture path could not produce a valid frame; inspect transfer and summary at 1440x900 and 390x844 |

## Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/App.test.tsx`
- `docs/ui-backlog.md`
- `docs/ui-iterations/2026-08-25-weakness-evidence/README.md`
- This iteration record and its controlled screenshots

## Verification

- Red-first focused run: 1 of 6 tests failed because no feedback heading existed after targeted practice.
- Focused component suite after implementation: 6/6 passed.
- Full deterministic suite: 82 passed; 2 optional tests skipped.
- Typecheck: passed.
- Production build: passed.
- Final focused component suite after trust and Mexican-Spanish assertions: 6/6 passed.
- Rendered inspection: unverified. The temporary Electron harness failed first at the GPU capture boundary and then at page loading under offscreen rendering. No screenshot is presented as successful evidence.

## Visual evidence

- Candidate captures: not captured.

The attempted capture used an in-memory synthetic desktop bridge and loopback-only renderer. No learner record, production database, external network request, or live AI call was used. The temporary harness and failed output were removed.

## Immediate decision

**Retain.** The user completed a repaired real-use session and reported that the feedback now works well. Automated behavior evidence remains green. Phone-width appearance remains an explicitly recorded verification gap because the controlled capture harness did not produce a valid frame.

## Known gaps and deferred follow-ups

- This change addresses daily-session feedback only. Assessment prompts intentionally remain non-coaching during an active baseline or checkpoint.
- The quality of a local model's explanation still varies; the interface clearly labels it as an AI proposal rather than verified instruction.
- Keyboard-only traversal and Windows scaling remain real-use checks after automated and controlled-render acceptance.

## Exact revert procedure

Because the source is untracked, no safe Git restore command exists. Revert only this bounded iteration:

1. In `apps/web/src/App.tsx`, restore the prior `Proposal` heading and no-issue copy, remove Mexican-Spanish note and uncertainty sections, and remove the transfer/summary feedback rendering block.
2. In `apps/web/src/App.test.tsx`, remove the two later-phase proposal fixtures and their feedback assertions.
3. Rerun `npm.cmd test -- apps/web/src/App.test.tsx`, `npm.cmd run typecheck`, and `npm.cmd run build`.
4. Verify the restored files match the source-baseline hashes above.

Do not remove this record when reverting; change UI-005 to `reverted` and record why.

## Trial follow-up

- **Sessions observed:** 1 after the fix
- **Explanation clarity:** Positive; owner reported that it works great
- **Uncertainty clarity:** No negative observation reported
- **New friction:** None reported
- **Decision:** `retained` by explicit owner feedback on 2026-08-25
