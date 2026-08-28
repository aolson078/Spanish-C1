# M3 risk-to-test traceability

## Scope

M3 adds a persisted, revision-checked 15-minute session state machine, desktop IPC/UI controls, learner review evidence, targeted practice, changed-context transfer, and delayed review scheduling.

## Claim evidence

| Risk or acceptance claim | Evidence | Result |
| --- | --- | --- |
| A learner can traverse warm-up, production, repair, targeted practice, transfer, summary, and completion | `application-service.test.ts`: `completes the 15-minute text loop and schedules delayed review`; `App.test.tsx`: accessible start/production/disagreement flow | PASS |
| Progress survives application restart | `application-service.test.ts`: `restores an in-progress 15-minute session after reopening the database` | PASS |
| Disagreement, unclear, and defer remain append-only learner-reviewed evidence | Parameterized `keeps the learner ... decision as evidence` cases | PASS |
| A due weakness is selected before diagnostic practice | `application-service.test.ts`: `selects a due weakness before diagnostic practice` | PASS |
| Transfer evidence and its delayed review are committed atomically | `repository.test.ts`: `rolls back evidence and progress when review scheduling fails` | PASS |
| Duplicate/stale actions cannot overwrite a later session phase | `repository.test.ts`: `rejects a stale session transition without overwriting current progress` | PASS |
| IPC rejects malformed and oversized session IDs, learner text, and decisions | `ipc-validation.test.ts`; every session-bearing handler uses the shared validator | PASS |
| The review delay is exactly 72 hours | Direct due-date assertion plus reversible fault injection: changing the hour multiplier produced the expected failing test; the source was restored and the test passed cleanly | PASS |
| The Electron shell exposes the secure preload bridge and renders the session UI | Live synthetic-data smoke: sandboxed CommonJS preload loaded; diagnostics reported local Ollama 0.17.1 / `qwen3.5:4b`; Settings showed the synthetic root; the daily session started and persisted | PASS |
| A complete live Electron session was driven through every phase | Physical user input repeatedly interrupted automated clicks after warm-up | UNVERIFIED |

## Required advanced test posture

- Test value: the 72-hour scheduling assertion killed a reversible production fault; clean source and test state were restored.
- Concurrency: optimistic revision rejection is exercised with two repository connections.
- Transaction failure: a foreign-key failure after the evidence write proves rollback of evidence, review, and progress.
- Mutation testing: UNVERIFIED — no repository-configured mutation runner exists; none was installed.
- Fuzz testing: UNVERIFIED — no repository-configured fuzzer or IPC fuzz harness exists; none was installed.
- Property testing: UNVERIFIED — no repository-configured property framework exists; none was installed.

## Clean verification

On 2026-08-24:

- `npm.cmd run typecheck` passed.
- `npm.cmd test` passed: 57 tests passed and 2 opt-in live tests were skipped.
- `npm.cmd run build` passed, including the sandbox-compatible preload copy.
