# UI iteration: Scannable weakness evidence

## Learner problem

The weakness dashboard presented every record in one technical-key list. Severity, impact, recurrence, evidence count, review timing, and model confidence were compressed into two text lines, while the selected weakness history appeared as unlabelled event rows. The learner had to decode identifiers and reconstruct the evidence sequence manually.

## Source baseline

The project is entirely untracked, so no Git commit can serve as the baseline. These SHA-256 hashes were recorded immediately before this iteration:

| File | Baseline SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `337FE9C1D974A70109C19172DE98960999298967345B78451CA2CF8DD98628F1` |
| `apps/web/src/styles.css` | `A96EC02E08D5893F0E1EAB1AA9D99B6C70E43C104E6D6A85AE79EA3F162548A4` |
| `apps/web/src/App.test.tsx` | `532959C755E0B94CC83B61AA35CEBFD28DA3757B432FC4148B591CADA384542C` |

No populated weakness-dashboard screenshot existed before implementation. The active-state comparison is therefore source-based rather than presented as a controlled before/after image pair.

## Hypothesis

If weakness records are grouped by learning state, led by plain-language names, and paired with a chronological evidence sequence, the learner will identify what needs attention and why without treating model confidence as proficiency.

## Implemented experiment

- Grouped weaknesses into Due now, Active practice, Provisionally improved, and Paused.
- Made paused state override due state so a manual pause remains authoritative in the interface.
- Added plain-language labels for supported conditional references while retaining technical keys.
- Added a readable fallback label for unrecognized technical keys.
- Standardized card summaries for severity, communicative impact, recurrence, evidence count, and next review.
- Moved AI confidence to the least prominent card line.
- Added an unmistakable Selected indicator in addition to `aria-pressed` and the selected border.
- Replaced compressed history rows with a numbered evidence sequence.
- Made purpose, timestamp, observed behavior, disposition, validation explanation, and validation source readable at a glance.
- Kept expected behavior, support level, validator status, references, and AI confidence in collapsed technical detail.
- Added no chart, score, new metric, dependency, persistence behavior, or domain-state change.

## Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Due, active, improved, and paused records are distinct | Pass | Focused assertions and populated renders show one record in each group without duplication |
| Plain-language names lead while technical keys remain available | Pass | Desktop, tablet, and phone captures lead with readable names and retain the smaller technical key |
| Severity, impact, recurrence, and evidence scan consistently | Pass | Four-cell summaries remain aligned at 1440 px and 760 px and become a readable two-column grid at 390 px |
| Selected weakness is unmistakable | Pass | Selected label, border, and `aria-pressed` assertion all passed |
| Evidence reads as a chronological sequence | Pass | Numbered purpose-labelled events remain legible through the 390 px capture |
| Validation source outranks model confidence | Pass | Validation-source badges remain visible while AI confidence stays in collapsed technical evidence |
| Existing weakness controls and learning behavior remain intact | Pass | Focused suite 6/6; full deterministic suite 82 passed with 2 optional skips; typecheck and build passed |
| Minimum-window and phone layouts remain coherent | Pass | Controlled inspection completed at 760x600 and 390x844 in addition to 1440x900 |

## Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/App.test.tsx`
- `docs/ui-backlog.md`
- `docs/ui-iterations/2026-08-25-daily-session-workspace/README.md`
- This iteration record and its controlled screenshots

## Verification

- Pre-change source matched the audited UI-003 final hashes above; UI-003's focused suite was 6/6.
- The first focused candidate run exposed a grouping predicate that placed every weakness in every group.
- The grouping predicate was corrected and the focused suite passed 6/6.
- Full deterministic suite: 82 passed; 2 optional tests skipped.
- Typecheck: passed.
- Production web and Electron build: passed.
- Rendered inspection: passed at 1440x900, 760x600, and 390x844. Grouping, selection, metric hierarchy, evidence order, validation-source prominence, and collapsed technical detail were checked directly.

## Visual evidence

- [Grouped dashboard at 1440x900](after-groups-1440x900.png)
- [Selected weakness at 1440x900](after-selected-1440x900.png)
- [Evidence sequence at 1440x900](after-evidence-1440x900.png)
- [Grouped dashboard at 760x600](after-groups-760x600.png)
- [Selected weakness at 760x600](after-selected-760x600.png)
- [Grouped dashboard at 390x844](after-groups-390x844.png)
- [Evidence sequence at 390x844](after-evidence-390x844.png)

All captures used a temporary in-memory synthetic desktop bridge that was removed after capture. No learner record, production database, network request, or live AI call was used.

## Immediate decision

**Accept for real-use trial.** Automated checks and populated responsive renders passed. The trial follow-up below remains the decision gate for retention.

## Known gaps and deferred follow-ups

- No controlled populated-dashboard before screenshot exists.
- Plain-language labels are curated for the supported conditional reference IDs; other keys use a readable fallback until domain-specific language earns a curated label.
- A physical keyboard-only pass and Windows scaling at 125% and 150% remain manual trial checks.
- Charts, new evidence calculations, confidence scoring, and dashboard filters remain deliberately out of scope.

## Exact revert procedure

Because the source is untracked, no safe Git restore command exists. Revert only this bounded iteration:

1. In `apps/web/src/App.tsx`, remove the weakness/evidence label maps, grouping helpers, grouped weakness sections, compact metric grid, selected indicator, plain-language detail header, and evidence sequence; restore the prior single weakness list and compact evidence rows.
2. In `apps/web/src/styles.css`, remove only the Iteration 4 weakness-group, card-summary, detail-heading, and evidence-timeline rules; restore the prior weakness layout/card/detail rules and the previous 600 px layout breakpoint.
3. In `apps/web/src/App.test.tsx`, remove the Iteration 4 group fixtures and grouping/timeline assertions; restore the prior single-summary assertions.
4. Rerun `npm.cmd test`, `npm.cmd run typecheck`, and `npm.cmd run build`.
5. Verify the restored files match the source-baseline hashes above.

Do not remove the backlog or this decision record when reverting; update UI-004 to `reverted` and record why.

## Trial follow-up

- **Sessions observed:** 1 representative 15-minute session
- **Group scanning:** Owner described the overall visual trial as positive; this subtask was not measured separately
- **Plain-language labels:** Owner described the overall visual trial as positive; this subtask was not measured separately
- **Selected weakness clarity:** No negative observation reported
- **Evidence sequence clarity:** No negative observation reported
- **Confidence interpretation:** No negative observation reported
- **New friction:** Later session answers advanced without displaying the explanation already returned by the local model; tracked separately as UI-005
- **Decision:** `retained` by explicit positive owner feedback on 2026-08-25
