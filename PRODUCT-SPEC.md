# SPA C1 Product Specification

**Status:** Draft v0.3  
**Date:** 2026-07-31  
**Product type:** Private, local-first Spanish learning application

## 1. Product Summary

SPA C1 is a private application designed to move one learner from demonstrated B2 Spanish to practical C1 fluency.

The product is not a generic course or an open-ended chatbot. Its central function is to identify specific weaknesses, diagnose their likely causes, teach the missing detail, create targeted practice, and verify through delayed and varied use that the same weakness is no longer recurring.

The application will run as an installable web application on computers and mobile phones. A personal computer on the same private network will initially host all AI, speech, application, and learning-data services.

## 1.1 Specification Conventions

- **Must** identifies a release-blocking requirement.
- **Should** identifies expected behavior that may be deferred only with a recorded reason.
- **May** identifies optional behavior.
- Every first-version acceptance criterion has a stable ID and names the evidence required to close it.
- A criterion is not complete because the implementation exists; its stated evidence must pass on the target devices and host.

### Source-of-truth order

If two statements appear to conflict, use this order:

1. The normative requirement catalog below
2. Defined lifecycle, storage, privacy, and network rules
3. Acceptance criteria, experiment gates, and future validation placeholders
4. Narrative explanations and examples

An unresolved conflict blocks implementation of the affected requirement until this specification is corrected. Privacy, local-only processing, and no-paid-service constraints cannot be weakened by inference.

## 1.2 Glossary and State Boundaries

| Term | Meaning |
|---|---|
| **Competency** | A broad C1 capability, such as sustaining nuanced spoken interaction or understanding implicit meaning. One competency can have many weaknesses. |
| **Competency state** | Coverage status for a broad competency: `untested`, `developing`, `demonstrated`, `verified`, or `regressed`. It is independent of weakness-ledger state. |
| **Observation** | One preserved instance of learner output, context, model analysis, confidence, and supporting references. An observation alone is not necessarily a weakness. |
| **Weakness** | A confirmed, recurring language problem linked to a likely root cause and one or more competencies. |
| **Root cause** | The underlying missing distinction, rule, skill, or processing habit that best explains one or more observations. |
| **Evidence** | Preserved learner performance plus its context, assistance level, timing, confidence, and provenance. Model opinion without learner performance is not mastery evidence. |
| **Mastery event** | The recorded event created when the complete mastery rule is satisfied. Mastery is not a mutable ledger state. |
| **Monitoring** | Low-frequency sampling after a mastery event to check whether performance remains durable. |
| **Reopened event** | A recorded meaningful recurrence that returns a monitored weakness to `learning` while preserving its full history. |
| **Portable data root** | The visible user-chosen `SPA C1` folder containing all persistent learning data and locally managed assets. It does not imply that operating-system runtimes or device-bound private keys are portable. |

## 1.3 Normative Requirement Catalog

This catalog is the authoritative index of product requirements. Section references provide detail; evidence IDs show how each requirement is closed.

