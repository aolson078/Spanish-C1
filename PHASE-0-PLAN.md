# SPA C1 Phase 0 Execution Plan

**Status:** Ready for host setup  
**Date:** 2026-07-31  
**Governing specification:** `PRODUCT-SPEC.md` Draft v0.3  
**Host handoff:** `HOST-HANDOFF.md`  
**Purpose:** Resolve `EXP-01` through `EXP-09` before Phase 1 implementation

## 1. Outcome

Phase 0 selects and validates the smallest local technology set capable of supporting the first weakness-remediation loop.

Phase 0 is complete only when every experiment has a recorded result and one of these outcomes:

- **PASS:** Evidence satisfies the exit condition.
- **BLOCKED:** Evidence shows that the required capability is not currently viable.
- **REMOVED:** The affected capability was explicitly removed from first-version scope in `PRODUCT-SPEC.md`.

An experiment cannot pass because a tool installed successfully or produced one favorable example. Its required evidence must be recorded on the intended host and clients.

## 2. Fixed Constraints

- Host operating system: Windows; exact edition, version, and build are recorded during `EXP-01`.
- Planned host hardware: 32 GB RAM and NVIDIA RTX 5070 Ti; exact GPU memory is unverified until setup.
- Primary mobile client: Samsung Galaxy S25.
- Primary mobile browser assumption: Chrome.
- Secondary mobile compatibility check: Samsung Internet.
- Desktop browsers: current Chrome and Edge on the target Windows computer.
- All AI, speech, correction, and persistence processing runs locally.
- No paid APIs or hosted AI services.
- Personal learning data stays inside the portable data root.
- The application is not exposed directly to the public internet.
- Public access is limited to learner-initiated content retrieval and approved downloads.
- Phase 0 does not commit the application to a framework, database, model, or runtime before the related evidence exists.

Exact device, operating-system, driver, and browser versions are **UNVERIFIED** until captured from the configured devices.

## 3. Evidence Layout

When experiments begin, keep their durable outputs inside the application folder:

```text
SPA C1/
  phase-0/
    RESULTS.md
    decisions/
    evidence/
      EXP-01/
      EXP-02/
      EXP-03/
      EXP-04/
      EXP-05/
      EXP-06/
      EXP-07/
      EXP-08/
      EXP-09/
```

`RESULTS.md` is the status index. Each experiment also receives one decision record named `EXP-NN-decision.md` containing:

- Date and environment identity
- Candidates evaluated
- Procedure used
- Evidence files
- Results and known limitations
- PASS, BLOCKED, or REMOVED status
- Selected option or explicit reason no option was selected
- Alex's approval when a subjective threshold or language judgment is involved

Do not store credentials, private keys, raw command transcripts, or unrelated machine information in evidence files.

## 4. Execution Order

The experiments run in dependency order:

1. **Foundation:** `EXP-01`, `EXP-06`, `EXP-07`, `EXP-08`
2. **Language components:** `EXP-02`, `EXP-03`, `EXP-09`
3. **Integrated learning quality:** `EXP-05`
4. **End-to-end performance:** `EXP-04`
5. **Phase 1 readiness review:** confirm all nine outcomes and update `AC-15` thresholds

Independent foundation checks may be batched, but an experiment cannot use an unresolved dependency as evidence.

## 5. Setup Prerequisites

Before experimentation:

1. Complete normal Windows setup on the intended host.
2. Install current supported NVIDIA drivers through an official NVIDIA source.
3. Apply current Windows security updates.
4. Confirm that the host and Galaxy S25 can reach each other on the intended private network.
5. Record the intended desktop and mobile browser versions.
6. Create or choose the visible portable `SPA C1` data root.
7. Confirm sufficient free storage before downloading any model.
8. Do not install model runtimes, containers, or application frameworks until `EXP-01` records why they are needed.

The setup record must not contain Windows product keys, Wi-Fi credentials, account tokens, or device identifiers unnecessary for reproduction.

## 6. EXP-01 — Host Capability

### Question

Which local model sizes and component combinations can the intended host run reliably?

### Procedure

1. Record Windows edition/build, CPU model, installed RAM, GPU model, GPU memory, driver version, and free disk space.
2. Record idle CPU, RAM, GPU-memory, and storage use.
3. Evaluate only locally runnable candidates needed for speech recognition, speech generation, and language reasoning.
4. Measure each candidate alone.
5. Measure likely concurrent combinations during a sustained 30-minute simulated session.
6. Record startup time, model load time, memory use, GPU use, response timing, thermal behavior, crashes, and resource exhaustion.
7. Repeat the selected combination after a clean host restart.

### Required evidence

- Redacted host inventory
- Candidate comparison table
- Resource measurements for isolated and concurrent workloads
- Sustained-session result
- Clean-restart repetition

### Exit condition

Record a supported resource envelope naming:

- Maximum accepted model sizes
- Components that may remain loaded together
- Components that must load sequentially
- Required free storage
- Known thermal or stability limits

