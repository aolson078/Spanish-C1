# Spanish C1 Application — Autonomous Implementation Handoff

## 1. Mission

Build a private, local-first application that helps one B2 Spanish learner reach practical C1 fluency, with primary emphasis on Mexican Spanish.

The application must do more than provide conversation practice. Its central job is to:

1. Detect specific weaknesses from the learner's actual production.
2. Control difficulty so work stays challenging but learnable.
3. Explain and resolve the learner's precise confusion.
4. Generate targeted practice that varies context instead of repeating answers.
5. Verify the skill later and in a different context.
6. Reopen weaknesses that recur rather than repeatedly teaching the same mistake as if it were new.

The Windows desktop experience is the only implementation target for now. Phone/PWA work is explicitly deferred until the desktop application is complete and validated.

## 2. Operating Instruction for the Implementation Model

Treat this document as the execution brief. Work milestone by milestone and complete all safe, non-destructive work that the local environment supports.

At the start:

1. Read this entire document.
2. Inventory the current directory, applicable `AGENTS.md` files, Git state, Node/npm versions, and available development tools.
3. Do not assume that earlier planning documents are present. This handoff is self-contained.
4. If the folder already contains source, preserve all existing and uncommitted work.
5. Create a short implementation plan tied to the milestones and acceptance criteria below.
6. Prefer the smallest architecture that preserves portability, offline use, testability, and the future phone option.
7. After the one-time dependency decision is approved, continue through safe milestones without repeatedly asking for routine implementation permission.
8. Run focused verification after each milestone and a consolidated verification pass before handoff to the user.
9. Never claim a runtime behavior is complete unless it was exercised locally.

When blocked, report:

- the exact blocker;
- what was verified;
- what remains unverified;
- the smallest user action needed;
- the exact command or UI action the user should perform.

Do not respond with a generic roadmap when implementation can safely continue.

## 3. Authority and Stop Gates

### Work that may proceed automatically

After required dependencies are approved, the implementation model may perform normal, reviewable project work inside the application folder:

- create and edit source, tests, local documentation, and configuration templates;
- initialize a new Git repository if the directory is not already inside one;
- run local builds, tests, linters, type checks, and development servers;
- call the verified loopback Ollama API;
- create synthetic test data inside the application's development data directory;
- package an unsigned local Windows development build;
- diagnose failures using read-only commands;
- make bounded, reversible source changes and retest them.

### Stop and ask Alex before

- installing or upgrading dependencies, SDKs, runtimes, or system software;
- downloading or deleting AI models;
- deleting or overwriting user data, containers, volumes, repositories, or backups;
- changing Windows services, startup behavior, registry, firewall, certificates, or network bindings;
- exposing any application or Ollama port beyond Windows loopback;
- changing the separate AI-host computer or its Docker/Open WebUI deployment;
- moving Ollama model storage;
- running a destructive database migration or resetting the application database;
- publishing, deploying, signing, or sending anything externally;
- adding a paid service, hosted AI service, telemetry service, or cloud dependency;
- beginning phone/PWA networking work.

For a destructive action, preview the exact target, command, expected impact, and recovery path, then wait for a separate approval. Approval does not carry over to a retry with changed targets or commands.

## 4. Confirmed Product Decisions

- Audience: one private user initially.
- Goal: practical C1 fluency, not merely passing a test.
- Language variety: primarily Mexican Spanish; identify broader regional alternatives when useful.
- Session lengths: a normal session plus an explicit 15-minute daily option.
- Assessment: baseline assessment and periodic checkpoints are required.
- Learning strategy: diagnose, remediate, transfer, delay, and verify.
- Adaptation: difficulty and activity selection must respond to demonstrated performance.
- Persistence: learning history, settings, reference content, exports, and backups remain offline.
- Data location: application-owned data folder, comparable to a game's save-data folder; do not scatter learning data through personal document folders.
- Cost: no paid services.
- AI: local Ollama-compatible inference behind a configurable provider boundary.
- Platform now: Windows desktop.
- Platform later: optional Galaxy S25/mobile PWA, deferred.
- Phone dependency: none. The complete desktop application must work without a phone.