| Requirement | Normative requirement | Detail | Delivery | Validation evidence | Principal risk |
|---|---|---|---|---|---|
| REQ-OUT-01 | The product must optimize for practical C1 fluency, using DELE alignment as a checkpoint rather than the curriculum's purpose. | Sections 2 and 20 | Phase 3 | VAL-01 | RSK-09 |
| REQ-LRN-01 | The complete product must develop all four skills, with about 60% of routine practice devoted to listening and spontaneous speaking. | Section 4 | Phase 2 | VAL-02 | RSK-09 |
| REQ-LRN-02 | The complete product must diagnose demonstrated ability rather than accept B2 as a predetermined result. | Section 5 | Phase 2 | VAL-03 | RSK-09 |
| REQ-LRN-03 | A 15-minute session must be a complete learning session, not streak filler. | Section 7.1 | Phase 1 | AC-03 | RSK-08 |
| REQ-LRN-04 | The complete product must provide a deeper 45-minute mode using the same learning state. | Section 7.2 | Phase 2 | VAL-04 | RSK-08 |
| REQ-LRN-05 | Speaking practice must use structured conversations and normally defer corrections until afterward. | Section 7.4 | Phase 1 | AC-04 | RSK-01, RSK-04, RSK-08 |
| REQ-WKN-01 | Confirmed weaknesses must follow the defined evidence-preserving remediation lifecycle. | Section 6.1 | Phase 1 | AC-09, AC-10, AC-11 | RSK-01, RSK-02 |
| REQ-WKN-02 | Low-confidence or disputed corrections must not silently direct the curriculum. | Section 6.2 | Phase 1 | AC-07, AC-08, EXP-05 | RSK-01, RSK-02 |
| REQ-WKN-03 | A session review must teach no more than three prioritized correction patterns. | Section 6.3 | Phase 1 | AC-06 | RSK-08 |
| REQ-WKN-04 | Mastery must require repeated, varied, delayed, unassisted evidence and must remain subject to monitoring. | Section 6.4 | Phase 1 | AC-10, AC-11 | RSK-01, RSK-02 |
| REQ-LNG-01 | Mexican Spanish must guide the learner's production, examples, and initial local voice. | Sections 3 and 9 | Phase 1 | EXP-02, EXP-03, AC-17 | RSK-01, RSK-02 |
| REQ-LNG-02 | The complete product must add secondary comprehension exposure to other regional varieties. | Sections 3 and 9 | Phase 3 | VAL-05 | RSK-09 |
| REQ-REF-01 | Corrective explanations must be grounded in traceable, licensed local references and label uncertainty. | Section 8 | Phase 1 | EXP-05, EXP-09, AC-18 | RSK-01, RSK-05 |
| REQ-PRI-01 | Explanations must default to Spanish and provide immediate English clarification on request. | Section 8 | Phase 1 | AC-16 | RSK-08 |
| REQ-CNT-01 | The complete product must combine authentic Mexican media with locally generated controlled-difficulty material. | Section 9 | Phase 3 | VAL-05 | RSK-05 |
| REQ-PRG-01 | Progress must be represented by competency and evidence, with streaks remaining secondary. | Section 10 | Phase 2 | VAL-06 | RSK-09 |
| REQ-PLT-01 | Version one must run on a target computer and phone through an installable responsive web client on the same private network. | Sections 11.1 and 11.2 | Phase 1 | AC-01, AC-02, EXP-06 | RSK-03, RSK-06 |
| REQ-HST-01 | AI, speech, assessment, and persistence must run on the local host without paid services. | Section 11.3 | Phase 1 | AC-14, AC-15, EXP-01, EXP-04 | RSK-04, RSK-06 |
| REQ-SEC-01 | Version one must require authenticated, encrypted access and must not be publicly exposed. | Section 12 | Phase 1 | AC-01, EXP-07 | RSK-06 |
| REQ-DAT-01 | All persistent learning data must reside in the portable data root and survive host/client restarts. | Section 13 | Phase 1 | AC-12, EXP-08 | RSK-07 |
| REQ-DAT-02 | Raw audio must be transient unless the learner deliberately saves a recording. | Section 13.1 | Phase 1 | AC-05, EXP-08 | RSK-07 |
| REQ-DAT-03 | The application must create recoverable versioned snapshots and support an optional separate-drive mirror. | Section 13.2 | Phase 1 | AC-13, EXP-08 | RSK-07 |
| REQ-NET-01 | Public-network access must be limited to explicit content/update retrieval and must never include personal learning data. | Sections 9 and 11.4 | Phase 1 | AC-14 | RSK-01, RSK-05 |
| REQ-ADP-01 | The complete product must adapt difficulty while preserving objective evidence and learner override signals. | Section 5 | Phase 2 | VAL-07 | RSK-09 |
| REQ-ASM-01 | The complete product must run weekly weakness checks and four-week integrated benchmarks. | Section 7.3 | Phase 3 | VAL-08 | RSK-09 |

## 2. Product Goal

The primary goal is practical C1 fluency. DELE-aligned assessments are objective checkpoints, not the curriculum's main purpose.

The learner graduates when evidence shows that they can:

