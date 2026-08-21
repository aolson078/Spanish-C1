# SPA C1 Host Model Handoff

**Prepared:** 2026-07-31  
**Recipient:** AI model operating on the intended SPA C1 host computer  
**Project state:** Product specification and Phase 0 plan complete; host experiments not started

## 1. Mission

Help Alex build a private application that moves him from demonstrated B2 Spanish to practical C1 fluency.

The defining product capability is a weakness-remediation engine:

`detect -> diagnose cause -> explain -> focused practice -> varied application -> delayed verification -> monitor`

Do not begin application implementation yet. Your first responsibility is to establish trustworthy host evidence and execute the Phase 0 gates in dependency order.

## 2. Read These Files First

Read each file completely before proposing technology or changing the host:

1. `PRODUCT-SPEC.md` — authoritative product requirements, state definitions, acceptance criteria, risks, and experiment gates
2. `PHASE-0-PLAN.md` — execution procedures, evidence requirements, provisional thresholds, and Phase 1 readiness rules
3. `HOST-HANDOFF.md` — current-state and operating instructions for the receiving model

If this handoff conflicts with `PRODUCT-SPEC.md`, the product specification wins. If an experiment procedure conflicts with a normative requirement, stop and report the conflict instead of weakening the requirement.

## 3. Confirmed Decisions

- The product optimizes for practical C1 fluency.
- DELE alignment provides checkpoints; it is not the primary curriculum.
- Mexican Spanish guides vocabulary, pronunciation, idiom, cultural context, examples, and learner production.
- All four skills matter, with about 60% of routine practice focused on listening and spontaneous speaking.
- The application identifies specific weaknesses, teaches root causes, and requires repeated delayed evidence before recording mastery.
- Fifteen-minute sessions are complete learning sessions; 45-minute sessions provide greater depth.
- Version one is private and supports one learner.
- The client is an installable responsive web application for computers and phones.
- The first mobile target is a Samsung Galaxy S25.
- Chrome is the assumed primary mobile browser; Samsung Internet is a secondary compatibility check.
- The host runs Windows.
- Planned host hardware includes 32 GB RAM and an NVIDIA RTX 5070 Ti.
- The phone initially reaches the host only on the same private network.
- The application requires authentication and encrypted client-to-host transport.
- AI, transcription, speech generation, correction, and persistence run locally.
- No paid APIs or hosted AI services are allowed.
- Personal learning data is never uploaded.
- Persistent learning data and locally managed assets live in a visible, user-chosen portable `SPA C1` folder.
- Raw audio is transient unless Alex deliberately saves a recording.
- Public internet access is limited to learner-initiated authentic content retrieval and approved model/reference downloads.
- Phase 1 is a single complete 15-minute speaking/listening weakness-remediation loop.

## 4. Facts That Remain UNVERIFIED

Do not present these as known until you verify them on the intended host or phone:

- Windows edition, version, and build
- CPU model
- Exact installed RAM recognized by Windows
- Exact RTX 5070 Ti variant and GPU memory
- NVIDIA driver version and supported local runtime capabilities
- Available storage and intended portable-data-root drive
- Sustained thermal and performance behavior
- Installed Chrome and Edge versions
- Galaxy S25 Android, Chrome, and Samsung Internet versions
- Browser microphone, playback, PWA, background, and reconnection behavior
- Private-network topology or addresses
- Local model compatibility, accuracy, resource use, or latency
- Suitable Mexican Spanish speech-recognition and speech-generation models
- Correction reliability
- Licensed authoritative reference sources

Never fill these gaps from hardware marketing claims or model popularity.

## 5. Safety and Authorization Boundary

Begin read-only.

You may inspect the copied project files and report the host's non-secret hardware/software inventory. Do not install dependencies, drivers, model runtimes, containers, certificates, services, firewall rules, or models until Alex explicitly authorizes that action on the host.

Do not:

- Upload transcripts, recordings, weaknesses, progress, prompts, or benchmark samples
- Use a paid API or hosted AI service
- expose an application port directly to the public internet
- Search for, print, copy, or store credentials, Wi-Fi passwords, private keys, tokens, or Windows product keys
- Record unnecessary device identifiers
- Treat speech-recognition output as proof of a learner error
- Select a technology stack before the relevant Phase 0 evidence exists
- Run destructive cleanup, reset, deletion, deployment, or system-reconfiguration actions without Alex's separate approval for the exact action and target
- Begin Phase 1 while any Phase 0 gate is implicitly unresolved

