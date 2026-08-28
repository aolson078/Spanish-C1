# UI and Visual Improvement Playbook

## Purpose

This document defines how to improve the Spanish C1 interface iteratively without destabilizing the learning system. Each iteration should solve one observable usability or visual-hierarchy problem, preserve existing behavior, and leave evidence that the change was actually better.

This is not a mandate for a wholesale redesign. The application should evolve through small, reversible, independently verifiable improvements.

## Start here

For each visual change:

1. [Choose one evidenced learner problem](#how-to-choose-the-next-iteration).
2. [Capture a controlled baseline and define acceptance](#the-iteration-loop).
3. [Implement the smallest reversible experiment](#5-produce-the-smallest-useful-variant).
4. [Run the checks required for that change type](#7-validate-in-layers).
5. [Record the immediate decision and real-use outcome](#8-compare-and-decide).

Use the [change-packet template](#change-packet-template) to carry one iteration through the full loop. The [recommended first change packet](#recommended-first-change-packet) is the practical starting point for the current application.

## Product experience to protect

The interface should feel:

- focused enough for a daily learning habit;
- calm and encouraging without becoming playful or childish;
- transparent about what the AI knows, proposes, and cannot verify;
- precise enough to support detailed weakness repair;
- private and local rather than cloud-service-like;
- primarily Mexican in character without relying on stereotypes;
- usable with keyboard, mouse, and narrow screens;
- visually quiet during production and more analytical during review.

The learner's attention is the scarce resource. The current task, response field, correction, and next decision should always have greater visual priority than diagnostics, settings, implementation details, or historical metadata.

## Current visual baseline

The current interface already establishes a useful identity in `apps/web/src/styles.css`:

- **Warm parchment canvas** (`#f2efe5`) creates a low-glare study environment.
- **Soft ivory surfaces** (`#fffdf6`) separate working areas without stark white panels.
- **Deep study green** (`#176451`) identifies primary actions and successful/local-ready states.
- **Dark forest text** (`#183e36`) gives headings and corrected Spanish a distinctive voice.
- **Amber focus accent** (`#f4ac45`) makes keyboard focus visible and highlights selection rationale.
- **Warm neutral borders** (`#d4cfbf`) define cards without heavy contrast.
- **Georgia serif prompts** distinguish language content from application controls.
- **System sans-serif controls** keep operational text legible and familiar on Windows.
- **Generously rounded cards** and **pill-shaped actions** make the application approachable.
- **Soft, diffuse elevation** separates major sections while keeping the interface calm.

These are the starting design tokens, not permanent restrictions. Change them only in a dedicated visual-system iteration with side-by-side evidence.

## Non-negotiable design constraints

Every UI iteration must preserve:

1. AI output remains visibly labeled as a proposal or model judgment.
2. Model confidence never looks like verified proficiency.
3. Learner disagreement, uncertainty, and deferral remain first-class actions.
4. Weakness evidence and control history remain inspectable.
5. Keyboard focus remains obvious.
6. Native semantic elements, labels, headings, and live-region behavior remain intact.
7. Error, offline, loading, empty, and completed states remain understandable without color alone.
8. Learning data and Ollama endpoint details are not exposed unnecessarily.
9. Visual work does not change domain rules, assessment meaning, persistence, or AI contracts.
10. No new UI dependency, font download, icon library, analytics, or hosted asset is added without approval.

Audio and phone/PWA functionality are currently deferred. Visual work may preserve responsive boundaries, but it should not introduce phone networking, synchronization, installation, or audio controls prematurely.

## How to choose the next iteration

The roadmap below is an initial sequence of hypotheses, not a commitment to redesign every area in that order. After the first information-architecture pass, observed learner friction should determine the next change.

Maintain the single UI backlog at `docs/ui-backlog.md`. Add an item only when it is supported by at least one of these signals:

- a pause, misread, backtrack, or missed action during a real learning session;
- the same concept appearing differently in two parts of the interface;
- a keyboard, zoom, contrast, overflow, or responsive failure;
- an important loading, empty, error, recovery, or completion state that is unclear;
- a mismatch between the interface and the product experience or trust constraints above.

Describe each candidate using this minimum record:

| Field | Required content |
| --- | --- |
| Observation | What happened, on which screen and state |
| Learner consequence | Delay, confusion, error, loss of trust, or inaccessible action |
| Evidence | Session note, safe screenshot, repeated pattern, or failed check |
| Frequency | Once, occasional, or repeated |
| Severity | Cosmetic, inconvenient, task-blocking, or trust/accessibility risk |
| Smallest experiment | The narrowest change that could test the hypothesis |

Give each item one status: `candidate`, `selected`, `trial`, `retained`, `revise`, or `reverted`. Select only one item at a time. When its status changes, link its decision record; do not erase rejected or reverted observations. Merge duplicate observations into the existing item and increase its frequency rather than creating parallel entries.

Choose the next item in this order:

1. trust, accessibility, data-safety, or task-blocking problems;
2. repeated friction in the 15-minute session;
3. repeated friction in weakness review and assessments;
4. cross-screen inconsistency that increases cognitive load;
5. visual polish with a specific, testable benefit.

When two items have similar impact, choose the smaller reversible experiment. Do not prioritize an item merely because it is visually conspicuous or technically interesting.

## Recommended iteration order

Treat each numbered iteration as its own accept/revise/revert decision. Do not begin the next one until the current change has been evaluated against its acceptance criteria.

### Iteration 1: Information architecture and task focus

The current application presents diagnostics, dashboard, settings, assessment, daily session, and open practice in one long page. The first improvement should reduce this competition for attention.

Explore a desktop shell with three clear destinations:

- **Today:** current session, due work, and one primary next action.
- **Progress:** weaknesses, evidence timelines, assessment reports, and trends.
- **Settings:** local AI diagnostics, data-root information, and future recovery controls.

Keep the active task state visible after restart. Avoid hiding an in-progress session behind a generic landing screen.

Success signals:

- a learner can identify the recommended next action within five seconds;
- only one primary action dominates a screen;
- settings and diagnostics no longer visually compete with practice;
- all current functions remain reachable by keyboard.

Measure the five-second signal from the moment the usable screen appears until the learner first selects the recommended action. Record elapsed seconds, success/failure, and any pause, wrong selection, or backtrack; do not estimate afterward from memory.

### Iteration 2: Semantic tokens and component consistency

Move repeated visual values into a small set of CSS custom properties before changing the palette broadly.

Suggested semantic groups:

```css
:root {
  --color-canvas: #f2efe5;
  --color-surface: #fffdf6;
  --color-surface-muted: #f8f5eb;
  --color-primary: #176451;
  --color-primary-strong: #183e36;
  --color-accent: #f4ac45;
  --color-border: #d4cfbf;
  --color-text: #202019;
  --color-text-muted: #6f6b60;
  --color-danger: #8e2222;
}
```

Add spacing, corner, shadow, and typography tokens only when at least three existing uses benefit. Do not introduce a design-system framework.

Standardize:

- primary, secondary, quiet, and destructive buttons;
- default, selected, paused, due, warning, and disabled states;
- cards, inset panels, forms, badges, notices, and errors;
- heading levels and section spacing;
- loading language and progress indicators.

### Iteration 3: Daily-session workspace

Make the 15-minute session the strongest focused workflow.

Potential improvements:

- show a simple phase path without suggesting false precision about elapsed time;
- keep the current prompt and response together in one uninterrupted workspace;
- collapse difficulty details by default while keeping them inspectable;
- make the learner-review decision the obvious next step after an AI proposal;
- visually separate learner text, AI proposal, deterministic evidence, and learner decision;
- preserve the response area and scroll position during transitions where practical.

Avoid gamified streak pressure, countdown timers, or red failure states unless later user testing demonstrates a real need.

### Iteration 4: Weakness dashboard and evidence

Improve scanning before adding more metrics.

Potential improvements:

- use plain-language weakness names above technical keys;
- group active, due, paused, and provisionally improved items;
- show severity, communicative impact, recurrence, and evidence as a consistent compact summary;
- make the selected weakness unmistakable;
- turn the evidence timeline into a readable sequence of detection, repair, transfer, and delayed verification;
- keep confidence visually subordinate to evidence quality and validation source.

Charts should be introduced only when they communicate a trend more clearly than a short list or timeline. Never chart model confidence as if it were proficiency.

### Iteration 5: Baseline and checkpoint reports

Make assessment results useful without turning them into a grade.

Potential improvements:

- lead with a short narrative summary of demonstrated strengths, next priorities, and uncertainty;
- group skill dimensions by stronger, mixed, limited, and not-assessable evidence;
- translate internal identifiers into human-readable labels while retaining technical detail on demand;
- display baseline-to-checkpoint changes as evidence-band movement, not a percentage score;
- clearly distinguish text-only assessment evidence from spoken practice evidence gathered through desktop audio;
- keep prompt evidence and specific model uncertainty one interaction away.

### Iteration 6: Responsive behavior, polish, and motion

Only after the core hierarchy is stable:

- verify Electron at its supported 760 px minimum width and test approximately 390 px separately through `npm.cmd run dev:web` in browser responsive mode; this checks layout resilience, not phone/PWA readiness;
- ensure touch targets are at least approximately 44 by 44 CSS pixels;
- prevent long Spanish responses, identifiers, paths, and model errors from breaking layouts;
- add subtle motion only when it explains a state change;
- honor `prefers-reduced-motion`;
- test Windows display scaling at 100%, 125%, and 150%;
- review light-theme contrast before considering a dark theme.

## The iteration loop

Use this loop for every visual change.

### 1. Select one learner problem

Write the problem as an observable behavior, not a taste judgment.

Good:

> During a session, the learner has to scan past diagnostics and dashboard content to find the active prompt.

Weak:

> The page looks dated.

### 2. Capture the baseline

Record:

- the exact screen and state;
- window dimensions and Windows scaling;
- a screenshot with synthetic or non-sensitive data;
- keyboard path to the main action;
- the current confusion, delay, or inconsistency;
- any related automated accessibility or component tests.

Do not use screenshots containing private learner responses in design tools or external services.

For a valid visual comparison, baseline and candidate evidence must use the same:

- application state and synthetic content;
- window dimensions, zoom, and Windows display scaling;
- scroll position and expanded/collapsed controls;
- light/dark operating-system preference, when relevant.

If the state cannot be reproduced, label the comparison as observational rather than claiming a controlled improvement.

### 3. State a hypothesis

Use this format:

> If we change **X**, then **Y learner task** should become easier because **Z visual or interaction principle**.

Example:

> If the current session becomes the only primary card on Today, then resuming practice should become faster because operational diagnostics no longer compete in the same visual hierarchy.

### 4. Define acceptance before editing

Choose two to five criteria that can be checked directly.

Examples:

- the primary action is visible without scrolling at 1440 × 900;
- heading order remains logical;
- all actions are reachable and visible with keyboard only;
- no content overlaps at 390 px;
- offline and error states remain visible;
- existing workflow tests still pass;
- no domain or persistence file changes.

### 5. Produce the smallest useful variant

Prefer CSS and localized component composition before adding abstractions. Reuse native HTML and the existing React structure. One strong variant is usually more useful than several cosmetic variations without a clear hypothesis.

For a higher-impact change, a temporary feature branch or isolated prototype may compare two approaches. Do not maintain parallel production themes.

### 6. Exercise the state matrix

Check the affected screen in every relevant state:

| State | Examples |
| --- | --- |
| Loading | AI diagnostics pending, state restoration pending |
| Empty | No weaknesses, no assessment, no saved session |
| Ready | Recommended next action available |
| Active | Warm-up, production, repair, transfer, assessment prompt |
| Long content | Long Spanish response, long uncertainty, long data path |
| Dense history | Many weaknesses, due reviews, and evidence events |
| Warning | Model missing, incompatible rubric record |
| Error | Offline Ollama, malformed response, corrupt saved assessment |
| Completed | Saved daily session, completed baseline/checkpoint |
| Disabled | AI request in progress, unavailable action |

### 7. Validate in layers

Use the project commands below rather than inventing a separate UI toolchain:

| Change type | Minimum automated checks | Required manual evidence |
| --- | --- | --- |
| Copy or CSS only | `npm.cmd run typecheck`; `npm.cmd run build:web` | Controlled before/after comparison; keyboard focus; affected widths |
| React structure or semantics | Focused `npm.cmd test -- apps/web/src/App.test.tsx`; `npm.cmd run typecheck`; `npm.cmd run build:web` | Heading order; keyboard traversal; affected state matrix |
| Interaction or shared UI state | Focused component test; `npm.cmd test`; `npm.cmd run typecheck`; `npm.cmd run build` | Happy path, boundary/error path, keyboard traversal, visual comparison |
| AI proposal presentation | Relevant tests; `npm.cmd run typecheck`; `npm.cmd run build` | One local-model workflow; proposal/evidence/uncertainty distinction |
| Desktop shell or packaging | Relevant tests; `npm.cmd run typecheck`; `npm.cmd run build`; `npm.cmd run dist:win` when packaging changed | Portable app launch and representative scaling |

Run only the rows affected by the change, starting with the narrowest check. A CSS-only iteration does not justify unrelated full-suite work, while a changed interaction cannot be accepted from screenshots alone.

Manual validation should cover, as applicable:

1. keyboard-only traversal, including visible focus and logical order;
2. controlled Electron inspection at 1440 × 900, 1024 × 768, and its 760 px minimum width;
3. browser responsive-mode inspection at approximately 390 px through `npm.cmd run dev:web`, when narrow-layout behavior is affected;
4. Windows display scaling at the percentages named in the responsive iteration;
5. zoom, long Spanish content, and long local paths or model errors;
6. one real local-model workflow when the presentation of AI output changed.

Automated tests prove structure and behavior, not visual quality. Screenshots prove appearance, not accessibility or workflow correctness. Both forms of evidence are needed for meaningful visual changes.

### 8. Compare and decide

Evaluate the baseline and candidate against the same criteria. Record one decision:

- **Accept:** evidence supports the hypothesis.
- **Revise:** direction is useful but a named criterion failed.
- **Revert:** the change added complexity or did not solve the learner problem.

Avoid accepting a redesign solely because it is newer or more polished.

An **Accept** decision means the candidate cleared its defined checks and is ready for a real-use trial. It does not prove the change is permanently better. After at least three representative learning sessions—or sooner if a blocking problem appears—confirm one outcome:

- **Retain:** the original friction is reduced and no equal-or-worse problem appeared;
- **Revise:** the hypothesis still appears sound, but a specific problem remains;
- **Revert:** real use does not support the hypothesis.

This delayed decision prevents a polished screenshot from outranking actual learning use.

### 9. Record the result

For every attempted iteration, including revised and reverted ones, retain:

- problem and hypothesis;
- affected screen/state;
- source baseline, such as the starting commit or an explicit pre-change file inventory when the project is untracked;
- before/after screenshots using safe data when a candidate was rendered;
- files changed;
- checks run;
- decision and reason;
- exact revert procedure for the files introduced or changed by the iteration;
- known gaps;
- follow-up ideas deliberately left out of scope.

Create a decision record for every attempt under `docs/ui-iterations/<YYYY-MM-DD>-<short-name>/`, even if the candidate is abandoned before rendering. Use a short `README.md` as the record and keep any screenshots in the same folder. Mark screenshots `not captured` when no candidate was rendered. Reverted variants should be removed from production code, but their decision record should state what failed so the same direction is not repeated without new evidence.

## Readiness and completion gates

### Ready to implement

- one learner problem is supported by evidence;
- the hypothesis names the expected learner benefit;
- in-scope and out-of-scope changes are explicit;
- acceptance criteria and affected states are listed;
- the smallest reversible experiment is understood;
- required behavior, persistence, AI, and privacy boundaries remain unchanged or are separately authorized.

### Ready for a real-use trial

- acceptance criteria passed;
- the applicable automated and manual checks were recorded;
- controlled before/after evidence exists where appearance changed;
- no trust, accessibility, data-safety, or task-blocking regression remains;
- the candidate can be reverted cleanly.

### Complete

- the real-use outcome is recorded as retain, revise, or revert;
- any new friction is added to the backlog with evidence;
- accepted patterns are reflected consistently in the affected interface;
- speculative follow-ups remain out of scope until they earn priority.

## Evaluation scorecard

Use a simple 1–5 score only to compare UI variants, never learner ability.

| Dimension | Question |
| --- | --- |
| Task focus | Is the next learner action immediately clear? |
| Hierarchy | Does visual weight match functional importance? |
| Cognitive load | Is secondary information quiet but discoverable? |
| Trust clarity | Are AI proposal, evidence, confidence, and uncertainty distinct? |
| Consistency | Do equivalent states and actions look equivalent? |
| Readability | Are Spanish text, metadata, paths, and errors easy to read? |
| Accessibility | Does it work with keyboard, zoom, contrast needs, and reduced motion? |
| Responsiveness | Does it remain coherent at supported widths and Windows scaling? |
| Emotional tone | Does it feel calm, serious, encouraging, and private? |

Any accessibility or trust-clarity regression blocks acceptance regardless of the average score.

The scorecard supports judgment; it does not replace the iteration's direct acceptance criteria. Do not average the scores into a single quality number that can hide a severe weakness.

## Suggested usability sessions

After a coherent iteration, perform a short real-use session rather than only clicking through screens.

Recommended tasks:

1. Resume an interrupted 15-minute session.
2. Find why the next activity was selected.
3. Review and disagree with an AI correction.
4. Inspect the evidence behind one recurring weakness.
5. Complete one baseline or checkpoint prompt.
6. Explain what the assessment report claims and does not claim.
7. Recover from Ollama being unavailable.

Capture where the learner pauses, backtracks, misreads a label, misses an action, or cannot explain a metric. Those observations should drive the next iteration more than general preferences such as “make it modern.”

## Change-packet template

Use this when handing a visual iteration to another model or developer:

```markdown
# UI iteration: [short name]

## Learner problem
[Observable problem]

## Current state
[Screen, workflow phase, dimensions, and safe screenshot]

## Source baseline
[Starting commit, or explicit pre-change files and hashes when untracked]

## Hypothesis
If we [change], then [task] improves because [reason].

## In scope
- [one to three precise changes]

## Out of scope
- domain rules
- persistence and AI contracts
- unrelated screens

## Acceptance
- [directly checkable criterion]
- [directly checkable criterion]

## Required states
- loading
- empty
- active
- error
- completed

## Verification
- focused component test
- typecheck
- build
- keyboard traversal
- visual comparison

## Exact revert procedure
[Commands or bounded file changes that restore the source baseline]

## Trial follow-up
- sessions observed: [count]
- original friction: [reduced / unchanged / worse]
- new friction: [none or observation]
- decision: [retain / revise / revert]
```

## Recommended first change packet

Start with the information-architecture problem already visible in the current source: diagnostics, progress, settings, assessments, the daily session, and open practice all compete in one long page.

**Hypothesis:** If the app opens on a focused Today view with the active or recommended session as the only dominant action, resuming daily practice will require less scanning while Progress and Settings remain easy to reach.

**In scope:**

- introduce clear Today, Progress, and Settings destinations;
- place the resumable 15-minute session first on Today;
- move weakness history and assessment reports to Progress;
- move local-AI diagnostics and data-root information to Settings;
- preserve all current actions and state.

**Out of scope:**

- palette or typography redesign;
- new charts, animations, dependencies, persistence, or AI behavior;
- audio, mobile networking, PWA installation, and synchronization;
- component extraction beyond what the navigation change requires.

**Acceptance:**

- the resume/start-session action is visible without scrolling at 1440 × 900;
- only one primary action dominates Today;
- an in-progress session remains obvious after state restoration;
- all existing functions remain reachable with keyboard only;
- loading, no-session, active-session, completed-session, and Ollama-unavailable states remain understandable;
- the focused component test, typecheck, full deterministic suite, and production build pass.

Capture the current long-page baseline before implementation. Do not combine this experiment with the token-system iteration; separating hierarchy from restyling makes the result easier to evaluate and revert.

## File map

Current visual work is concentrated in:

- `apps/web/src/App.tsx` — page structure, state presentation, and interactions;
- `apps/web/src/styles.css` — palette, typography, layout, component appearance, and responsive rules;
- `apps/web/src/App.test.tsx` — component behavior and accessible control evidence;
- `apps/web/src/main.tsx` — renderer entry point;
- `apps/web/src/global.d.ts` — desktop bridge types, not a visual target;
- `apps/desktop/` — Electron shell and IPC, normally out of scope for visual iterations.

If the UI grows beyond one page, extract components by stable learner workflow—Today, Progress, Assessment, Settings—not by arbitrary card size or styling similarity.

## Completion rule

Use the [readiness and completion gates](#readiness-and-completion-gates) as the definition of done. An implementation that looks better but lacks its required evidence, rollback path, or real-use outcome remains in `trial` rather than `complete`.

The ideal UI will emerge from repeated real learning sessions and disciplined comparison, not from a single large redesign.
