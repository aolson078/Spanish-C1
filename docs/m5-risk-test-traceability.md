# M5 risk-to-test traceability

## Scope

M5 adds resumable text baselines, explicit practical-C1 evaluation criteria, sequenced unfamiliar checkpoint prompts, behaviorally reduced checkpoint support, evidence-band comparison reports, and model-proposed initial weaknesses. Spoken assessment remains explicitly unsampled until M6.

## Claim evidence

| Risk or acceptance claim | Evidence | Result |
| --- | --- | --- |
| A baseline survives restart at the exact next prompt | `application-service.test.ts`: partial baseline reopen test with a real repository reopen | PASS |
| The rubric meaning is stable across assessments | Versioned, skill-specific criteria are stored with every prompt and sent to the dedicated evaluator; the domain test verifies unchanged criteria over 660 sequences | PASS |
| Checkpoints remain unfamiliar in practical use | Topic, audience, and constraint combinations produce 660 semantically distinct seven-skill prompt sequences; application tests prove monotonically new sequences | PASS |
| Checkpoints use less support than the baseline | Baseline prompt objects and UI contain scaffolding; checkpoint prompt objects omit it; domain, application, and component tests assert the behavioral difference | PASS |
| A completed baseline produces an evidence-linked profile and consolidated proposed weaknesses | Dedicated evaluation tests assert per-skill judgment, judgment confidence even without weaknesses, observable evidence, prompt IDs, weakness evidence, and reference IDs | PASS |
| Comparisons preserve rubric meaning without inventing a proficiency score | Runtime rubric compatibility is required; reports compare ordered evidence bands per skill and contain no `score` | PASS |
| Actual uncertain AI judgments remain visible | Provider output preserves specific `uncertainties`; profiles persist them beside a generic limitation; the component test renders the specific text | PASS |
| Unsupported spoken claims are prevented before audio exists | Spoken comprehension/production is stored and rendered as `not_sampled` with an M6 explanation | PASS |
| Concurrent assessment responses cannot overwrite newer progress | Two-repository stale-write test rejects the old revision and preserves current progress | PASS |
| Assessment IPC and AI input/output are bounded | IPC tests cover malformed IDs/text; provider tests reject malformed judgments and wrong-skill evaluations | PASS |
| Assessment UI supports starting, responding, resuming, and inspecting comparisons | React component tests exercise the baseline response and completed checkpoint report | PASS |
| Malformed durable assessment state fails before rendering | Nested progress, canonical prompt/criteria, lifecycle, evaluation, profile, comparison, support, and rubric-version checks plus focused integration tests | PASS |
| Earlier rubric payloads do not block application state | Incompatible records remain unchanged and exportable, are omitted from v2 comparison, increment a visible compatibility count, and do not block a new v2 assessment | PASS |
| Current-rubric corruption is not mislabeled as compatibility | Current-rubric integrity failures have a separate count and alert while remaining preserved and excluded from views/comparisons | PASS |

## Required advanced test posture

- Test value: reversibly removing baseline scaffolding caused the domain safeguards to fail; the source was restored and the clean domain test passed.
- Concurrency: a deterministic two-writer SQLite test proves a stale assessment response cannot overwrite the current revision.
- Fuzz testing: UNVERIFIED — no repository-configured fuzzer exists; malformed, missing, oversized, wrong-skill, and boundary examples are deterministic tests only.
- Mutation testing: UNVERIFIED — no repository-configured mutation runner exists; none was installed.
- Property testing: UNVERIFIED — no repository-configured property framework exists; 660 deterministic prompt sequences and stable criteria are checked exhaustively instead.

## UI and model boundary

The component suite verifies semantic controls, visible baseline scaffolding, and report content in jsdom. A live packaged Electron traversal of the seven-prompt baseline/checkpoint flow, live-model assessment-quality calibration, and visual/accessibility inspection remain external checks.