- Sustain a spontaneous 30-minute conversation with a Mexican Spanish speaker.
- Understand normal-speed podcasts and videos without routinely relying on subtitles.
- Explain, qualify, and defend nuanced opinions.
- Respond effectively in unfamiliar situations and on unfamiliar subjects.
- Write clear, cohesive, multi-paragraph Spanish.
- Demonstrate the above repeatedly rather than in one favorable assessment.

Exact CEFR and DELE rubrics must be sourced and validated before assessment content is implemented.

## 3. Target User and Language Variety

- Version one has one private learner.
- Mexican Spanish guides vocabulary, pronunciation, idioms, example dialogue, and cultural context.
- Other regional accents appear as secondary listening exposure.
- Pronunciation training targets intelligibility, accurate sounds, stress, rhythm, and natural Mexican phrasing.
- A harmless foreign accent is not treated as a weakness.

## 4. Learning Priorities

The product develops listening, speaking, reading, and writing, with approximately 60% of routine practice devoted to listening and spontaneous speaking.

The curriculum uses a hybrid model:

- A structured C1 competency map prevents coverage gaps.
- Daily activities adapt to demonstrated weaknesses, recent mistakes, learner interests, prior performance, and spaced-review needs.
- Preferred topics improve engagement, but the learner must also work with unfamiliar subjects such as society, culture, work, science, current events, ethics, and abstract debate.

## 5. Diagnostic and Curriculum Model

The application does not treat a claimed B2 level as sufficient evidence.

The complete product begins with an adaptive, multi-part diagnostic covering:

- Listening comprehension
- Spontaneous speaking
- Reading comprehension
- Written production

B2 is the expected range, not a predetermined result. The initial curriculum is generated from demonstrated strengths and gaps.

Difficulty adapts automatically. Every activity also provides:

- **Too easy**
- **Too hard**
- **Misdiagnosed**

These signals influence future selection without erasing objective performance evidence.

## 6. Core Weakness-Remediation Engine

The weakness-remediation loop is the product's central engine:

`detect -> diagnose cause -> explain -> focused practice -> varied application -> delayed verification -> monitor`

### 6.1 Weakness ledger

Each credible weakness becomes a tracked learning target. A target records:

- The observed mistake and its context
- The affected competency
- The likely root cause
- Supporting evidence and confidence
- Whether the learner confirmed or disputed the diagnosis
- Explanations and examples already shown
- Practice attempts and outcomes
- Delayed verification results
- Current state and recurrence history

Suggested states are:

`candidate -> confirmed -> learning -> controlled -> verifying -> monitoring`

Branches and recurrence are:

- `candidate -> dismissed`
- `monitoring -> learning` with a preserved reopened event

`dismissed` is a retained terminal state for a candidate that was disputed or disproved. It preserves the original evidence but cannot schedule remediation.

| Current state | Meaning | Permitted next state | Transition requirement |
|---|---|---|---|
| `candidate` | A possible weakness has been observed but is not trusted yet. | `confirmed` or `dismissed` | Confirmation requires sufficiently reliable evidence or explicit learner confirmation; dismissal records its reason. |
| `confirmed` | The weakness and its likely root cause are credible enough to guide learning. | `learning` | An explanation and remediation plan have been created. |
| `learning` | The learner is receiving explanation and focused practice. | `controlled` | The learner succeeds with the target in focused, unassisted practice. |
| `controlled` | The learner can handle the target in focused practice. | `verifying` or `learning` | Verification is scheduled in a different context; a focused-practice failure returns the target to learning. |
| `verifying` | The system is collecting varied and delayed evidence. | `monitoring` or `learning` | Satisfying the complete mastery rule records a mastery event and begins monitoring; a confirmed failure returns the target to learning. |
| `monitoring` | A mastery event exists and the target is sampled occasionally without dominating daily practice. | `monitoring` or `learning` | Successful probes retain monitoring status. A meaningful recurrence records a reopened event, reviews the root-cause diagnosis, and returns the target to learning. |

Every transition must retain its timestamp, triggering evidence, confidence, and reason. A transition never erases earlier evidence or learner disputes.

### 6.2 Correction reliability

The AI must not automatically treat every proposed correction as fact.

