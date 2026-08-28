// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CorrectionProposal } from '../../../packages/ai-provider/src/contracts';
import type { StoredSessionProgress, WeaknessSummaryRecord } from '../../../packages/persistence/src/models';
import type { AssessmentView, WeaknessDetail } from '../../desktop/application-service';
import { App } from './App';

const proposal: CorrectionProposal = {
  correctedText: 'Si tuviera más tiempo, viajaría más.',
  issues: [{
    category: 'grammar.conditional.si_clause',
    span: 'tendría',
    replacement: 'tuviera',
    explanation: 'Use the imperfect subjunctive.',
    confidence: 0.94,
    referenceIds: ['conditional.present_hypothetical'],
  }],
  mexicanSpanishNotes: [],
  uncertainties: [],
};

const targetedPracticeProposal: CorrectionProposal = {
  ...proposal,
  correctedText: 'Si tuviera tiempo, estudiaría.',
  mexicanSpanishNotes: ['Natural in Mexican Spanish.'],
  issues: [{
    ...proposal.issues[0]!,
    span: 'Si tuviera tiempo, estudiaría.',
    replacement: 'Si tuviera tiempo, estudiaría.',
    explanation: 'The hypothetical condition and result now agree.',
  }],
};

const transferProposal: CorrectionProposal = {
  ...proposal,
  correctedText: 'Si tuviera vacaciones, visitaría Oaxaca.',
  issues: [],
  uncertainties: ['One successful response does not yet prove durable control.'],
};

const progress = (phase: StoredSessionProgress['phase']): StoredSessionProgress => ({
  sessionId: 'session-ui',
  phase,
  selectionReason: 'diagnostic',
  prompt: `Prompt for ${phase}`,
  proposal: phase === 'repair' ? proposal : undefined,
  weaknessIds: phase === 'warmup' || phase === 'production' ? [] : ['weakness-1'],
  startedAt: '2026-08-24T12:00:00.000Z',
  updatedAt: '2026-08-24T12:00:00.000Z',
  revision: 1,
  difficulty: {
    linguisticComplexity: 3,
    taskOpenness: 3,
    timePressure: 2,
    lexicalSupport: 1,
    grammaticalHints: 1,
    simultaneousTargets: 1,
    topicFamiliarity: 4,
    taskMode: 'production',
    modality: 'written',
  },
  difficultyReason: 'Starting from the saved difficulty state.',
});

const activeAssessment: AssessmentView = {
  id: 'assessment-ui-active',
  kind: 'baseline',
  status: 'active',
  startedAt: '2026-08-24T12:00:00.000Z',
  revision: 1,
  progress: {
    rubricVersion: 'practical-c1-text.v2',
    promptSequence: 0,
    supportLevel: 'minimal',
    currentIndex: 0,
    steps: [{
      id: 'wp-0',
      skill: 'written_production',
      prompt: 'Escribe una propuesta matizada.',
      rubricCriteria: ['Develop relevant ideas.'],
      supportGuidance: 'Organiza propósito, ideas y conclusión.',
    }],
  },
};

const sampledDimension = {
  status: 'sampled' as const,
  evidencePromptIds: ['wp-1'],
  judgment: 'strong_evidence' as const,
  modelConfidence: 0.8,
  evidence: ['The response meets the requested criterion.'],
  uncertainties: ['Specific model uncertainty.', 'C1 control remains unverified.'],
};

const mixedDimension = {
  ...sampledDimension,
  judgment: 'mixed_evidence' as const,
  evidence: ['The response met some, but not all, requested criteria.'],
};

const limitedDimension = {
  ...sampledDimension,
  judgment: 'limited_evidence' as const,
  evidence: ['The response supplied limited evidence for this dimension.'],
};

const notAssessableDimension = {
  ...sampledDimension,
  judgment: 'not_assessable' as const,
  evidence: [],
  uncertainties: ['The written response did not support a reliable judgment.'],
};

