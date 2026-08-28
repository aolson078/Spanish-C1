import { afterEach, describe, expect, it } from 'vitest';
import type { AiProvider } from '../../packages/ai-provider/src/contracts.js';
import { SpanishC1Repository } from '../../packages/persistence/src/repository.js';
import {
  createTestDataRoot,
  removeTestDataRoot,
} from '../../packages/persistence/test/test-root.js';
import { ApplicationService } from './application-service.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeTestDataRoot(root);
});

const provider: AiProvider = {
  getDiagnostics: async () => ({
    endpoint: 'http://127.0.0.1:11434',
    model: 'synthetic',
    contextLength: 4_096,
    providerVersion: 'test',
    modelAvailable: true,
  }),
  proposeCorrection: async () => ({
    correctedText: 'Si tuviera más tiempo, viajaría más.',
    issues: [
      {
        category: 'grammar.conditional.si_clause',
        span: 'tendría',
        replacement: 'tuviera',
        explanation: 'Use the imperfect subjunctive for a present hypothetical.',
        confidence: 0.94,
        referenceIds: ['conditional.present_hypothetical'],
      },
    ],
    mexicanSpanishNotes: [],
    uncertainties: [],
  }),
  evaluateAssessment: async (request) => ({
    skill: request.skill,
    judgment: 'mixed_evidence',
    confidence: 0.82,
    evidence: ['The response addresses the requested criterion.'],
    weaknesses: [{
      category: 'grammar.conditional.si_clause',
      explanation: 'Model-proposed conditional weakness.',
      confidence: 0.8,
      referenceIds: ['conditional.present_hypothetical'],
    }],
    mexicanSpanishNotes: [],
    uncertainties: ['Content accuracy requires learner review.'],
  }),
};