Each correction that could alter the curriculum must include:

- The relevant transcript or learner response
- The proposed correction
- A concise explanation
- Supporting reference material when applicable
- A confidence indicator

Low-confidence judgments remain candidates until confirmed. The learner can dispute a correction. Disputed corrections do not alter the curriculum unless later evidence validates them.

### 6.3 Feedback load

The system may retain all credible observations internally, but each session review teaches only the two or three highest-value patterns.

It must distinguish among:

- Accidental slips
- Recurring knowledge gaps
- Several surface errors sharing one root cause
- Stylistic alternatives rather than actual errors

### 6.4 Mastery rule

A weakness is not mastered after one correct answer.

Mastery requires correct, unassisted use on at least three separate occasions across different contexts, including:

- At least one delayed check
- At least one spontaneous speaking or writing task

Mastered items continue to receive occasional monitoring probes. A meaningful recurrence reopens the item and triggers a new root-cause review.

Satisfying the rule records a mastery event and moves the weakness from `verifying` to `monitoring`. The product does not claim that a mistake can never recur. It verifies durable performance and detects relapse.

For this rule:

- **Unassisted** means the learner received no answer, correction, targeted hint, or immediate imitation prompt for that response.
- **Separate occasions** means separate sessions; repeated answers inside one drill count as one occasion.
- **Different contexts** must vary the communicative task or topic rather than merely substituting vocabulary in the same prompt.
- **Delayed check** means a later scheduled session, not a retry during the session that taught the target. The minimum delay is selected and recorded during Phase 0 model-and-learning calibration.
- **Meaningful recurrence** means a confirmed instance of the same root cause in later unassisted production. One low-confidence observation or likely transcription failure cannot reopen mastery.
- Evidence collected before the weakness was confirmed may explain the diagnosis but cannot satisfy post-instruction mastery requirements.

## 7. Session Design

### 7.1 Daily 15-minute session

The 15-minute mode is a legitimate learning path, not streak filler. It contains:

1. One focused input activity
2. One production task
3. Targeted review or verification

### 7.2 Extended 45-minute session

The extended mode adds depth, varied contexts, and a longer structured conversation. It should reuse the same learning state rather than behave like a separate course.

### 7.3 Weekly and monthly checks

- Active weaknesses receive a short weekly verification session.
- A broader four-skill benchmark occurs every four weeks.
- Monthly results are compared with prior evidence and update the competency map and following month's emphasis.

### 7.4 Conversation structure

Structured, scenario-based AI conversations are the central speaking activity. Each includes:

1. A communicative goal
2. Brief language preparation
3. Real-time interaction
4. Focused post-conversation feedback
5. Remediation or future review assignments

Open-ended conversation is supplementary.

Corrections normally wait until the conversation ends. The application intervenes during conversation only when communication breaks down or the learner explicitly requests help.

## 8. Explanation Language and References

- Explanations default to Spanish.
- English clarification is available instantly when the explanation itself causes confusion.
- Grammar terminology may be displayed in both languages.
- Examples and corrective practice remain in Spanish.

Explanations that affect the weakness ledger must be grounded in a curated local reference library. They must distinguish Mexican usage from broader or regional usage and label uncertainty rather than presenting an unverified interpretation as fact.

Reference sources and model outputs must be traceable. Content licensing must be checked before sources are bundled or redistributed.

## 9. Listening Content

Listening practice combines:

- Authentic Mexican podcasts, interviews, news, and video
- Locally generated material designed to isolate a weakness or control difficulty

The balance shifts toward authentic material as the learner approaches C1.

The application may access the public internet for authentic media and approved model or reference updates. It may download media only when licensing permits. Otherwise, it stores the source link and the learner's local notes.

No personal learning data is uploaded while fetching public content.

## 10. Progress Experience

The primary dashboard is evidence-based and displays:

- The C1 competency map
- Competencies as `untested`, `developing`, `demonstrated`, `verified`, or `regressed`
- Active weaknesses and their remediation state
- Mastery and reopened events without treating them as ledger states
- Evidence supporting progress claims
- Upcoming verification checks