const completedCheckpoint: AssessmentView = {
  id: 'assessment-ui-complete',
  kind: 'checkpoint',
  status: 'completed',
  startedAt: '2026-08-24T12:00:00.000Z',
  completedAt: '2026-08-24T12:20:00.000Z',
  revision: 8,
  progress: {
    rubricVersion: 'practical-c1-text.v2',
    promptSequence: 1,
    supportLevel: 'none',
    currentIndex: 1,
    steps: [{ id: 'wp-1', skill: 'written_production', prompt: 'Defiende una inversión.', rubricCriteria: ['Develop relevant ideas.'], response: 'Respuesta.' }],
  },
  profile: {
    rubricVersion: 'practical-c1-text.v2',
    initialWeaknesses: [{
      key: 'grammar.conditional.si_clause',
      skills: ['written_production'],
      evidencePromptIds: ['wp-1'],
      observationCount: 1,
      modelConfidence: 0.8,
      referenceIds: ['conditional.present_hypothetical'],
      uncertainty: 'Model-proposed weakness; verification is still required.',
    }],
    dimensions: {
      written_production: sampledDimension,
      comprehension: mixedDimension,
      grammatical_control: limitedDimension,
      lexical_precision_range: notAssessableDimension,
      cohesion_discourse: sampledDimension,
      register_pragmatics: sampledDimension,
      mexican_spanish_naturalness: sampledDimension,
      spoken_comprehension_production: {
        status: 'not_sampled',
        evidencePromptIds: [],
        evidence: [],
        uncertainties: ['This text assessment did not sample spoken performance, so no spoken-language claim is made.'],
      },
    },
  },
  comparison: {
    written_production: 'stronger_evidence',
    comprehension: 'same_evidence_band',
    grammatical_control: 'weaker_evidence',
    lexical_precision_range: 'insufficient_evidence',
    cohesion_discourse: 'same_evidence_band',
    register_pragmatics: 'same_evidence_band',
    mexican_spanish_naturalness: 'same_evidence_band',
  },
};