## 5. Verified Local Development Runtime

The following was manually verified on the development computer on 2026-08-24:

```text
Ollama API:      http://127.0.0.1:11434
Ollama version:  0.17.1
Model:           qwen3.5:4b
Model ID:        2a654d98e6fb
Runtime size:    6.3 GB
Processor split: 29% CPU / 71% GPU
Context:         4096 tokens
```

The model successfully responded to a Spanish correction prompt. It correctly changed:

```text
Si tendría más tiempo, viajaría más.
```

to:

```text
Si tuviera más tiempo, viajaría más.
```

However, its reasoning also proposed the incorrect real conditional `Si tenga más tiempo, viajaré`; the correct form is `Si tengo más tiempo, viajaré`.

This is a deliberate design constraint: model output is a proposal, not linguistic truth. The application must support rule/reference checks, uncertainty, and later verification. Do not display or store private model chain-of-thought. Request concise structured answers and disable visible thinking when the installed Ollama API/model supports it.

Initial runtime defaults:

```text
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:4b
OLLAMA_CONTEXT_LENGTH=4096
```

These values must be configurable. The eventual stronger AI computer must be swappable through configuration rather than a rewrite.

## 6. Recommended Architecture

Confirm installed tooling before adopting this stack. If the folder is empty and the required runtime is available, prefer:

- TypeScript throughout.
- React and Vite for the user interface.
- A small Node.js local application service.
- SQLite for durable learning state.
- Electron as the Windows desktop shell.
- A provider interface around Ollama.
- Shared runtime schemas for every AI response crossing into trusted application logic.

The dependency list and versions must be previewed once for Alex before installation. Do not silently add packages.

Keep these boundaries explicit:

```text
Desktop UI
    -> local application API/use cases
        -> learning engine
        -> persistence adapter
        -> language-reference/rule checks
        -> AI provider interface
            -> Ollama adapter
```

The UI must not call Ollama directly. Learning decisions must not be buried in React components or prompts. Ollama-specific request fields must remain inside the provider adapter.

### Suggested source layout

```text
apps/
  desktop/          Electron shell
  web/              React UI, reusable for a later PWA
  server/           Loopback-only local application service
packages/
  domain/           Weakness, evidence, mastery, session and assessment rules
  ai-provider/      Provider contract, Ollama adapter and schemas
  persistence/      SQLite schema, repositories, backup/export logic
  references/       Curated rule identifiers and deterministic checks
  shared/           Stable DTOs and shared utilities only
data/               Runtime data; ignored by Git
docs/               Architecture and validation notes
```

This is a recommendation, not permission to introduce unnecessary workspace tooling. A simpler layout is acceptable if it preserves the boundaries.

## 7. Portable Data Contract

The application must have one configurable `APP_DATA_ROOT`. In development, default it to an application-owned `data/` directory beneath the project or packaged application folder. Do not default to Documents, Desktop, OneDrive, or an arbitrary profile folder.

Expected structure:

```text
data/
  spanish-c1.sqlite
  references/
  recordings/
  exports/
  backups/
  logs/
  settings.json
```

Requirements:

- Git must ignore runtime data while retaining an empty-directory convention or setup documentation.
- Logs must not contain model chain-of-thought, secrets, full audio, or unnecessary raw personal responses.
- The database and file paths must be derived from the validated data root.
- Export and backup must produce portable artifacts beneath the data root.
- The application must surface the active data-root path in Settings.
- Startup must fail clearly if the data root cannot be created or written; it must not silently switch locations.
- A future move to the AI host should consist of copying the application-owned folder and changing provider configuration.

The intended permanent data root on the separate AI host is currently:

```text
C:\Users\aolso\Spanish-C1
```

Do not access or modify that computer during desktop development on this device.