Competency states summarize broad capabilities. Weakness-ledger states track specific diagnosed problems. A competency can improve while one related weakness remains active, and a weakness can affect more than one competency; neither state system overwrites the other.

Streaks may encourage consistency but never substitute for demonstrated improvement.

## 11. Platform and Hosting Constraints

### 11.1 Client

- Responsive progressive web application
- Installable on desktop and mobile devices
- Microphone capture and audio playback
- Same learning state and session history on every device

Separate native applications are out of scope until browser limitations are proven to impair the learning experience.

### 11.2 Initial host

- Personal computer on the same private network as the client devices
- Planned hardware: 32 GB RAM and NVIDIA RTX 5070 Ti
- Exact GPU memory, model compatibility, latency, and sustained performance remain to be verified after setup
- Full phone functionality initially depends on the host computer being powered on

### 11.3 Service constraints

- No paid APIs
- No paid hosted AI or speech services
- Language-model inference, transcription, speech generation, assessment, and data storage run locally
- Local components must be replaceable so future hosting changes do not require redesigning the learning model
- Version one does not expose the application directly to the public internet
- Secure remote access is deferred

The client must reach the local host. Public internet access is optional for authentic media and approved updates; it is not the persistence layer for personal data.

### 11.4 Network boundary

Allowed network flows are:

- Authenticated client-to-host traffic on the private network
- Learner-initiated retrieval of authentic public content
- Learner-approved model and reference updates

Public requests must not contain transcripts, recordings, weakness data, progress, prompts derived from learner performance, or personal identifiers beyond unavoidable network metadata such as the public IP address and client protocol information. AI inference and speech processing never use a public endpoint. Public access is deny-by-default when the requested destination or purpose is not recognized.

## 12. Authentication and Transport

Private-network placement does not remove the authentication requirement.

- One private learner account
- Passkey or strong-password authentication, subject to browser support validation
- Encrypted client-to-host connections
- No anonymous access from shared Wi-Fi
- No direct public exposure in version one
- Credentials must be stored using an appropriate one-way password hash or platform-backed credential mechanism

## 13. Local Data and Portability

All persistent learning data and locally managed assets remain offline in one visible, user-chosen, game-style folder: the portable data root. Hidden system locations such as `AppData` are not the primary data store.

A conceptual layout is:

```text
SPA C1/
  data/          Learning state and configuration
  references/    Curated local language references
  models/        Locally installed models
  recordings/    Only recordings explicitly saved by the learner
  exports/       Portable learner exports
  backups/       Automatic versioned snapshots
```

Final names may change, but the portability contract may not: moving or restoring the folder must preserve the learner's state.

Portability applies to learning state, configuration, locally managed references and models, selected recordings, exports, and backups. Application binaries and operating-system runtimes may be reinstalled outside the folder. Device-bound private keys are never copied into it. Moving to a new host may require reinstalling the runtime, re-establishing local certificate trust, and re-enrolling a device, but it must not require reconstructing learning history or curriculum state.

### 13.1 Audio retention

- Raw audio is transient by default and deleted after processing.
- Transcripts, feedback, scores, and extracted learning targets may persist.
- A recording persists only when the learner deliberately saves it for later comparison.

### 13.2 Recovery

- Create automatic versioned snapshots inside the portable folder.
- Support an optional encrypted offline mirror to a separate drive.
- Internal snapshots protect against application or data corruption.
- Only a separate physical drive protects against host-drive failure.
- Recovery must be testable without the original installation.

## 14. First Usable Version

The first version validates one complete learning loop rather than attempting the whole curriculum.

### Included

- Private local host and responsive web client
- Desktop and phone access on the same network
- Authentication and encrypted transport
- One meaningful 15-minute speaking/listening session
- Structured local-AI conversation
- Local transcription and speech playback
- Post-session transcript and two or three focused corrections
- Confidence-aware correction review and dispute control
- Weakness ledger
- Targeted remediation activity
- Delayed retest
- Portable local persistence and automatic snapshot

### Deferred