describe('desktop application persistence', () => {
  it('saves a model proposal as review-needed evidence and restores it after reopening', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const ids = ['session-id', 'evidence-id'];
    const firstRepository = new SpanishC1Repository(paths.database);
    const firstApplication = new ApplicationService(provider, firstRepository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => ids.shift() ?? 'unexpected-id',
    });

    const analysis = await firstApplication.analyzeProduction(
      'Si tendría más tiempo, viajaría más.',
    );
    expect(firstApplication.getState()).toMatchObject({
      activeDataRoot: paths.root,
      recentSessions: [
        {
          id: 'session-session-id',
          status: 'completed',
          summary: '1 correction proposal(s) awaiting learner review.',
        },
      ],
    });
    const weaknessId = analysis.weaknessIds[0];
    expect(weaknessId).toBeDefined();
    expect(firstRepository.getWeaknessRecord(weaknessId!)).toMatchObject({
      weakness: { state: 'suspected' },
      evidence: [
        {
          id: 'evidence-evidence-id',
          disposition: 'uncertain',
          validationSource: 'model_only',
          modelProposal: {
            correctedText: 'Si tuviera más tiempo, viajaría más.',
            promptVersion: 'correction.v1',
          },
          validatorResult: { status: 'needs_review' },
        },
      ],
    });
    firstRepository.close();

    using reopenedRepository = new SpanishC1Repository(paths.database);
    const reopenedApplication = new ApplicationService(provider, reopenedRepository, paths.root);
    expect(reopenedApplication.getState().recentSessions[0]?.id).toBe('session-session-id');
    expect(reopenedRepository.getWeaknessRecord(weaknessId!)?.evidence[0]?.modelProposal).toMatchObject({
      issueCategory: 'grammar.conditional.si_clause',
      explanation: 'Use the imperfect subjunctive for a present hypothetical.',
    });
  });

  it('rolls back the session and all weaknesses when any evidence write fails', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    const twoIssueProvider: AiProvider = {
      ...provider,
      proposeCorrection: async () => ({
        correctedText: 'Texto corregido.',
        issues: [
          {
            category: 'grammar.conditional.si_clause',
            span: 'error uno',
            replacement: 'corrección uno',
            explanation: 'Primera propuesta.',
            confidence: 0.9,
            referenceIds: ['conditional.present_hypothetical'],
          },
          {
            category: 'lexicon.precision',
            span: 'error dos',
            replacement: 'corrección dos',
            explanation: 'Segunda propuesta.',
            confidence: 0.8,
            referenceIds: [],
          },
        ],
        mexicanSpanishNotes: [],
        uncertainties: [],
      }),
    };
    const ids = ['session-id', 'duplicate-evidence', 'duplicate-evidence'];
    const application = new ApplicationService(twoIssueProvider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => ids.shift() ?? 'unexpected-id',
    });

    await expect(application.analyzeProduction('Texto con dos problemas.')).rejects.toThrow(
      /UNIQUE constraint failed/,
    );
    expect(application.getState().recentSessions).toEqual([]);
    expect(repository.exportSnapshot()).toMatchObject({
      weaknesses: [],
      evidence_events: [],
    });
    repository.close();
  });

  it('completes the 15-minute text loop and schedules delayed review', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `id-${++id}`,
    });

    const warmup = application.startFifteenMinuteSession();
    expect(warmup).toMatchObject({ phase: 'warmup', selectionReason: 'diagnostic' });
    expect(application.advanceWarmup(warmup.sessionId).phase).toBe('production');

    const repair = await application.submitSessionProduction(
      warmup.sessionId,
      'Si tendría más tiempo, viajaría más.',
    );
    expect(repair).toMatchObject({ phase: 'repair', weaknessIds: [expect.any(String)] });
    expect(application.reviewCorrection(warmup.sessionId, 'agree')).toMatchObject({
      phase: 'targeted_practice',
      learnerDecision: 'agree',
    });
    expect(await application.submitTargetedPractice(warmup.sessionId, 'Si tuviera tiempo, estudiaría.')).toMatchObject({
      phase: 'transfer',
      difficulty: { grammaticalHints: 2 },
      difficultyReason: 'Increased grammatical hints to add support.',
    });
    const summary = await application.submitTransfer(warmup.sessionId, 'Si tuviera una semana libre, visitaría Oaxaca.');
    expect(summary).toMatchObject({
      phase: 'summary',
      prompt: expect.stringContaining('72 horas'),
      difficulty: { grammaticalHints: 3 },
    });
    expect(repository.getSetting('difficultyState')).toMatchObject({ grammaticalHints: 3 });

    const snapshot = repository.exportSnapshot();
    expect(snapshot.reviews).toHaveLength(1);
    expect(snapshot.reviews[0]).toMatchObject({ due_at: '2026-08-27T12:00:00.000Z' });
    expect(snapshot.evidence_events).toHaveLength(4);
    expect(snapshot.evidence_events.map((event) => event.purpose)).toEqual([
      'detection',
      'detection',
      'remediation',
      'transfer',
    ]);

    expect(application.completeFifteenMinuteSession(warmup.sessionId).phase).toBe('completed');
    expect(application.getState().activeSession).toBeUndefined();
    expect(repository.getSession(warmup.sessionId)).toMatchObject({ status: 'completed' });
  });

  it('restores an in-progress 15-minute session after reopening the database', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const firstRepository = new SpanishC1Repository(paths.database);
    let id = 0;
    const firstApplication = new ApplicationService(provider, firstRepository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `restart-${++id}`,
    });
    const session = firstApplication.startFifteenMinuteSession();
    firstApplication.advanceWarmup(session.sessionId);
    await firstApplication.submitSessionProduction(session.sessionId, 'Si tendría tiempo, viajaría.');
    firstRepository.close();

    using reopened = new SpanishC1Repository(paths.database);
    const restored = new ApplicationService(provider, reopened, paths.root, {
      now: () => new Date('2026-08-24T12:05:00.000Z'),
    }).getState().activeSession;
    expect(restored).toMatchObject({
      sessionId: session.sessionId,
      phase: 'repair',
      response: 'Si tendría tiempo, viajaría.',
      proposal: { correctedText: 'Si tuviera más tiempo, viajaría más.' },
    });
  });

  it.each([
    ['disagree', 'learner_disagreed', 'targeted_practice'],
    ['unclear', 'uncertain', 'targeted_practice'],
    ['defer', 'uncertain', 'summary'],
  ] as const)('keeps the learner %s decision as evidence', async (decision, disposition, phase) => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `${decision}-${++id}`,
    });
    const session = application.startFifteenMinuteSession();
    application.advanceWarmup(session.sessionId);
    const repair = await application.submitSessionProduction(session.sessionId, 'Si tendría tiempo, viajaría.');

    expect(application.reviewCorrection(session.sessionId, decision).phase).toBe(phase);
    const weakness = repository.getWeaknessRecord(repair.weaknessIds[0]!);
    expect(weakness?.evidence.at(-1)).toMatchObject({
      disposition,
      validationSource: 'learner_reviewed',
      observedBehavior: decision,
    });
  });

  it('selects a due weakness before diagnostic practice', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const currentTime = { value: '2026-08-24T12:00:00.000Z' };
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date(currentTime.value),
      createId: () => `due-${++id}`,
    });
    const first = application.startFifteenMinuteSession();
    application.advanceWarmup(first.sessionId);
    const repair = await application.submitSessionProduction(first.sessionId, 'Si tendría tiempo, viajaría.');
    application.reviewCorrection(first.sessionId, 'agree');
    await application.submitTargetedPractice(first.sessionId, 'Si tuviera tiempo, estudiaría.');
    await application.submitTransfer(first.sessionId, 'Si tuviera vacaciones, descansaría.');
    application.completeFifteenMinuteSession(first.sessionId);

    currentTime.value = '2026-08-28T12:00:00.000Z';
    expect(application.startFifteenMinuteSession()).toMatchObject({
      selectionReason: 'due_review',
      targetWeaknessId: repair.weaknessIds[0],
      weaknessIds: [repair.weaknessIds[0]],
    });
  });

  it('explains high-impact selection and periodically protects broader practice', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `selection-${++id}`,
    });
    const analysis = await application.analyzeProduction('Si tendría tiempo, viajaría.');

    const targeted = application.startFifteenMinuteSession();
    expect(targeted).toMatchObject({
      targetWeaknessId: analysis.weaknessIds[0],
      selectionExplanation: expect.stringContaining('highest-impact active weakness'),
      difficulty: { linguisticComplexity: 3, grammaticalHints: 1 },
    });
    repository.saveSession({
      id: targeted.sessionId,
      mode: 'fifteen_minute',
      status: 'completed',
      startedAt: targeted.startedAt,
      completedAt: targeted.startedAt,
    });
    repository.saveSession({
      id: 'session-fairness-2',
      mode: 'fifteen_minute',
      status: 'completed',
      startedAt: '2026-08-24T13:00:00.000Z',
      completedAt: '2026-08-24T13:15:00.000Z',
    });

    const broad = application.startFifteenMinuteSession();
    expect(broad).toMatchObject({
      targetWeaknessId: undefined,
      selectionExplanation: expect.stringContaining('broader diagnostic practice'),
    });
  });

  it('records learner pause and reopen controls without deleting weakness evidence', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `control-${++id}`,
    });
    const analysis = await application.analyzeProduction('Si tendría tiempo, viajaría.');
    const weaknessId = analysis.weaknessIds[0]!;

    expect(application.setWeaknessPaused(weaknessId, true)).toMatchObject({
      weakness: { isPaused: true },
      evidence: [{ purpose: 'detection' }],
      controls: [{ action: 'paused' }],
    });
    expect(application.getState().nextActivityExplanation).toContain('no active weakness');
    expect(application.setWeaknessPaused(weaknessId, false)).toMatchObject({
      weakness: { isPaused: false },
      controls: [{ action: 'paused' }, { action: 'reopened' }],
    });
  });

  it('still schedules broad practice after more than 100 completed sessions', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `long-run-${++id}`,
    });
    await application.analyzeProduction('Si tendría tiempo, viajaría.');
    for (let index = 0; index < 101; index += 1) {
      repository.saveSession({
        id: `session-history-${index}`,
        mode: 'fifteen_minute',
        status: 'completed',
        startedAt: new Date(Date.parse('2026-01-01T00:00:00.000Z') + index * 60_000).toISOString(),
        completedAt: new Date(Date.parse('2026-01-01T00:15:00.000Z') + index * 60_000).toISOString(),
      });
    }

    expect(repository.countCompletedFifteenMinuteSessions()).toBe(101);
    expect(application.startFifteenMinuteSession()).toMatchObject({
      targetWeaknessId: undefined,
      selectionExplanation: expect.stringContaining('broader diagnostic practice'),
    });
  });

  it('appends repeated observations to the same weakness history', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    const application = new ApplicationService(provider, repository, paths.root, {
      now: () => new Date(`2026-08-24T12:0${Math.min(id, 9)}:00.000Z`),
      createId: () => `repeat-${++id}`,
    });

    const first = await application.analyzeProduction('Si tendría tiempo, viajaría.');
    const second = await application.analyzeProduction('Si tendría dinero, compraría una casa.');
    expect(second.weaknessIds).toEqual(first.weaknessIds);
    expect(repository.getWeaknessRecord(first.weaknessIds[0]!)).toMatchObject({
      revision: 2,
      evidence: [{ purpose: 'detection' }, { purpose: 'detection' }],
    });
  });

  it('restores a partially completed baseline after reopening', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const firstRepository = new SpanishC1Repository(paths.database);
    let id = 0;
    const first = new ApplicationService(provider, firstRepository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `assessment-${++id}`,
    });
    const baseline = first.startAssessment('baseline');
    expect(baseline.progress).toMatchObject({ promptSequence: 0, supportLevel: 'minimal', currentIndex: 0 });
    await first.submitAssessmentResponse(baseline.id, 'Respuesta de evaluación.');
    firstRepository.close();

    using reopened = new SpanishC1Repository(paths.database);
    const restored = new ApplicationService(provider, reopened, paths.root).getState().activeAssessment;
    expect(restored).toMatchObject({
      id: baseline.id,
      kind: 'baseline',
      status: 'active',
      progress: { currentIndex: 1 },
    });
    expect(restored?.progress.steps[0]).toMatchObject({
      id: 'wp-0',
      response: 'Respuesta de evaluación.',
    });
  });

  it('preserves incompatible assessment payloads without blocking a new rubric assessment', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveAssessment({
      id: 'assessment-malformed',
      kind: 'baseline',
      status: 'active',
      startedAt: '2026-08-24T12:00:00.000Z',
      profile: { type: 'progress', progress: { rubricVersion: 'practical-c1-text.v1', promptSet: 'A' } },
    });
    const application = new ApplicationService(provider, repository, paths.root, {
      createId: () => 'compatible-v2',
    });

    expect(application.getState()).toMatchObject({
      activeAssessment: undefined,
      assessmentHistory: [],
      incompatibleAssessmentCount: 1,
      corruptAssessmentCount: 0,
    });
    expect(application.startAssessment('baseline').progress).toMatchObject({
      rubricVersion: 'practical-c1-text.v2',
      promptSequence: 0,
    });
    expect(repository.listAssessments()).toHaveLength(2);
    expect(repository.getAssessment('assessment-malformed')?.profile).toEqual({
      type: 'progress',
      progress: { rubricVersion: 'practical-c1-text.v1', promptSet: 'A' },
    });
  });

  it('excludes lifecycle-inconsistent durable assessment state', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const application = new ApplicationService(provider, repository, paths.root, {
      createId: () => 'lifecycle',
    });
    let assessment = application.startAssessment('baseline');
    while (assessment.status === 'active') {
      assessment = await application.submitAssessmentResponse(assessment.id, 'Respuesta de evaluación.');
    }
    const stored = repository.getAssessment(assessment.id)!;
    const report = stored.profile as { readonly progress: unknown };
    repository.saveAssessment({
      id: stored.id,
      kind: stored.kind,
      status: 'active',
      startedAt: stored.startedAt,
      profile: { type: 'progress', progress: report.progress },
    }, stored.revision);

    expect(application.getState()).toMatchObject({
      activeAssessment: undefined,
      incompatibleAssessmentCount: 0,
      corruptAssessmentCount: 1,
    });
  });

  it('completes baseline and compares an unfamiliar checkpoint with the stable rubric', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let id = 0;
    let improved = false;
    const assessmentProvider: AiProvider = {
      ...provider,
      proposeCorrection: async () => { throw new Error('Assessment must not use the generic correction path.'); },
      evaluateAssessment: async (request) => ({
        skill: request.skill,
        judgment: improved ? 'strong_evidence' : 'limited_evidence',
        confidence: improved ? 0.88 : 0.72,
        evidence: [improved ? 'The response meets all supplied criteria.' : 'The response only partially meets the supplied criteria.'],
        weaknesses: improved ? [] : [{
          category: 'grammar.conditional.si_clause',
          explanation: 'Model proposal.',
          confidence: 0.8,
          referenceIds: ['conditional.present_hypothetical'],
        }],
        mexicanSpanishNotes: [],
        uncertainties: [improved ? 'One sample does not prove durable control.' : 'The short response limits confidence.'],
      }),
    };
    const application = new ApplicationService(assessmentProvider, repository, paths.root, {
      now: () => new Date('2026-08-24T12:00:00.000Z'),
      createId: () => `assessment-flow-${++id}`,
    });

    let baseline = application.startAssessment('baseline');
    while (baseline.status === 'active') {
      baseline = await application.submitAssessmentResponse(baseline.id, 'Respuesta de línea base.');
    }
    expect(baseline).toMatchObject({
      status: 'completed',
      progress: { promptSequence: 0, supportLevel: 'minimal', currentIndex: 7 },
      profile: {
        rubricVersion: 'practical-c1-text.v2',
        dimensions: {
          written_production: {
            judgment: 'limited_evidence',
            modelConfidence: 0.72,
            evidencePromptIds: ['wp-0'],
            uncertainties: ['The short response limits confidence.', 'This is a local-model judgment from one written sample, not verified C1 mastery.'],
          },
          spoken_comprehension_production: { status: 'not_sampled' },
        },
      },
    });
    expect(baseline.profile?.initialWeaknesses[0]).toMatchObject({
      key: 'grammar.conditional.si_clause',
      observationCount: 7,
      modelConfidence: 0.8,
    });
    expect(baseline.profile?.initialWeaknesses[0]?.evidencePromptIds).toContain('wp-0');

    improved = true;
    let checkpoint = application.startAssessment('checkpoint');
    expect(checkpoint.progress).toMatchObject({ promptSequence: 1, supportLevel: 'none' });
    expect(checkpoint.progress.steps.every((step) => step.supportGuidance === undefined)).toBe(true);
    while (checkpoint.status === 'active') {
      checkpoint = await application.submitAssessmentResponse(checkpoint.id, 'Respuesta de control.');
    }
    expect(checkpoint).toMatchObject({
      status: 'completed',
      progress: { promptSequence: 1, currentIndex: 7 },
      comparison: {
        written_production: 'stronger_evidence',
        comprehension: 'stronger_evidence',
      },
    });
    expect(checkpoint.profile).not.toHaveProperty('score');
    const nextCheckpoint = application.startAssessment('checkpoint');
    expect(nextCheckpoint.progress).toMatchObject({ promptSequence: 2, supportLevel: 'none' });
    expect(nextCheckpoint.progress.steps.map((step) => step.prompt))
      .not.toEqual(checkpoint.progress.steps.map((step) => step.prompt));
  });
});