If no combination supports the first-version loop, mark `EXP-01` BLOCKED before application implementation begins.

## 7. EXP-02 — Speech Recognition

### Question

Which local speech-recognition model can transcribe the learner and Mexican Spanish without converting recognition uncertainty into false language corrections?

### Benchmark set

- 30 scripted learner utterances covering common B2–C1 grammar and Mexican vocabulary
- 10 spontaneous learner responses of approximately 60 seconds
- 10 licensed or user-provided Mexican Spanish samples with reviewed transcripts
- Deliberate coverage of numbers, names, connected speech, hesitation, self-correction, and background noise

Learner recordings require deliberate test participation. Raw benchmark audio remains local and is deleted after the decision unless Alex explicitly selects samples for continued regression testing.

### Procedure

1. Produce a human-reviewed reference transcript for each sample.
2. Run every candidate under the same local conditions.
3. Record word error rate, meaning-changing errors, omitted self-corrections, punctuation behavior, and available uncertainty signals.
4. Tag whether each apparent language error originated in speech recognition or learner production.
5. Retest the strongest candidates on unseen samples.

### Required evidence

- Redacted benchmark manifest
- Candidate comparison
- Error taxonomy
- Unseen-sample results
- Proposed uncertainty-handling policy

### Exit condition

Select one model and a policy that keeps uncertain recognition segments from confirming weaknesses automatically. If uncertainty cannot be surfaced reliably, speech-derived corrections remain candidates requiring learner confirmation.

## 8. EXP-03 — Speech Generation

### Question

Which local voice is intelligible, responsive, and appropriate for Mexican Spanish practice?

### Benchmark set

Use at least 20 reviewed prompts covering:

- Short conversational turns
- Questions and interruptions
- Numbers, dates, names, and abbreviations
- Mexican vocabulary and idioms
- Stress-sensitive words and connected speech
- Longer explanatory responses

### Procedure

1. Generate every prompt with each candidate using comparable settings.
2. Randomize candidate identity for listening review.
3. Rate intelligibility, Mexican fit, naturalness, fatigue over repeated listening, and critical pronunciation errors.
4. Measure generation time and time to first audible output.
5. Repeat the preferred voice after a clean restart.

### Provisional acceptance targets

- Median intelligibility rating: at least 4/5
- Median naturalness rating: at least 3/5
- No repeated critical pronunciation error in accepted seed vocabulary
- Timing must remain within the thresholds later approved by `EXP-04`

### Exit condition

Alex accepts one voice for the vertical slice and the decision record lists its known limitations. If no voice is acceptable, mark speech generation BLOCKED rather than silently switching to a public service.

## 9. EXP-04 — Conversation Performance

### Question

What timing preserves conversational flow across local speech recognition, reasoning, speech generation, persistence, and review?

### Procedure

1. Use the selected components from `EXP-01`, `EXP-02`, `EXP-03`, and `EXP-05`.
2. Run at least three complete 15-minute sessions on the intended host.
3. Include ordinary turns, explicit help, communication breakdown, a correction dispute, and final review generation.
4. Measure speech-finalization time, model response time, first audible response, complete response, persistence, and final review generation.
5. Repeat from Chrome and Edge on Windows and Chrome on the Galaxy S25.
6. Record median, 95th percentile, and worst observed timing for each stage.

### Provisional interaction targets

- First audible response after the learner stops: median at most 3 seconds
- First audible response: 95th percentile at most 6 seconds
- Post-session focused review: at most 30 seconds
- No lost audio, duplicated turn, or corrupted session state

These are initial product targets, not assumed hardware results. Alex approves or revises the final thresholds using recorded demonstrations. The approved values replace the provisional targets and are copied into `AC-15`.

### Exit condition

Record approved timing thresholds and demonstrate the selected stack meeting them in repeated full sessions. Otherwise mark the affected interaction BLOCKED and change the local design before Phase 1.

## 10. EXP-05 — Correction Reliability

### Question

Can the local stack distinguish learner errors from transcription errors, valid regional forms, and stylistic alternatives?

### Reviewed test set

Create at least 60 cases:

- 20 genuine grammar, vocabulary, register, or pronunciation problems
- 15 speech-recognition errors that must not become learner weaknesses
- 15 valid Mexican or other regional forms
- 10 stylistic alternatives that are not errors

Every expected judgment must cite the accepted local reference set or be labeled as human-reviewed test policy.

### Procedure

1. Evaluate cases without exposing the expected label to the candidate model.
2. Record proposed correction, root cause, explanation, reference, confidence, and ledger action.
3. Separate detection quality from confidence calibration.
4. Review every high-confidence false correction.
5. Retest after adjusting prompts, retrieval, or confidence policy.

### Provisional acceptance targets

- Zero known high-confidence false confirmations in the reviewed test set
- Every unsupported claim labeled uncertain
- Every likely transcription error blocked from automatic confirmation
- Every disputed correction preserves its evidence and avoids curriculum changes