- Full four-skill entrance diagnostic
- Complete reading and writing tracks
- Full C1 competency curriculum
- Four-week DELE-aligned benchmarks
- Broad authentic-media ingestion
- Extended 45-minute session library
- Native applications
- Secure use away from the private network
- Multiple learners, subscriptions, social features, and moderation
- Paid or hosted AI services

Deferred capabilities remain product requirements unless explicitly removed; they are not required to validate the first vertical slice.

## 15. First-Version Acceptance Criteria

The first version is successful only when every criterion below has its required evidence.

| ID | Release-blocking requirement | Required evidence |
|---|---|---|
| AC-01 | The learner must sign in from one target computer browser and one target phone browser on the same private network. | Successful end-to-end sign-in on both named devices plus a failed unauthenticated-access check. |
| AC-02 | Both devices must read and update the same host-owned learning state. | A change made on each device appears on the other after synchronization, with no conflicting duplicate record. |
| AC-03 | The learner must complete a coherent 15-minute structured speaking/listening session. | Timed end-to-end session containing the required input, production, and review stages. |
| AC-04 | The conversation must remain uninterrupted unless communication fails or help is requested. | Scenario test covering normal flow, explicit help, and communication-breakdown intervention. |
| AC-05 | Raw audio must be deleted after processing unless deliberately saved. | Storage inspection after both an ordinary session and an explicitly saved-recording session. |
| AC-06 | A session review must display no more than three prioritized correction patterns. | Review test with at least five credible observations and a recorded prioritization result. |
| AC-07 | A low-confidence correction must not enter the confirmed weakness ledger automatically. | Boundary test on both sides of the configured confidence rule. |
| AC-08 | The learner must be able to dispute a correction without losing its original evidence. | Dispute-flow test confirming preserved transcript, proposal, rationale, confidence, and dispute status. |
| AC-09 | A confirmed weakness must produce an explanation, focused practice, varied application, and a scheduled delayed retest. | Lifecycle test showing each artifact and transition for one weakness. |
| AC-10 | One successful response must never be sufficient to record a mastery event. | State-transition test proving the weakness remains in `verifying` after a single success. |
| AC-11 | A meaningful recurrence must record a reopened event and return a monitored weakness to `learning` without erasing history. | Recurrence test showing the prior evidence, mastery event, new evidence, reopened event, and current `learning` state. |
| AC-12 | Restarting the host and client must preserve all committed learning state in the portable folder. | Restart test followed by record-by-record state comparison. |
| AC-13 | A versioned snapshot must restore the learning state into a clean test installation. | Documented restore drill using only the portable folder and selected snapshot. |
| AC-14 | No first-version workflow may invoke a paid service or upload personal learning data. | Configuration review plus controlled runtime network inspection for every first-version workflow. |
| AC-15 | Conversation and review latency must remain within thresholds established before Phase 1 begins. | Repeated benchmark on the intended host and both target clients, reporting median and worst observed timings against the approved thresholds. |
| AC-16 | Corrective explanations must default to Spanish and provide immediate English clarification when requested. | Interaction test confirming the default language, explicit clarification control, and unchanged Spanish examples/practice. |
| AC-17 | The first-version voice, examples, and recommended learner production must use the accepted Mexican Spanish conventions. | Reviewed sample session covering voice, vocabulary, idiom, and pronunciation guidance against the accepted seed references. |
| AC-18 | Every correction that can confirm a weakness must show supporting local reference evidence or an explicit uncertainty label. | Correction-review test covering supported, conflicting, and unsupported claims. |

### 15.1 Future Validation Placeholders

These IDs reserve validation responsibilities for deferred product requirements. Each must be expanded into detailed acceptance criteria before its delivery phase begins.