## 8. Core Domain Model

Use stable identifiers and append-only evidence where practical. Exact table names may differ, but the domain must represent the following concepts.

### Weakness

- stable ID;
- category and subcategory;
- linguistic feature or communicative skill;
- first detected and most recently observed timestamps;
- current lifecycle state;
- confidence;
- severity and communicative impact;
- recurrence count;
- source activity;
- next review date;
- related reference/rule IDs;
- Mexican-Spanish relevance notes when applicable.

### Evidence event

- immutable event ID and timestamp;
- session/activity ID;
- learner input or a privacy-preserving reference to it;
- expected behavior;
- observed behavior;
- model proposal;
- validator/reference result;
- final disposition and confidence;
- difficulty and support level;
- whether this was detection, remediation, transfer, delayed verification, or recurrence.

### Weakness lifecycle

Use an explicit state machine resembling:

```text
suspected
  -> confirmed
  -> remediating
  -> provisional
  -> verified
  -> resurfaced
```

Rules:

- One model judgment cannot move a weakness directly from suspected to verified.
- Confirmation requires repeated evidence or a high-confidence deterministic/reference-backed check.
- Provisional means immediate supported performance improved; it is not mastery.
- Verified requires delayed performance in a changed context with reduced support.
- A materially similar later error reopens the weakness as resurfaced.
- Never erase contradictory evidence merely because the latest answer was correct.

### Difficulty state

Track difficulty separately from mastery. At minimum include:

- linguistic complexity;
- task openness;
- time pressure;
- lexical support;
- grammatical hints;
- number of simultaneous targets;
- familiarity of topic;
- comprehension versus production;
- spoken versus written mode when audio is added.

Increase one major dimension at a time. If repeated failure occurs, reduce support gradually or isolate the prerequisite weakness rather than simply giving the answer.

## 9. AI Contract

The application must request structured output validated before persistence. A correction proposal should include fields comparable to:

```json
{
  "correctedText": "Si tuviera más tiempo, viajaría más.",
  "issues": [
    {
      "category": "grammar.conditional.si_clause",
      "span": "tendría",
      "replacement": "tuviera",
      "explanation": "Use the imperfect subjunctive in the si-clause for a present hypothetical condition.",
      "confidence": 0.94,
      "referenceIds": ["conditional.present_hypothetical"]
    }
  ],
  "mexicanSpanishNotes": [],
  "uncertainties": []
}
```

Requirements:

- Validate shape, enums, lengths, confidence ranges, and required fields.
- Reject malformed output without writing a confirmed weakness.
- Permit `uncertain` or `needs_review`; never force false certainty.
- Keep prompts versioned and testable.
- Store prompt/version metadata, not chain-of-thought.
- Use timeouts, cancellation, and clear offline/model-unavailable errors.
- Do not automatically retry indefinitely.
- Keep the provider replaceable and expose a health check.
- A second call to the same 4B model is not independent verification.

## 10. Learning Loop

Implement the smallest complete vertical slice before broad feature work:

```text
learner production
  -> correction proposal
  -> schema and rule/reference validation
  -> weakness evidence update
  -> focused explanation
  -> targeted exercise
  -> immediate transfer exercise
  -> session summary
  -> delayed review scheduling
```

The learner must be able to disagree with a correction, mark it unclear, or defer it. Such actions remain visible as evidence and do not silently confirm a weakness.

### Fifteen-minute session

Use time budgets, not rigid clocks:

1. Retrieval warm-up — approximately 2 minutes.
2. Targeted production — approximately 5 minutes.
3. Focused repair/explanation — approximately 3 minutes.
4. Changed-context transfer check — approximately 3 minutes.
5. Summary and scheduling — approximately 2 minutes.

If no weakness is sufficiently confirmed, use diagnostic production rather than inventing one. If the AI is unavailable, the application should still show history, due reviews, saved references, and an actionable connection error.

## 11. Assessment and Checkpoints

### Baseline

