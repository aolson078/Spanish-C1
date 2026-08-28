# Validation record

## M0

- Node, npm, Git, and Ollama API inventoried on 2026-08-24.
- Runtime data, generated builds, local environment files, and SQLite files are ignored by Git.
- Dependencies are exactly pinned in `package-lock.json`.

## M1 acceptance evidence

Run:

```powershell
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
npm.cmd run test:ollama:live
```

The deterministic suite must cover valid output, malformed JSON, unsupported identifiers, transport failure, cancellation, timeout, diagnostics, and no automatic retry. The live test is reported separately because model quality is not deterministic software evidence.

Verified on 2026-08-24:

- TypeScript type check passed.
- Renderer and Electron main-process builds passed.
- Seven deterministic AI-provider tests passed.
- The first two live responses violated the contract and were rejected without becoming trusted data.
- After the prompt contract explicitly constrained array item types, the local `qwen3.5:4b` live smoke test returned a schema-valid proposal.

## M2 domain evidence

Verified on 2026-08-24:

- Eleven focused tests passed for weakness confirmation, remediation, provisional performance, delayed changed-context verification, recurrence, disagreement, append-only safeguards, review scheduling, and bounded difficulty.
- Immediate supported success remains provisional.
- One model-only judgment remains suspected.
- A verified weakness becomes resurfaced when recurrence evidence is appended.

SQLite authorization was granted on 2026-08-24 for synthetic local files beneath `data/.test-tmp`. The implementation includes transactional migrations, optimistic revision checks, append-only evidence triggers, repositories, portable export, and SQLite backup. See `m2-risk-test-traceability.md` for claim-level evidence and unavailable runner evidence.

A fresh read-only verifier found four M2 completeness gaps. The desktop application is now wired to the configured repository, application-service restart persistence has focused evidence, model proposals and validator results are stored, all required difficulty dimensions are represented, and the contradictory pending note was removed.

## M3 text-session evidence

Verified on 2026-08-24:

- The persisted state machine covers warm-up, production, repair, targeted practice, changed-context transfer, summary, and completion.
- Restart recovery restores the active phase, response, and validated proposal.
- Agree, disagree, unclear, and defer decisions are retained as learner-reviewed evidence.
- Transfer schedules a review exactly 72 hours later, and the evidence/progress/review write is atomic.
- Concurrent stale phase writes are rejected.
- IPC session IDs, learner text, and decisions are format/length bounded with focused malformed-input tests.
- The React component flow exposes labeled text inputs, native buttons, and a grouped learner-decision control.
- A live Electron smoke test loaded the sandbox-compatible preload, local Ollama diagnostics, synthetic data-root path, and persisted warm-up session.
- The exact 72-hour assertion rejected a reversible scheduling fault and passed after source restoration.

The live Electron smoke was not driven through every later phase because physical user input repeatedly interrupted the automation after warm-up. The deterministic application-service and UI suites cover the remaining flow. See `m3-risk-test-traceability.md` for claim-level evidence and unavailable runner evidence.

## M4 dashboard and controlled-selection evidence

Verified on 2026-08-24:

- Dashboard summaries and on-demand detail expose state, confidence, recurrence, impact, evidence, reviews, and manual controls.
- Pause/reopen changes are revision-checked, append-only, and exclude paused weaknesses from due selection.
- Activity selection records a visible explanation: overdue review first, high-impact weakness next, and periodic broad diagnostic practice driven by an unbounded completed-session count to protect C1 range.
- The current difficulty snapshot and adjustment reason are persisted and visible; the domain changes at most one dimension per adjustment.
- Inverting the paused-review filter caused the focused safeguard test to fail; restoration passed cleanly.

See `m4-risk-test-traceability.md` for claim-level evidence and remaining advanced-runner gaps.

## M5 baseline and checkpoint evidence

Verified on 2026-08-24:

- Baselines and checkpoints persist after every response and resume at the next prompt after reopening.
- The seven text dimensions retain rubric version `practical-c1-text.v2` and explicit skill-specific criteria; spoken comprehension/production remains visibly `not_sampled` because this checkpoint is text-only.
- A sequenced topic/audience/constraint generator provides 660 semantically distinct prompt sequences. Baselines visibly provide minimal scaffolding; checkpoint prompts omit it.
- A dedicated assessment evaluator receives the task, requested skill, stable criteria, and support condition. Generic correction output is not used as rubric evidence.
- Completed profiles link every dimension and consolidated model-proposed weakness to prompt evidence, judgment confidence, reference IDs when supplied, and the model's specific uncertainties.
- Checkpoint reports compare per-dimension evidence bands only when rubric versions match and contain no single-number C1 score.
- Assessment revisions reject stale responses without overwriting newer progress.
- React tests cover starting a baseline, submitting a response, and inspecting a completed checkpoint report.
- Nested durable payload validation rejects malformed or incompatible assessment state before rendering.
- Earlier rubric payloads remain preserved for export, are visibly counted as incompatible, and do not block a new v2 assessment; no destructive migration is performed.
- Current-rubric integrity failures are counted and alerted separately from incompatible rubric records.

See `m5-risk-test-traceability.md` for claim-level evidence and remaining advanced-runner and live-UI gaps.

## M7 Windows portability and recovery evidence

Verified on 2026-08-25:

- Candidate version is 0.2.0; the original portable 0.1.0 executable is preserved under `release\m7-validation\version-a`.
- Typecheck, the full deterministic suite (134 passed, 2 opt-in live tests skipped), renderer/main builds, and portable packaging passed.
- Ten deterministic complete sessions retained exact logical state across restarts after sessions 3, 7, and 10.
- Strict format-v1 and format-v2 import, receiving-root preservation, independent safety backup, managed restore, and post-restart snapshot equality passed in fresh synthetic roots.
- Packaged 0.2.0 launched twice against an unreachable Windows-loopback endpoint and preserved its synthetic marker.
- Preserved 0.1.0 and candidate 0.2.0 opened the same synthetic data root; schema 5 and the upgrade marker survived.
- Two concurrent portable installations targeted one synthetic root; the blocked copy stayed guidance-only and the learner fingerprint remained unchanged.
- Recovery tests cover corrupt open, JSON and managed-backup recovery, unreadable-family preservation, preview expiry/replay/staleness, wrong confirmation, exact-byte binding, active/concurrent mutation exclusion, canonical root ownership, strict manifest validation, and pre/post-swap fault reconciliation.

Manual packaged Ollama session/reopen evidence remains unverified. See `m7-acceptance-checklist.md` and the claim-level status table in `m7-risk-test-traceability.md`.

## M6 desktop-audio evidence

Verified on 2026-08-25:

- The approved local benchmark selected Whisper Base int8 and the Claude high-int8 Mexican-Spanish Piper voice.
- Renderer microphone capture is bounded to two minutes, offers Windows device selection and permission guidance, and converts locally to mono PCM.
- Offline TTS and STT run through a bounded local Node worker because the native addon is not loaded into Electron.
- An end-to-end worker check synthesized 80,304 samples at 22.05 kHz and transcribed the result to 57 characters.
- Every transcript is an editable, expiring, session-bound draft. Atomic claim and replay rules prevent unconfirmed or duplicate speech evidence.
- Recording retention defaults to discard; explicit keep writes only beneath the portable data root's `recordings` folder.
- Audio unavailability degrades only spoken controls; written practice and stored learning data remain available.
- Typechecking, 30 focused tests, the source-worker runtime, the packaged-resource runtime, and portable 0.3.0 packaging passed.

Real microphone capture and speaker playback in the packaged UI still require one user-driven acceptance check. See `m6-risk-test-traceability.md`.