| ID | Deferred validation responsibility | Required before |
|---|---|---|
| VAL-01 | Demonstrate the graduation benchmarks repeatedly across all four skills using authoritative CEFR/DELE-aligned evidence. | Phase 3 completion |
| VAL-02 | Demonstrate four-skill curriculum coverage and the intended listening/speaking emphasis without excluding any required competency. | Phase 2 completion |
| VAL-03 | Validate that the entrance diagnostic distinguishes demonstrated strengths and gaps and produces a reviewable initial curriculum. | Phase 2 completion |
| VAL-04 | Demonstrate a coherent 45-minute session that shares learning state with 15-minute sessions. | Phase 2 completion |
| VAL-05 | Validate Mexican-language coverage, broader accent exposure, source traceability, and media/reference licensing. | Phase 3 completion |
| VAL-06 | Demonstrate that every required competency is visible, evidence-backed, and protected from adaptive-selection blind spots. | Phase 2 completion |
| VAL-07 | Verify that difficulty adaptation and learner override controls change future selection without rewriting performance history. | Phase 2 completion |
| VAL-08 | Demonstrate weekly weakness verification and four-week integrated benchmarks updating the next learning period. | Phase 3 completion |

## 16. Delivery Phases

### Phase 0: Technical experiments

Execution procedures and evidence templates are defined in `PHASE-0-PLAN.md`.

Phase 0 uses disposable prototypes to resolve the following gates. Its measurements and decisions become inputs to the technical specification; they are not buried in implementation notes.

| Gate | Decision to resolve | Required evidence | Exit condition |
|---|---|---|---|
| EXP-01 Host capability | Which model sizes and combinations can the intended host run together? | Exact GPU memory and driver/runtime inventory, load measurements, and a sustained session test. | A supported resource envelope is recorded, including combinations that must not run concurrently. |
| EXP-02 Speech recognition | Which local model best transcribes the learner and Mexican Spanish without turning recognition errors into language errors? | Side-by-side results on scripted and spontaneous samples from the learner plus representative Mexican speech; uncertain segments must remain identifiable. | One model and confidence-handling policy are selected, or speech assessment is declared blocked. |
| EXP-03 Speech generation | Which local voice is intelligible, natural enough for sustained practice, and appropriate for Mexican Spanish? | Blind listening comparison plus timing on short prompts and conversation turns. | One voice is accepted for the vertical slice and its known pronunciation limitations are recorded. |
| EXP-04 Conversation performance | What interaction timing preserves conversational flow? | Repeated end-to-end turn timings and post-session review timings on the intended host and target clients. | Median and worst-case thresholds are approved and copied into AC-15 before Phase 1 acceptance testing. |
| EXP-05 Correction reliability | Can the local stack separate learner errors, transcription errors, valid regional forms, and stylistic alternatives? | Blind evaluation against a small human-reviewed test set grounded in the seed reference library. | A confidence policy is selected; any known high-confidence false correction blocks automatic ledger confirmation. |
| EXP-06 Browser audio | Do microphone capture, playback, interruption, and PWA installation work on the actual desktop and phone browsers? | Named-device matrix covering permissions, recording, playback, background/lock behavior, and interrupted sessions. | Supported browsers and limitations are recorded; a material blocker triggers a native-wrapper decision rather than a silent workaround. |
| EXP-07 Private-network security | Which authentication and encrypted-transport approach works without public exposure? | Successful authorized access and failed anonymous-access checks from both target devices, including restart/recovery behavior. | One approach is selected and its setup steps are reproducible on the private network. |
| EXP-08 Portable persistence | Can the entire learning state move, snapshot, restore, and delete transient audio as specified? | Clean-install restore drill, state comparison, interrupted-write test, and ordinary-versus-saved audio inspection. | The portability and recovery contract passes without dependence on hidden system data. |
| EXP-09 Reference foundation | Which sources can ground corrections accurately and legally? | Source authority, Mexican-usage coverage, local search quality, citation traceability, and license review. | A licensed seed set is accepted and unsupported language claims remain explicitly uncertain. |

Phase 1 may begin only after EXP-01 through EXP-09 have a recorded result. A blocked gate must be resolved, or the affected capability must be explicitly removed from the first-version scope before implementation continues.

### Phase 1: Weakness-loop vertical slice

Build and validate the complete first usable version described above.

### Phase 2: Personalized B2-to-C1 program

- Add the four-skill adaptive diagnostic.
- Build the C1 competency map.
- Add reading and writing.
- Expand the remediation activity library.
- Add the 45-minute session mode.

### Phase 3: Durable C1 verification

