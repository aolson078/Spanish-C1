# UI iteration: Actionable assessment report

## Learner problem

Completed baseline and checkpoint reports treated raw dimension keys, evidence bands, confidence, uncertainties, prompt IDs, and comparison identifiers as equally important text. The learner had to decode the report before identifying demonstrated strengths, next priorities, changes since baseline, and what the assessment could not claim.

## Source baseline

The project is entirely untracked, so no Git commit can serve as the baseline. These SHA-256 hashes were recorded before this iteration:

| File | Baseline SHA-256 |
| --- | --- |
| `apps/web/src/App.tsx` | `4E05875A7943D075D88CC131D4E988F65A39ADD029E23F5FE6E2F4A6D69EAF0D` |
| `apps/web/src/styles.css` | `0B8F24B288F78B6991E4D18BD232A848BDDEAF5FC8C80771C64B85D3BAD22865` |
| `apps/web/src/App.test.tsx` | `611D61ECD0D3CDE0082F987568E0E337BCE56BB2BA62BB88F241F7998503826C` |

No controlled populated-report screenshot existed before implementation. The baseline is source-based and is not presented as a controlled before/after image pair.

## Hypothesis

If a completed assessment leads with strengths, priorities, and limits and groups the same dimensions by readable evidence band, the learner can decide what the report means without interpreting internal identifiers or mistaking confidence for proficiency.

## Implemented experiment

- Added a narrative assessment summary for demonstrated strengths, next priorities, and report limits.
- Grouped dimensions into Strong evidence, Mixed evidence, Limited evidence, and Not assessed.
- Reused the authoritative domain labels for assessment skills.
- Translated baseline-to-checkpoint comparisons into evidence-band movement rather than percentages.
- Kept spoken comprehension and production visibly unassessed while audio remains deferred.
- Moved observed evidence, uncertainty, technical keys, prompt IDs, and AI confidence into collapsed details.
- Led model-proposed weaknesses with a readable label and moved their confidence and identifiers into collapsed technical evidence.
- Added no chart, grade, score, metric, AI call, domain rule, persistence change, or dependency.

## Acceptance evidence

| Criterion | Result | Evidence |
| --- | --- | --- |
| Report leads with strengths, priorities, and limits | Pass | Focused assertions verify the summary heading and representative narrative content |
| Dimensions are grouped by readable evidence bands | Pass | Focused assertions verify all four group headings with mixed synthetic evidence |
| Internal dimension and comparison identifiers do not lead | Pass | Authoritative labels and readable trend assertions pass; technical keys remain in collapsed details |
| Baseline-to-checkpoint movement is not a percentage score | Pass | Assertions verify stronger and weaker evidence-band language; no score was introduced |
| Spoken evidence is clearly separated from written evidence | Pass | Spoken label and deferred-audio boundary assertion pass |
| Confidence, prompt evidence, and detailed uncertainty remain inspectable but subordinate | Pass | Collapsed-details assertions pass |
| Assessment behavior and data contracts remain unchanged | Pass | Production change is renderer-only; full deterministic suite, typecheck, and build pass |
| Desktop and phone layouts remain coherent | Unverified | Computer-control preview stopped when user input was detected before report navigation; inspect the completed report at desktop and narrow width during the real-use trial |

## Files changed

- `apps/web/src/App.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/App.test.tsx`
- `docs/ui-backlog.md`
- This iteration record

## Verification

- Red-first focused run: 1 of 6 tests failed because the assessment summary and evidence-band groups did not exist.
- Focused component suite after implementation: 6/6 passed.
- Typecheck: passed.
- Full deterministic suite: 82 passed; 2 optional tests skipped.
- Production web and Electron build: passed.
- Rendered inspection: unverified. The computer-control skill stopped as required when user input was detected in the synthetic preview window. No populated-report screenshot is presented as successful evidence.

## Visual evidence

- Candidate captures: not captured.

The attempted preview used only synthetic assessment data. No learner response, production database, external network request, or live AI call was used, and the temporary preview files were removed.

## Immediate decision

**Retained by owner direction on 2026-08-25.** The responsive and accessibility review continues separately in UI-007.

## Known gaps and deferred follow-ups

- The narrative summarizes evidence bands already present in the profile; it does not generate a new AI summary.
- Assessment prompt behavior remains intentionally non-coaching until the active baseline or checkpoint is complete.
- Audio and spoken assessment remain deferred.
- Charts remain out of scope until a real-use observation shows they would communicate a trend better than the grouped report.

## Exact revert procedure

Because the source is untracked, no safe Git restore command exists. Revert only this bounded iteration:

1. In `apps/web/src/App.tsx`, remove the assessment label, band, trend, and narrative helpers; restore the prior flat `profile-grid` report and model-weakness row.
2. In `apps/web/src/styles.css`, remove only the assessment-summary, profile-group, evidence-band, trend, spoken-boundary, and report-detail rules; restore the prior four `profile-grid` rules.
3. In `apps/web/src/App.test.tsx`, restore the all-strong dimension fixture and prior raw trend assertions.
4. Rerun `npm.cmd test -- apps/web/src/App.test.tsx`, `npm.cmd run typecheck`, `npm.cmd test`, and `npm.cmd run build`.
5. Verify the restored files match the source-baseline hashes above.

Do not remove this record when reverting; change UI-006 to `reverted` and record why.

## Trial follow-up

- **Reports reviewed:** 0 after the change
- **Summary clarity:** Not separately reported
- **Evidence-band clarity:** Not separately reported
- **Written versus spoken boundary:** Not separately reported
- **New friction:** None reported before closure
- **Decision:** `retained` by owner direction on 2026-08-25
