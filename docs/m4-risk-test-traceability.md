# M4 risk-to-test traceability

## Scope

M4 adds the weakness dashboard and on-demand evidence timeline, due-review queue, append-only pause/reopen controls, visible bounded difficulty, and explainable due/high-impact/broad activity selection.

## Claim evidence

| Risk or acceptance claim | Evidence | Result |
| --- | --- | --- |
| Dashboard summaries expose state, confidence, recurrence, impact, evidence count, and pause state | Repository summary query plus React dashboard component test | PASS |
| Selecting a weakness loads its evidence and control timeline on demand | `getWeaknessDetail` application/IPC path and dashboard component test | PASS |
| Pause/reopen is revision-checked and recorded append-only | `repository.test.ts`: pause/reopen control test, including stale duplicate rejection and trigger enforcement | PASS |
| Paused weaknesses cannot be selected from the due queue | Due-review query joins active weaknesses; reversible filter inversion caused the focused test to fail and clean restoration passed | PASS |
| Due reviews outrank other work | Existing due-review selection integration test | PASS |
| High-impact work is selected with a visible reason | Application selection integration test and `nextActivityExplanation` UI | PASS |
| Broader C1 diagnostic work is protected from starvation | An unbounded aggregate drives every-third-session selection; integration tests assert the initial boundary and a 101-session history | PASS |
| Difficulty is persisted and changes one dimension at a time | Domain bounded-adjustment tests plus M4 session integration assertions and stored setting | PASS |
| IPC weakness controls accept only stable hash IDs and booleans | Shared validation and malformed-ID tests | PASS |

## Required advanced test posture

- Test value: inverting the paused-review predicate produced the expected failure; source was restored and the focused test passed.
- Concurrency: stale/duplicate pause writes are rejected by the weakness revision predicate without adding a control event.
- Transaction failure: a duplicate control ID forces insertion failure after the state update; the test proves pause state/revision and the prior control event are restored unchanged.
- Mutation testing: UNVERIFIED — no repository-configured mutation runner exists; none was installed.
- Fuzz testing: UNVERIFIED — no repository-configured fuzzer exists; malformed boundary partitions are deterministic examples only.
- Property testing: UNVERIFIED — no repository-configured property framework exists; bounded iterative difficulty tests are deterministic examples only.

## UI boundary

The React component suite directly exercises dashboard rationale, weakness selection, evidence display, pause control, and every M3 session phase. A new live Electron traversal of M4 was not performed because physical input interfered with the prior automation; packaged visual behavior remains a later acceptance check.