- Add authentic-media workflows.
- Add weekly verification sessions.
- Add four-week integrated benchmarks.
- Add longitudinal progress and relapse analysis.
- Validate DELE alignment against authoritative rubrics.

### Phase 4: Optional reach improvements

- Evaluate secure remote access.
- Evaluate native wrappers only if PWA limitations are material.
- Revisit hosting only if the local-host requirement becomes a real constraint.

## 17. Technical Decisions Requiring Evidence

The following are intentionally not selected in this product specification:

- Local language model
- Speech-to-text model
- Text-to-speech model and Mexican voice
- Pronunciation-analysis approach
- Application framework
- Local database or file format
- Authentication implementation
- Local HTTPS and certificate strategy
- Exact CEFR/DELE reference corpus

Each choice must follow a focused experiment against the product requirements. Model popularity alone is not acceptance evidence.

## 18. Principal Risks

| Risk | Failure mode | Mitigating requirements | Required mitigation | Verification |
|---|---|---|---|---|
| RSK-01 | A local model confidently teaches an incorrect correction. | REQ-WKN-02, REQ-WKN-04, REQ-REF-01 | Reference grounding, confidence policy, preserved evidence, and learner dispute controls. | EXP-05, EXP-09, AC-07, AC-08, AC-18 |
| RSK-02 | Speech-recognition failure is misclassified as a learner error. | REQ-WKN-02, REQ-LNG-01 | Recognition uncertainty must remain distinct from language-analysis confidence and cannot independently confirm a weakness. | EXP-02, EXP-05, AC-07 |
| RSK-03 | Browser audio differs materially across desktop, Android, or iOS. | REQ-PLT-01 | Test named target devices before choosing the final client boundary. | EXP-06, AC-03, AC-04 |
| RSK-04 | Local-model latency disrupts conversational flow. | REQ-LRN-05, REQ-HST-01 | Establish an approved host resource envelope and interaction thresholds before Phase 1. | EXP-01, EXP-04, AC-15 |
| RSK-05 | Reference or media licensing prevents local bundling. | REQ-REF-01, REQ-CNT-01, REQ-NET-01 | Record authority, license, allowed use, and retrieval method for every bundled source. | EXP-09, VAL-05 |
| RSK-06 | One-host availability or network configuration makes mobile practice unavailable. | REQ-PLT-01, REQ-HST-01, REQ-SEC-01 | Make host dependency visible, reproduce private-network setup, and keep remote access deferred rather than implicit. | EXP-07, AC-01, AC-02 |
| RSK-07 | Corruption or drive failure destroys learning history. | REQ-DAT-01, REQ-DAT-02, REQ-DAT-03 | Atomic persistence, versioned snapshots, restore drills, and an optional separate-drive mirror. | EXP-08, AC-05, AC-12, AC-13 |
| RSK-08 | Excessive correction harms fluency or motivation. | REQ-LRN-03, REQ-LRN-05, REQ-WKN-03, REQ-PRI-01 | Preserve conversation flow and teach no more than three prioritized patterns per review. | AC-04, AC-06, AC-16 |
| RSK-09 | Adaptive selection creates hidden curriculum gaps. | REQ-OUT-01, REQ-LRN-01, REQ-LRN-02, REQ-LNG-02, REQ-PRG-01, REQ-ADP-01, REQ-ASM-01 | Keep adaptive selection subordinate to the complete competency map and periodic integrated benchmarks. | VAL-02, VAL-03, VAL-06, VAL-07, VAL-08 |

## 19. Non-Goals for Version One

- A public language-learning platform
- Support for multiple users
- Competitive leaderboards or social networking
- Subscriptions or monetization
- Full replacement for human interaction with Spanish speakers
- Perfect accent imitation
- A guarantee that a mastered mistake can never recur
- Public internet deployment
- Feature parity with native mobile applications

## 20. Product Definition of Done

The product is complete when the graduation benchmarks are repeatedly demonstrated across all four skills, all required C1 competencies have evidence, active high-impact weaknesses have been remediated or explicitly accepted, and monthly verification no longer exposes systematic B2-level gaps.

The first usable version is complete only when its acceptance criteria pass on both the target computer and a target mobile phone using the intended local host.