The baseline must sample, at minimum:

- written production;
- comprehension;
- grammatical control;
- lexical precision and range;
- cohesion and discourse organization;
- register/pragmatics;
- Mexican-Spanish comprehension and naturalness;
- spoken comprehension and production after desktop audio is available.

Do not reduce the result to one score. Produce a skill profile, evidence links, confidence, and initial weaknesses.

### Checkpoints

Support periodic checkpoints and an on-demand checkpoint. Compare current performance with prior evidence using stable rubrics. Checkpoints must include unfamiliar prompts and reduced support so that memorized answers do not count as C1 control.

A weakness can be considered durably improved only when evidence shows:

- successful correction or production;
- successful transfer to a changed context;
- successful delayed retrieval;
- no immediate recurrence across the configured verification window.

## 12. Milestone Execution Order

### M0 — Environment and repository

Deliver:

- environment inventory;
- source-control safety check;
- proposed stack and dependency manifest;
- one-time approval request for missing dependencies;
- documented local commands;
- configuration template with no secrets.

Acceptance:

- project can be reproduced from documented commands;
- runtime data and secrets are ignored;
- no phone or AI-host changes occur.

### M1 — Ollama vertical slice

Deliver:

- configurable provider interface;
- Ollama health/version/model check;
- chat request with 4096 context and hidden reasoning when supported;
- validated structured correction response;
- timeout, cancellation, malformed-response, and unavailable-server behavior;
- focused tests using a fake HTTP transport only at the external provider boundary;
- one optional live smoke test against local `qwen3.5:4b`.

Acceptance:

- app code, not only `ollama run`, successfully obtains and validates a Spanish correction;
- bad model output cannot become confirmed learning data;
- the active endpoint/model/context are visible in diagnostics.

### M2 — Persistence and weakness engine

Deliver:

- SQLite schema and migrations;
- repositories for sessions, weaknesses, evidence, reviews, settings, and assessments;
- lifecycle transition rules;
- difficulty adjustment rules;
- local export and backup;
- synthetic fixtures and domain tests.

Acceptance:

- closing and reopening the app preserves history;
- a recurring error reopens a verified weakness;
- immediate success cannot produce verified status;
- data stays beneath `APP_DATA_ROOT`.

### M3 — Text-based 15-minute session

Deliver:

- desktop session UI;
- diagnostic or due-review activity selection;
- correction/explanation view;
- targeted exercise and transfer exercise;
- learner disagreement/unclear controls;
- session timer guidance and summary;
- keyboard-accessible core flow.

Acceptance:

- a user can complete the whole text loop without developer tools;
- the session creates inspectable evidence and a scheduled review;
- restarting restores progress.

### M4 — Weakness dashboard and controlled difficulty

Deliver:

- weakness list and detail evidence timeline;
- due-review queue;
- state, confidence, recurrence, and difficulty visibility;
- manual pause/reopen controls with audit-like evidence;
- session selection biased toward due and high-impact weaknesses without starving broader C1 practice.

Acceptance:

- the user can explain why the next activity was selected;
- difficulty changes are bounded and inspectable;
- recurring mistakes are visibly connected to prior evidence.

### M5 — Baseline and checkpoint assessments

Deliver:

- resumable baseline;
- stable skill rubric;
- checkpoint generator and unfamiliar prompt bank;
- comparison report tied to evidence;
- no unsupported single-number C1 claim.

Acceptance:

- baseline produces an evidence-linked profile;
- checkpoint results can be compared without changing rubric meaning;
- uncertain AI judgments remain visibly uncertain.

### M6 — Desktop audio

Only begin after the text loop is stable.

Deliver:

- local microphone capture;
- local STT adapter;
- local TTS adapter;
- playback and transcript correction controls;
- device selection and permission guidance;
- audio retention controls under the data root.

Stop for approval before installing models, runtimes, or system dependencies. Benchmark candidate STT/TTS components on this computer before choosing them.

Acceptance:

- spoken activity works without a paid or hosted service;
- transcript uncertainty is not misclassified as a Spanish weakness;
- the user can correct a transcript before linguistic evidence is committed.

### M7 — Windows packaging and recovery

Deliver:

- local Windows package or installer candidate;
- first-run setup and diagnostics;
- backup, restore, export, and import validation;
- model-unavailable and database-recovery guidance;
- clean restart test;
- sustained session smoke test.

Acceptance:

- packaged application completes a text session against local Ollama;
- data survives an application upgrade/restart test;
- backup and restore are demonstrated with synthetic data;
- no phone is required.

### M8 — Stronger AI-host migration readiness

Do not modify the host during this milestone. Produce only:

- provider-configuration instructions;
- a loopback/private-network threat boundary;
- model evaluation prompts and expected structured contracts;
- data-copy and rollback checklist;
- a list of host-side prerequisites still requiring verification.

The known host-side Ollama/Docker networking investigation is a separate operational track. Do not recreate containers or apply its pending bind fix from this handoff.

### Deferred — Phone/PWA

Do not implement until Alex explicitly reactivates it after the Windows application passes M7. Preserve reusable web UI boundaries, but do not add phone networking, authentication, HTTPS, service-worker, installation, synchronization, or responsive-device acceptance work now.

## 13. Verification Strategy

Tests must verify domain behavior, not prompt wording alone.

Required focused coverage:

- valid and malformed AI responses;
- unsupported category/reference identifiers;
- timeout and Ollama-offline behavior;
- weakness lifecycle legal and illegal transitions;
- recurrence after verification;
- delayed review scheduling;
- bounded difficulty changes;
- persistence across restart;
- data-root containment;
- backup/restore using synthetic data;
- 15-minute session completion;
- learner disagreement and transcript correction paths;
- no phone dependency.

Maintain a small golden linguistic fixture set reviewed for correctness. Include at least:

```text
Hypothetical: Si tuviera más tiempo, viajaría más.
Real condition: Si tengo más tiempo, viajaré más.
Past counterfactual: Si hubiera tenido más tiempo, habría viajado más.
```

Golden fixtures validate the application and prompt contract; they do not prove the model is broadly correct. Report live model quality separately from deterministic software-test results.

## 14. User Guidance Protocol

After each milestone, give Alex a short report:

```text
Outcome:
Files changed:
Checks run:
Verified:
Unverified:
Your next action:
```

Only ask Alex to perform actions the implementation model cannot safely complete. Provide one smallest next action at a time, with copy/paste commands where applicable. Explain expected output and what error output should be returned.

If a choice is required, recommend one option and explain the practical consequence. Do not ask broad questions such as “What do you want to do next?” when a concrete next milestone is available.

## 15. Definition of Desktop Complete

The desktop application is complete enough to revisit phone support when all of the following are directly verified:

- packaged Windows app starts without development tooling;
- local Ollama configuration is editable and diagnosable;
- baseline and checkpoints work;
- normal and 15-minute sessions work;
- weakness detection, recurrence, remediation, transfer, delayed verification, and difficulty control are persisted and inspectable;
- model uncertainty and malformed output fail safely;
- text and desktop audio workflows work offline;
- all user learning data stays under the configured application data root;
- backup, restore, export, restart, and upgrade paths have been exercised with synthetic data;
- no paid service, telemetry, or phone is required;
- unresolved risks and host-migration prerequisites are documented.

## 16. First Instruction to Execute

Begin with M0. Perform only read-only inventory first. Then present:

1. the detected toolchain and Git state;
2. the proposed minimal stack;
3. the exact packages and versions to install;
4. the exact files/directories that will be created;
5. the verification commands;
6. the expected disk impact;
7. the smallest approval needed to proceed.

After Alex approves that bounded dependency/bootstrap action, continue automatically through M1 and as far into later milestones as safely possible. Stop only at a defined gate, a genuine user decision, or an evidence-backed blocker.