If a proposed tool silently sends telemetry or content externally, treat that behavior as a product risk and do not use it until the data flow is understood and accepted.

## 6. Exact First Assignment

Perform an `EXP-01` preflight in read-only mode.

### Step 1: Verify project state

- Confirm that `PRODUCT-SPEC.md`, `PHASE-0-PLAN.md`, and `HOST-HANDOFF.md` exist in the copied `SPA C1` folder.
- Read all three completely.
- Report any missing file, conflicting requirement, or unexpected existing code before proceeding.

### Step 2: Inspect the host without installing anything

Record only:

- Windows edition, version, and build
- CPU model
- Installed RAM
- GPU model and GPU memory
- Current NVIDIA driver version
- Free space on the proposed project/data drive
- Chrome and Edge versions, if installed
- Whether the Galaxy S25 and host can reach each other on the intended private network, without exposing secrets or changing network configuration

Label any unavailable value **UNVERIFIED**.

### Step 3: Compare evidence with prerequisites

Compare the observed host state with Sections 2, 5, and 6 of `PHASE-0-PLAN.md`.

Identify:

- Missing host setup prerequisites
- Any obvious hardware or storage constraint
- Any required installation or configuration action
- The exact approval needed from Alex before performing each state-changing action

### Step 4: Stop for approval

Do not install candidate runtimes or models during the preflight. Give Alex the inventory, gaps, and the smallest proposed next action. Wait for explicit authorization.

## 7. EXP-01 Evidence to Create After Authorization

Once Alex authorizes Phase 0 evidence creation, use this layout inside the portable project folder:

```text
phase-0/
  RESULTS.md
  decisions/
    EXP-01-decision.md
  evidence/
    EXP-01/
      host-inventory.md
      candidate-comparison.md
      resource-measurements.md
      sustained-session.md
      restart-repetition.md
```

Evidence must be concise, reproducible, and secret-safe. Summarize measurements rather than preserving raw system or command transcripts.

`EXP-01-decision.md` must include:

- Environment identity without unnecessary identifiers
- Candidates evaluated and why
- Procedures and evidence paths
- Isolated and concurrent resource use
- Sustained-session results
- Clean-restart results
- Supported resource envelope
- Known incompatibilities or combinations that cannot remain loaded together
- Final status: PASS, BLOCKED, or REMOVED
- Any Alex-approved limitation

## 8. Phase 0 Sequence After EXP-01

Follow the dependency order in `PHASE-0-PLAN.md`:

1. Foundation: `EXP-01`, `EXP-06`, `EXP-07`, `EXP-08`
2. Language components: `EXP-02`, `EXP-03`, `EXP-09`
3. Integrated correction reliability: `EXP-05`
4. End-to-end conversation performance: `EXP-04`
5. Phase 1 readiness review

Do not collapse several gates into a favorable demo. Each gate needs its own required evidence and decision record.

## 9. Reporting Format to Alex

Use this structure after each bounded task:

```md
Outcome: <what was established>

Verified:
- <direct evidence>

UNVERIFIED:
- <fact still requiring evidence>

Files created or changed:
- <path and purpose>

Checks performed:
- <read-only check or experiment and result>

Risks or blockers:
- <specific issue, or none>

Next proposed action:
- <one smallest action>

Approval required:
- <exact installation, configuration, or other state-changing action; omit if none>
```

Do not claim that a model, browser, or host configuration works until the corresponding required experiment passes.

## 10. First Message on the Host

After copying the complete `SPA C1` folder to the host, Alex can give the receiving model this instruction:

> Read `HOST-HANDOFF.md`, `PRODUCT-SPEC.md`, and `PHASE-0-PLAN.md` completely. Begin only with the read-only `EXP-01` preflight defined in the handoff. Do not install or change anything yet. Report verified inventory, unverified facts, prerequisite gaps, and the exact smallest approval you need next.

## 11. Handoff Completion Condition

This handoff is successfully received when the host model:

1. Confirms the three governing files were read.
2. Repeats the local-only, no-paid-service, no-upload, and private-network constraints.
3. Provides a secret-safe read-only host inventory.
4. Separates verified facts from unverified assumptions.
5. Proposes no Phase 1 implementation before Phase 0 evidence.
6. Stops before the first installation or system change and requests exact approval.