describe('15-minute desktop session UI', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Object.assign(window, {
      spanishC1: {
        getBootstrapStatus: vi.fn(async () => ({ ok: true, value: { mode: 'normal', activeDataRoot: 'C:\\synthetic-data' } })),
        getAppState: vi.fn(async () => ({ ok: true, value: {
          activeDataRoot: 'C:\\synthetic-data',
          recentSessions: [],
          dueReviewCount: 0,
          dueReviews: [],
          weaknesses: [],
          nextActivityExplanation: 'Selected diagnostic practice.',
          assessmentHistory: [],
          incompatibleAssessmentCount: 0,
          corruptAssessmentCount: 0,
          setupAcknowledged: true,
          audioRetention: 'discard',
        } })),
        getReadiness: vi.fn(async () => ({ ok: true, value: { overall: 'informational', setupAcknowledged: true, checks: [] } })),
        acknowledgeSetup: vi.fn(async () => ({ ok: true, value: undefined })),
        listBackups: vi.fn(async () => ({ ok: true, value: [{ id: 'spanish-c1-backup-test.sqlite', createdAt: '2026-08-24T12:00:00.000Z', sizeBytes: 1_048_576 }] })),
        createBackup: vi.fn(async () => ({ ok: true, value: 'C:\\synthetic-data\\backups\\spanish-c1-backup-test.sqlite' })),
        createExport: vi.fn(async () => ({ ok: true, value: 'C:\\synthetic-data\\exports\\spanish-c1-export-test.json' })),
        previewBackup: vi.fn(async () => ({ ok: true, value: {
          token: 'preview-token', kind: 'restore', displayName: 'spanish-c1-backup-test.sqlite',
          createdAt: '2026-08-24T12:00:00.000Z', formatVersion: 1, schemaVersion: 5,
          currentCounts: { sessions: 1, session_progress: 0, weaknesses: 0, evidence_events: 0, weakness_control_events: 0, reviews: 0, settings: 1, assessments: 0 },
          incomingCounts: { sessions: 0, session_progress: 0, weaknesses: 0, evidence_events: 0, weakness_control_events: 0, reviews: 0, settings: 1, assessments: 0 },
          expiresAt: '2026-08-24T12:10:00.000Z',
        } })),
        selectImport: vi.fn(async () => ({ ok: true, value: undefined })),
        commitImport: vi.fn(async () => new Promise(() => {})),
        commitRestore: vi.fn(async () => new Promise(() => {})),
        getAiDiagnostics: vi.fn(async () => ({ ok: true, value: {
          endpoint: 'http://127.0.0.1:11434',
          model: 'synthetic',
          contextLength: 4_096,
          providerVersion: 'test',
          modelAvailable: true,
        } })),
        getAudioStatus: vi.fn(async () => ({ ok: true, value: {
          available: true,
          speechToTextModel: 'whisper-base-int8',
          textToSpeechModel: 'claude-high-int8',
          message: 'Offline Mexican-Spanish speech is ready.',
          retention: 'discard',
        } })),
        setAudioRetention: vi.fn(async (retention) => ({ ok: true, value: {
          available: true,
          speechToTextModel: 'whisper-base-int8',
          textToSpeechModel: 'claude-high-int8',
          message: 'Offline Mexican-Spanish speech is ready.',
          retention,
        } })),
        transcribeSessionAudio: vi.fn(),
        submitSessionTranscript: vi.fn(),
        synthesizeSpeech: vi.fn(),
        proposeCorrection: vi.fn(),
        startFifteenMinuteSession: vi.fn(async () => ({ ok: true, value: progress('warmup') })),
        advanceWarmup: vi.fn(async () => ({ ok: true, value: progress('production') })),
        submitSessionText: vi.fn()
          .mockResolvedValueOnce({ ok: true, value: { ...progress('repair'), response: 'Si tendría más tiempo, viajaría más.' } })
          .mockResolvedValueOnce({ ok: true, value: { ...progress('transfer'), response: 'Si tuviera tiempo, estudiaría.', proposal: targetedPracticeProposal } })
          .mockResolvedValueOnce({ ok: true, value: { ...progress('summary'), response: 'Si tuviera vacaciones, visitaría Oaxaca.', proposal: transferProposal } }),
        reviewCorrection: vi.fn(async () => ({ ok: true, value: {
          ...progress('targeted_practice'),
          learnerDecision: 'disagree',
          response: 'Si tendría más tiempo, viajaría más.',
        } })),
        completeFifteenMinuteSession: vi.fn(async () => ({ ok: true, value: progress('completed') })),
        getWeaknessDetail: vi.fn(),
        setWeaknessPaused: vi.fn(),
        startAssessment: vi.fn(),
        submitAssessmentResponse: vi.fn(),
      },
    });
  });

  it('supports the keyboard-accessible start, production, and disagreement flow', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: '15-minute session' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Start a 15-minute session' }));
    expect(await screen.findByText('Retrieval warm-up · about 2 minutes')).toBeTruthy();
    const sessionPath = screen.getByRole('list', { name: 'Session progress' });
    expect(sessionPath).toBeTruthy();
    expect(within(sessionPath).getByText('Warm up').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText('Time pressure')).toBeTruthy();
    expect(screen.getByText('Topic familiarity')).toBeTruthy();
    expect(screen.getByText('Starting from the saved difficulty state.')).toBeTruthy();
    expect((screen.getByText('Difficulty controls').closest('details') as HTMLDetailsElement).open).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to production' }));

    const response = await screen.findByLabelText('Your Spanish response');
    fireEvent.change(response, { target: { value: 'Si tendría más tiempo, viajaría más.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Si tuviera más tiempo, viajaría más.')).toBeTruthy();
    const repairWorkspace = screen.getByRole('heading', { name: 'Repair' }).closest('section');
    expect(repairWorkspace?.textContent).toContain('Si tendría más tiempo, viajaría más.');
    expect(repairWorkspace?.textContent).toContain('Si tuviera más tiempo, viajaría más.');
    expect(within(sessionPath).getByText('Repair').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByText(/No independent verification yet/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'I agree' }).className).toBe('');
    expect(screen.getByRole('button', { name: 'I disagree' }).className).toContain('button-secondary');
    expect(screen.getByRole('button', { name: 'This is unclear' }).className).toContain('button-quiet');
    expect(screen.getByRole('button', { name: 'Defer it' }).className).toContain('button-quiet');
    fireEvent.click(screen.getByRole('button', { name: 'I disagree' }));
    await waitFor(() => expect(window.spanishC1.reviewCorrection).toHaveBeenCalledWith('session-ui', 'disagree'));
    expect(await screen.findByText('Targeted practice · part of the repair block')).toBeTruthy();
    expect(within(sessionPath).getByText('Repair').closest('li')?.getAttribute('aria-current')).toBe('step');

    fireEvent.change(screen.getByLabelText('Your Spanish response'), { target: { value: 'Si tuviera tiempo, estudiaría.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Changed-context transfer · about 3 minutes')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Feedback on your previous response' })).toBeTruthy();
    expect(screen.getByText('AI proposal — review before accepting as evidence')).toBeTruthy();
    expect(screen.getByText('The hypothetical condition and result now agree.')).toBeTruthy();
    expect(screen.getByText('Natural in Mexican Spanish.')).toBeTruthy();
    expect(within(sessionPath).getByText('Transfer').closest('li')?.getAttribute('aria-current')).toBe('step');

    fireEvent.change(screen.getByLabelText('Your Spanish response'), { target: { value: 'Si tuviera vacaciones, visitaría Oaxaca.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Summary and scheduling · about 2 minutes')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Feedback on your previous response' })).toBeTruthy();
    expect(screen.getByText('No specific issue was proposed for this response.')).toBeTruthy();
    expect(screen.getByText('One successful response does not yet prove durable control.')).toBeTruthy();
    expect(within(sessionPath).getByText('Wrap up').closest('li')?.getAttribute('aria-current')).toBe('step');

    fireEvent.click(screen.getByRole('button', { name: 'Finish and save' }));
    expect((await screen.findByRole('status')).textContent).toContain('Saved');
    expect(screen.getByRole('list', { name: 'Session progress' }).querySelectorAll('.is-complete')).toHaveLength(5);
  });

  it('requires the exact confirmation before requesting a managed restore', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Preview restore' }));
    const restoreButton = await screen.findByRole('button', { name: 'Replace data and restart' });
    expect((restoreButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Type RESTORE to confirm'), { target: { value: 'restore' } });
    expect((restoreButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Type RESTORE to confirm'), { target: { value: 'RESTORE' } });
    expect((restoreButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(restoreButton);
    await waitFor(() => expect(window.spanishC1.commitRestore).toHaveBeenCalledWith('preview-token', 'RESTORE'));
  });

  it('opens on Today, separates secondary views, and preserves a restored session while navigating', async () => {
    vi.mocked(window.spanishC1.getAppState).mockResolvedValue({ ok: true, value: {
      activeDataRoot: 'C:\\synthetic-data',
      recentSessions: [],
      activeSession: progress('production'),
      dueReviewCount: 2,
      dueReviews: [],
      weaknesses: [],
      nextActivityExplanation: 'Resume the active production task.',
      assessmentHistory: [],
      incompatibleAssessmentCount: 0,
      corruptAssessmentCount: 0,
      setupAcknowledged: true,
      audioRetention: 'discard',
    } });

    render(<App />);
    const skipLink = await screen.findByRole('link', { name: 'Skip to main content' });
    expect(skipLink.getAttribute('href')).toBe('#main-content');
    expect(document.querySelector('main')?.id).toBe('main-content');
    const today = screen.getByRole('button', { name: 'Today' });
    expect(today.getAttribute('aria-current')).toBe('page');
    expect(await screen.findByText('Prompt for production')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Session progress' })).getByText('Produce').closest('li')?.getAttribute('aria-current')).toBe('step');
    expect(screen.getByRole('button', { name: 'Analyze this Spanish' }).className).toContain('button-secondary');
    expect(screen.queryByRole('heading', { name: 'Weakness dashboard' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Progress' }));
    expect(screen.getByRole('heading', { name: 'Progress' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Weakness dashboard' })).toBeTruthy();
    expect((screen.getByText('Prompt for production').closest('.daily-session') as HTMLElement)?.hidden).toBe(true);

    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('heading', { name: 'Settings', level: 2 })).toBeTruthy();
    expect(screen.getByText('C:\\synthetic-data')).toBeTruthy();
    expect(screen.getByLabelText('Local AI diagnostics')).toBeTruthy();

    fireEvent.click(today);
    expect(await screen.findByText('Prompt for production')).toBeTruthy();
  });

  it('keeps a local AI connection failure understandable in Settings', async () => {
    vi.mocked(window.spanishC1.getAiDiagnostics).mockResolvedValue({
      ok: false,
      error: { code: 'provider_unavailable', message: 'Ollama is unavailable.' },
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Settings' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Ollama is unavailable.');
  });

  it('keeps written practice usable when offline speech is unavailable', async () => {
    vi.mocked(window.spanishC1.getAppState).mockResolvedValue({ ok: true, value: {
      activeDataRoot: 'C:\\synthetic-data', recentSessions: [], activeSession: progress('production'),
      dueReviewCount: 0, dueReviews: [], weaknesses: [], nextActivityExplanation: 'Resume production.',
      assessmentHistory: [], incompatibleAssessmentCount: 0, corruptAssessmentCount: 0,
      setupAcknowledged: true, audioRetention: 'discard',
    } });
    vi.mocked(window.spanishC1.getAudioStatus).mockResolvedValue({ ok: true, value: {
      available: false, speechToTextModel: 'whisper-base-int8', textToSpeechModel: 'claude-high-int8',
      message: 'The selected offline Spanish speech models are unavailable.', retention: 'discard',
    } });

    render(<App />);

    expect(await screen.findByLabelText('Your Spanish response')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Speak' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Write' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('offers local spoken practice and exposes the recording retention control', async () => {
    vi.mocked(window.spanishC1.getAppState).mockResolvedValue({ ok: true, value: {
      activeDataRoot: 'C:\\synthetic-data', recentSessions: [], activeSession: progress('production'),
      dueReviewCount: 0, dueReviews: [], weaknesses: [], nextActivityExplanation: 'Resume production.',
      assessmentHistory: [], incompatibleAssessmentCount: 0, corruptAssessmentCount: 0,
      setupAcknowledged: true, audioRetention: 'discard',
    } });

    render(<App />);
    const speak = await screen.findByRole('button', { name: 'Speak' });
    expect((speak as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(speak);
    expect(screen.getByRole('heading', { name: 'Record, inspect, then confirm' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start recording' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByLabelText('Recording retention')).toBeTruthy();
    expect(screen.getByText(/Only a confirmed transcript can enter the learning system/)).toBeTruthy();
  });

  it('shows selection rationale, evidence detail, and pause control', async () => {
    const weaknessId = 'weakness-0123456789abcdef01234567';
    const summary: WeaknessSummaryRecord = {
      id: weaknessId,
      category: 'grammar.conditional.si_clause' as const,
      featureKey: 'conditional.present_hypothetical',
      state: 'suspected',
      confidence: 0.94,
      severity: 3,
      communicativeImpact: 4,
      recurrenceCount: 0,
      nextReviewAt: '2026-08-27T12:00:00.000Z',
      isPaused: false,
      evidenceCount: 1,
    };
    const dueSummary: WeaknessSummaryRecord = {
      ...summary,
      id: 'weakness-due-12345678901234567890',
      featureKey: 'conditional.real_present_future',
      state: 'confirmed',
      confidence: 0.88,
      recurrenceCount: 2,
      evidenceCount: 4,
    };
    const improvedSummary: WeaknessSummaryRecord = {
      ...summary,
      id: 'weakness-improved-12345678901234',
      featureKey: 'conditional.past_counterfactual',
      state: 'provisional',
      confidence: 0.81,
      severity: 2,
      communicativeImpact: 3,
      evidenceCount: 5,
    };
    const pausedSummary: WeaknessSummaryRecord = {
      ...summary,
      id: 'weakness-paused-1234567890123456',
      featureKey: 'grammar.subjunctive',
      state: 'remediating',
      confidence: 0.76,
      isPaused: true,
      evidenceCount: 3,
    };
    const detail: WeaknessDetail = {
      weakness: {
        ...summary,
        state: 'suspected',
        severity: 3,
        communicativeImpact: 4,
        firstDetectedAt: '2026-08-24T12:00:00.000Z',
        lastObservedAt: '2026-08-24T12:00:00.000Z',
        sourceActivityId: 'activity-1',
        referenceIds: ['conditional.present_hypothetical'] as const,
        mexicanSpanishNotes: [],
      },
      evidence: [{
        id: 'evidence-1',
        occurredAt: '2026-08-24T12:00:00.000Z',
        weaknessId,
        sessionId: 'session-ui',
        activityId: 'activity-1',
        purpose: 'detection' as const,
        disposition: 'uncertain' as const,
        validationSource: 'model_only' as const,
        confidence: 0.94,
        contextKey: 'diagnostic',
        supportLevel: 'minimal' as const,
        expectedBehavior: 'tuviera',
        observedBehavior: 'tendría',
        referenceIds: ['conditional.present_hypothetical'] as const,
        validatorResult: {
          status: 'needs_review' as const,
          referenceIds: ['conditional.present_hypothetical'] as const,
          explanation: 'Needs review.',
        },
      }],
      revision: 1,
      controls: [],
    };
    vi.mocked(window.spanishC1.getAppState).mockResolvedValue({ ok: true, value: {
      activeDataRoot: 'C:\\synthetic-data',
      recentSessions: [],
      dueReviewCount: 1,
      dueReviews: [{
        id: 'review-due-1',
        weaknessId: dueSummary.id,
        dueAt: '2026-08-25T12:00:00.000Z',
      }],
      weaknesses: [summary, dueSummary, improvedSummary, pausedSummary],
      nextActivityExplanation: 'Selected this high-impact active weakness.',
      assessmentHistory: [],
      incompatibleAssessmentCount: 0,
      corruptAssessmentCount: 0,
      setupAcknowledged: true,
      audioRetention: 'discard',
    } });
    vi.mocked(window.spanishC1.getWeaknessDetail).mockResolvedValue({ ok: true, value: detail });
    vi.mocked(window.spanishC1.setWeaknessPaused).mockResolvedValue({ ok: true, value: {
      ...detail,
      weakness: { ...detail.weakness, isPaused: true },
      revision: 2,
      controls: [{
        id: 'control-1',
        weaknessId,
        occurredAt: '2026-08-24T12:01:00.000Z',
        action: 'paused',
        reason: 'Learner paused automatic activity selection.',
      }],
    } });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Progress' }));
    expect(await screen.findByText('Selected this high-impact active weakness.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Due now' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Active practice' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Provisionally improved' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeTruthy();
    expect(screen.getByText('Hypothetical si-clauses')).toBeTruthy();
    expect(screen.getByText('Real present and future conditions')).toBeTruthy();
    expect(screen.getByText('Past counterfactual conditions')).toBeTruthy();
    const weaknessCard = screen.getByRole('button', { name: /conditional\.present_hypothetical/ });
    expect(within(weaknessCard).getByText('3/5')).toBeTruthy();
    expect(within(weaknessCard).getByText('4/5')).toBeTruthy();
    expect(within(weaknessCard).getByText('1')).toBeTruthy();
    expect(within(weaknessCard).getByText(/Next review:/)).toBeTruthy();
    expect(within(weaknessCard).getByText('AI confidence: 94%').className).toContain('confidence-note');
    expect(weaknessCard.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(weaknessCard);
    expect(await screen.findByText('Evidence sequence')).toBeTruthy();
    expect(weaknessCard.getAttribute('aria-pressed')).toBe('true');
    expect(within(weaknessCard).getByText('Selected')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Hypothetical si-clauses' })).toBeTruthy();
    expect(screen.getByText('Detected')).toBeTruthy();
    expect(screen.getByText('AI proposal only')).toBeTruthy();
    expect(screen.getByText('tendría')).toBeTruthy();
    expect((screen.getByText('Technical evidence').closest('details') as HTMLDetailsElement).open).toBe(false);
    expect(screen.getByRole('button', { name: 'Pause automatic practice' }).className).toContain('button-quiet');
    fireEvent.click(screen.getByRole('button', { name: 'Pause automatic practice' }));
    await waitFor(() => expect(window.spanishC1.setWeaknessPaused).toHaveBeenCalledWith(weaknessId, true));
    expect(await screen.findByText('Manual controls')).toBeTruthy();
  });

  it('starts and resumes an evidence-linked baseline response', async () => {
    vi.mocked(window.spanishC1.startAssessment).mockResolvedValue({ ok: true, value: activeAssessment });
    vi.mocked(window.spanishC1.submitAssessmentResponse).mockResolvedValue({
      ok: true,
      value: {
        ...activeAssessment,
        revision: 2,
        progress: {
          ...activeAssessment.progress,
          currentIndex: 1,
          steps: [{
            ...activeAssessment.progress.steps[0]!,
            response: 'Una respuesta de evaluación.',
          }],
        },
      },
    });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Progress' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Start baseline' }));
    expect(await screen.findByText(/stable rubric practical-c1-text\.v2 · minimal support/)).toBeTruthy();
    expect(screen.getByText(/Organiza propósito, ideas y conclusión/)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Your assessment response'), {
      target: { value: 'Una respuesta de evaluación.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await waitFor(() => expect(window.spanishC1.submitAssessmentResponse).toHaveBeenCalledWith(
      activeAssessment.id,
      'Una respuesta de evaluación.',
    ));
  });

  it('shows checkpoint evidence, uncertainty, and trends without a score claim', async () => {
    vi.mocked(window.spanishC1.getAppState).mockResolvedValue({ ok: true, value: {
      activeDataRoot: 'C:\\synthetic-data',
      recentSessions: [],
      dueReviewCount: 0,
      dueReviews: [],
      weaknesses: [],
      nextActivityExplanation: 'Selected diagnostic practice.',
      assessmentHistory: [completedCheckpoint],
      incompatibleAssessmentCount: 1,
      corruptAssessmentCount: 1,
      setupAcknowledged: true,
      audioRetention: 'discard',
    } });

    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'Progress' }));
    expect(await screen.findByText('Evidence-linked profile — not a single C1 score')).toBeTruthy();
    expect(screen.getByText(/different rubric.*preserved for export/i)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('failed integrity checks');
    expect(screen.getByText('Model-proposed initial weaknesses')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Assessment summary' })).toBeTruthy();
    expect(screen.getByText('Written production, Cohesion and discourse, Register and pragmatics, and Mexican-Spanish naturalness')).toBeTruthy();
    expect(screen.getByText('Grammatical control, then Comprehension')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Strong evidence' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Mixed evidence' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Limited evidence' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Not assessed' })).toBeTruthy();
    expect(screen.getByText('Stronger evidence than baseline')).toBeTruthy();
    expect(screen.getByText('Weaker evidence than baseline')).toBeTruthy();
    expect(screen.getByText('Spoken comprehension and production')).toBeTruthy();
    expect(screen.getAllByText('Specific model uncertainty.').length).toBeGreaterThan(0);
    expect(screen.getByText('This assessment did not sample spoken performance, so this report makes no spoken-language claim.')).toBeTruthy();
    expect((screen.getAllByText('Evidence and uncertainty')[0]!.closest('details') as HTMLDetailsElement).open).toBe(false);
    expect((screen.getByText('Technical weakness evidence').closest('details') as HTMLDetailsElement).open).toBe(false);
  });

  it('opens non-blocking first-run Settings and allows degraded setup acknowledgement', async () => {
    vi.mocked(window.spanishC1.getAppState).mockResolvedValue({ ok: true, value: {
      activeDataRoot: 'C:\\synthetic-data', recentSessions: [], dueReviewCount: 0, dueReviews: [], weaknesses: [],
      nextActivityExplanation: 'Selected diagnostic practice.', assessmentHistory: [], incompatibleAssessmentCount: 0,
      corruptAssessmentCount: 0, setupAcknowledged: false, audioRetention: 'discard',
    } });
    vi.mocked(window.spanishC1.getReadiness).mockResolvedValue({ ok: true, value: {
      overall: 'degraded', setupAcknowledged: false,
      checks: [{ id: 'ollama', level: 'degraded', label: 'Local Ollama', message: 'Ollama is unavailable. Start it locally, then choose Recheck.' }],
    } });

    render(<App />);

    expect(await screen.findByText('First-run readiness')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Today' })).toBeTruthy();
    expect(screen.getByText(/Ollama is unavailable/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Recheck' }));
    await waitFor(() => expect(window.spanishC1.getReadiness).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole('button', { name: 'Finish setup' }));
    await waitFor(() => expect(window.spanishC1.acknowledgeSetup).toHaveBeenCalledOnce());
  });

  it('shows only validated replacement choices when database bootstrap enters recovery mode', async () => {
    vi.mocked(window.spanishC1.getBootstrapStatus).mockResolvedValue({ ok: true, value: {
      mode: 'recovery', message: 'The database could not be opened.', activeDataRoot: 'C:\\synthetic-data',
    } });

    render(<App />);

    expect(await screen.findByText('Protected recovery mode')).toBeTruthy();
    expect(screen.getByText('The database could not be opened.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Preview backup restore' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Choose JSON export' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Today' })).toBeNull();
    expect(window.spanishC1.getAppState).not.toHaveBeenCalled();
  });

  it('shows read-only guidance when another portable installation owns the data root', async () => {
    vi.mocked(window.spanishC1.getBootstrapStatus).mockResolvedValue({ ok: true, value: {
      mode: 'blocked', message: 'Another Spanish C1 process owns this portable data folder.', activeDataRoot: 'C:\\synthetic-data',
    } });

    render(<App />);

    expect(await screen.findByText('Read-only guidance')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'This data folder is already open' })).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    expect(window.spanishC1.getAppState).not.toHaveBeenCalled();
  });
});
