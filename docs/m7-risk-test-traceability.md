# M7 risk and test traceability

Date: 2026-08-25  
Candidate: `release\Spanish C1 0.2.0.exe`  
Scope: Windows portable packaging, import, managed restore, first-run readiness, and crash-safe recovery.

Status meanings: **PASS** is fresh automated or inspected evidence; **PARTIAL** has useful but incomplete evidence; **UNVERIFIED** requires the named external/manual check.

| ID | Status | Evidence |
|---|---|---|
| M7-AC1 | UNVERIFIED | The packaged candidate and offline launch are proven, but Alex must complete one packaged 15-minute session against local Ollama, reopen it, and confirm the saved history. Use `docs/m7-acceptance-checklist.md`. |
| M7-AC2 | PARTIAL | `verify-m7-soak.mjs` completed 10 sessions with repository restarts after 3, 7, and 10. `verify-m7-upgrade.mjs` launched preserved 0.1.0 then 0.2.0 against one synthetic root and retained the marker at schema 5. Manual learner-history confirmation remains bundled with M7-AC1. |
| M7-AC3 | PASS | `verify-m7-transfer.mjs` completed v1/v2 imports and managed restores. The coordinator requires backup integrity/application openability and logical fingerprint equality before closing the live repository. |
| M7-AC4 | PASS | `verify-m7-packaged-restart.mjs` launched twice with `http://127.0.0.1:1` and preserved its marker. Source/config inspection finds no phone runtime path in M7. |
| M7-D01 | PASS | Portable-transfer tests cover v1/v2 equality, exact 0.2.0 application version, strict tables/columns/rows and nested payloads, malformed input, canonical row dates, duplicate ID, broken FK, stable fingerprint, size boundary, exact preview-byte binding, and active-root preservation. Coordinator tests cover stale, expired, replayed, and wrong-confirmation tokens. |
| M7-D02 | PASS | Readiness and React tests cover usable, degraded, missing-model, offline, invalid-configuration, unacknowledged/Finish setup, Recheck, blocked read-only guidance, and recovery-only UI. Recovery and ownership IPC expose blocked readiness without constructing normal `ApplicationService`. |
| M7-D03 | PASS | `recovery-mode.test.ts` proves corrupt database open failure, unreadable-family preservation, validated JSON replacement, managed schema-v5 backup restore, reconciliation, and successful normal reopen under allowlisted synthetic roots. |
| REC-01 | PASS | `portable-transfer.test.ts` and `recovery-coordinator.test.ts`; all malformed and token/confirmation cases fail before live replacement. Oversize is checked by exact byte count without allocating a 256 MiB fixture. |
| REC-02 | PASS | Import and restore both checkpoint WAL, calculate live logical fingerprint, use SQLite online backup, reopen it, run `quick_check`, open the application snapshot, and assert fingerprint equality before manifest/swap. |
| REC-03 | PASS | Tests cover active async mutation rejection, concurrent same-token commit serialization/single use, same-process and independent-process pipe exclusion. `verify-m7-shared-root.mjs` runs two portable installations concurrently and proves the guidance-only copy leaves the learner fingerprint unchanged. Electron also retains an installation-scoped single-instance lock. |
| REC-04 | PARTIAL | Fault injection covers candidate validation, safety-backup verification, manifest creation, live database move, candidate rename, swapped-state manifest, rollback, candidate completion, unexpected-live safety restoration, and corrupt-manifest fail-closed behavior. WAL/SHM move, rollback-incomplete, and swapped-candidate-invalid fixtures remain without native execution. |
| REC-05 | PASS | Test-root helper and every M7 script restrict learner-data mutations to generated `release\smoke-data-*` roots, and packaged harnesses refuse existing roots. The shared-root harness also copies the candidate into a generated `release\m7-validation\installation-b-*` package-test folder; it never accepts the normal learner data path. |

## Tier 0 workflow evidence

| Workflow | Status | Evidence or exact gap |
|---|---|---|
| Test value | PASS | Recovery fault hooks cause focused tests to fail at load-bearing pre-close/post-close boundaries; exact restored fingerprints/markers are asserted after reconciliation. |
| Concurrency | PASS | Active mutation, concurrent commit, one-use token, and named-pipe ownership tests execute deterministically. |
| Traceability | PASS | This table maps each M7 claim to fresh commands/tests and keeps manual acceptance explicit. |
| Mutation runner | UNVERIFIED | No repository-configured mutation runner exists. Do not install one without approval. Exact prerequisite: add an owner-approved TypeScript mutation runner/config and run a bounded campaign over `portable-transfer.ts`, `recovery-coordinator.ts`, and `ipc.ts`. |
| Fuzz runner | UNVERIFIED | No repository-configured fuzzer exists. Deterministic malformed/boundary partitions pass. Exact prerequisite: add an owner-approved bounded parser harness for `parseTransferBytes`. |
| Property runner | UNVERIFIED | No repository-configured property framework exists. Stable-fingerprint and v1/v2 round-trip examples pass. Exact prerequisite: add an owner-approved generator for strict row snapshots and fingerprint/import invariants. |

## Fresh command evidence

```text
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run dist:win
npm.cmd run test:m7:soak
npm.cmd run test:m7:transfer
npm.cmd run test:m7:packaged
npm.cmd run test:m7:upgrade
npm.cmd run test:m7:shared-root
```

Fresh result: typecheck passed; 134 tests passed and 2 opt-in live tests were skipped; renderer/main builds passed; portable 0.2.0 was produced; soak, transfer, packaged offline restart, synthetic upgrade, and concurrent shared-root harnesses passed.

Generated packages, synthetic roots, operation manifests, backups, exports, and reports remain local/untracked evidence. No safety backup, rollback family, quarantine candidate, or recovery manifest is automatically deleted in M7.