### Exit condition

Select the correction pipeline and confidence policy, with known failure modes recorded. A known high-confidence false confirmation blocks automatic weakness confirmation.

## 11. EXP-06 — Browser Audio and PWA Behavior

### Target matrix

| Device | Primary check | Secondary check |
|---|---|---|
| Windows computer | Chrome | Edge |
| Samsung Galaxy S25 | Chrome | Samsung Internet |

Exact versions are recorded at test time.

### Procedure

For each browser, test:

1. Initial microphone permission and later permission changes
2. Start, stop, cancel, and retry recording
3. Audio playback and interruption
4. Headphones, speaker, and Bluetooth behavior when available
5. Network interruption and reconnection
6. Screen lock, browser backgrounding, and returning to the session
7. PWA installation, launch, update, and removal behavior
8. A complete 15-minute session

### Exit condition

Chrome on Windows and Chrome on the Galaxy S25 must support the complete core flow. Edge and Samsung Internet limitations may be documented unless they invalidate the installable-web-app boundary. A material primary-browser failure triggers an explicit client-boundary decision.

## 12. EXP-07 — Private-Network Security

### Question

Which local authentication and encrypted-transport approach works on both devices without public exposure or hidden external dependencies?

### Procedure

1. Evaluate local encrypted-transport options and one-account authentication options.
2. Confirm successful authorized access from the target Windows browser and Galaxy S25.
3. Confirm failed anonymous access and failed invalid-credential access.
4. Confirm the service is not reachable through a public interface or router port-forward.
5. Restart the host and clients and repeat access checks.
6. Restore the portable data root in a clean test installation and document certificate-trust or device re-enrollment steps.
7. Inspect runtime network traffic to confirm that authentication and learning data stay local.

### Exit condition

Select one reproducible approach with documented setup, restart, recovery, and device-enrollment behavior. Any public exposure, plaintext credentials, or unapproved external authentication dependency blocks the gate.

## 13. EXP-08 — Portable Persistence and Recovery

### Procedure

1. Create representative competency, session, correction, dispute, weakness, mastery-event, and reopened-event records.
2. Restart the client and host and compare every committed record.
3. Interrupt a write and verify that the last committed state remains valid.
4. Complete an ordinary audio session and verify raw audio deletion.
5. Explicitly save one recording and verify that only the selected recording persists.
6. Create multiple versioned snapshots.
7. Restore a selected snapshot into a clean installation using the portable data root.
8. Move the portable data root to another user-chosen path and repeat the restore.
9. Test an optional encrypted mirror to a separate offline drive when one is available.

### Exit condition

The clean installation reproduces the selected snapshot without reconstructing learning history. No required learning state may depend on hidden system data. Runtime reinstall, certificate trust, or device re-enrollment may be required only as allowed by the portability contract.

## 14. EXP-09 — Reference Foundation

### Question

Which local sources can support accurate, traceable explanations of general and Mexican Spanish?

### Procedure

1. Identify candidate authoritative sources before downloading or bundling them.
2. Record publisher/owner, authority, language coverage, Mexican-usage coverage, access method, license, redistribution rights, and attribution requirement.
3. Reject sources whose permitted local use cannot be established.
4. Create a small local seed corpus from accepted sources.
5. Test retrieval using at least 30 questions spanning grammar, vocabulary, register, idiom, and regional variation.
6. Confirm that results preserve source identity and distinguish supported claims from uncertainty.
7. Use the seed set during `EXP-05` correction evaluation.

### Exit condition

Accept a licensed seed set that can support traceable local correction evidence. Any unsupported or conflicting claim must remain uncertain rather than entering the confirmed weakness ledger.

## 15. Phase 1 Readiness Review

Before Phase 1 begins:

1. `EXP-01` through `EXP-09` each have a decision record and status.
2. No gate remains implicitly unresolved.
3. Selected local components fit the recorded resource envelope.
4. The Galaxy S25 and target Windows browser complete the core audio flow.
5. The correction pipeline passes its accepted confidence policy.
6. Authentication and encrypted transport work without public exposure.
7. Portable restore and transient-audio deletion pass.
8. A licensed seed reference set is available locally.
9. Approved interaction thresholds are copied into `AC-15`.
10. `PRODUCT-SPEC.md` is updated if evidence requires a scope or requirement change.

The readiness result is one of:

- **READY:** Phase 1 may begin.
- **NOT READY:** Named gates remain blocked and no Phase 1 implementation begins.
- **READY WITH ACCEPTED LIMITATION:** Alex explicitly accepts a recorded limitation that does not violate local-only, no-paid-service, privacy, authentication, or data-integrity requirements.

## 16. Immediate Next Action

Set up the intended Windows host. Once it is available, begin with `EXP-01` and record the exact operating-system, GPU-memory, driver, storage, and browser environment before installing candidate model runtimes.
