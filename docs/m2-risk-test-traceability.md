# M2 persistence risk-to-test traceability

Environment: local Windows development computer; synthetic SQLite files only beneath `data/.test-tmp`.

| ID | Tier | Invariant or failure prevented | Test and observable assertion | Evidence | Status |
|---|---:|---|---|---|---|
| P-01 | 1 | No configured path can escape `APP_DATA_ROOT`; an unusable root fails clearly. | `data-root.test.ts` asserts directory containment and rejects traversal, absolute paths, and a file-as-root. | `npm.cmd test -- packages/persistence` | EXECUTED |
| P-02 | 1 | Migrations are transactional/idempotent and learning state survives close/reopen. | `repository.test.ts` checks schema version and exact session state after a new repository opens the same file. | Same command | EXECUTED |
| P-03 | 1 | Evidence history cannot be rewritten or deleted. | `repository.test.ts` executes real SQLite `UPDATE` and `DELETE` attempts and requires the append-only triggers to reject them. A reversible no-op trigger fault caused the test to fail. | Targeted clean/fault/restored runs | PROVEN |
| P-04 | 1 | A stale writer cannot silently overwrite a newer weakness revision. | Two real SQLite connections read revision 1; writer A commits revision 2; writer B's stale write must throw and the final record must retain revision 2 and both events. A reversible disabled-conflict fault caused the test to fail. | Targeted clean/fault/restored runs | PROVEN |
| P-05 | 1 | Backup and export artifacts stay under the configured root and remain usable. | `portable-files.test.ts` asserts export contents/path and opens the generated SQLite backup through a new repository. | `npm.cmd test -- packages/persistence` | EXECUTED |
| P-06 | 1 | Reviews, settings, and assessment state are durably queryable. | `repository.test.ts` asserts the exact due-review record, active data-root setting, and assessment export row. | Same command | EXECUTED |
| P-07 | 1 | The actual desktop application service persists analysis history across restart rather than keeping it only in React memory. | `application-service.test.ts` analyzes through the application use case, closes the repository, reopens it, and asserts the exact session and proposal evidence. | `npm.cmd test -- apps/desktop/application-service.test.ts` | EXECUTED |
| P-08 | 1 | Evidence preserves both the model proposal and concrete validator disposition for later audit/review. | `application-service.test.ts` asserts the stored correction, category, prompt version, explanation, and `needs_review` result after reopen. | Same command | EXECUTED |
| P-09 | 1 | A failed multi-issue analysis cannot leave a completed session or partial weakness evidence. | `application-service.test.ts` forces the second evidence insert to violate a unique constraint, requires rejection, then asserts sessions, weaknesses, and evidence are all empty. | Same command | EXECUTED |
| P-10 | 1 | Active data root and saved history remain visible when Ollama is offline. | `App.tsx` renders an independent Settings surface from `getAppState`; it is outside the conditional Ollama diagnostics branch. | Type check and build | STATIC |

## Additional methods

- Test value: `PROVEN` for P-03 and P-04 through controlled local fault injection followed by exact restoration and clean reruns.
- Concurrency: deterministic two-connection stale-read/write schedule executed for P-04; no arbitrary sleeps or mocked storage.
- Mutation runner: `UNVERIFIED`. No repository-configured mutation runner is installed, so no native mutation campaign was run.
- Fuzz runner: `UNVERIFIED`. No repository-configured fuzzer or generator framework is installed.
- Property framework: `UNVERIFIED`. No repository-configured property-testing framework is installed; existing bounded loop tests are ordinary deterministic tests, not property-runner evidence.

No external system, shared database, existing user database, or live model was used by these tests.

## Fresh verifier resolution

The first fresh review found that the desktop process was not wired to persistence, evidence omitted proposal/result details, three difficulty dimensions were missing, and the validation note contradicted itself. Each finding was corrected before M3. A targeted recheck then found that Settings depended on Ollama diagnostics and multi-issue persistence was not atomic. Settings is now independent, and `saveAnalysis` commits or rolls back the session and every weakness in one transaction with a focused forced-failure test.
