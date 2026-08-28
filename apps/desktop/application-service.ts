import { createHash, randomUUID } from 'node:crypto';
import type { AiProvider, CorrectionProposal } from '../../packages/ai-provider/src/contracts.js';
import { correctionPromptVersion } from '../../packages/ai-provider/src/prompt.js';
import { adjustDifficulty, type DifficultyState } from '../../packages/domain/src/difficulty.js';
import { assessmentRubricVersion, buildAssessmentProfile, compareAssessmentProfiles, isAssessmentProfile, isAssessmentProgress, isProfileComparison, recordAssessmentStep, startAssessmentProgress, type AssessmentProfile, type AssessmentProgress, type ProfileTrend } from '../../packages/domain/src/assessment.js';
import { recordEvidence } from '../../packages/domain/src/weakness-engine.js';
import type { EvidenceDisposition, EvidenceEvent, EvidencePurpose, WeaknessRecord } from '../../packages/domain/src/weakness.js';
import type { SpanishC1Repository, StoredWeaknessRecord, WeaknessWrite } from '../../packages/persistence/src/repository.js';
import { initializeDataRoot } from '../../packages/persistence/src/data-root.js';
import { backupRepository, exportRepository, listRepositoryBackups, type PortableBackup } from '../../packages/persistence/src/portable-files.js';
import type { AssessmentRecord, LearnerDecision, ReviewRecord, SessionProgressRecord, SessionRecord, StoredAssessmentRecord, StoredSessionProgress, WeaknessControlRecord, WeaknessSummaryRecord } from '../../packages/persistence/src/models.js';
import type { AudioRetention } from './audio-service.js';

export interface ApplicationState {
  readonly activeDataRoot: string;
  readonly recentSessions: readonly SessionRecord[];
  readonly activeSession?: StoredSessionProgress;
  readonly dueReviewCount: number;
  readonly dueReviews: readonly ReviewRecord[];
  readonly weaknesses: readonly WeaknessSummaryRecord[];
  readonly nextActivityExplanation: string;
  readonly activeAssessment?: AssessmentView;
  readonly assessmentHistory: readonly AssessmentView[];
  readonly incompatibleAssessmentCount: number;
  readonly corruptAssessmentCount: number;
  readonly setupAcknowledged: boolean;
  readonly audioRetention: AudioRetention;
}

interface ActiveAssessmentPayload {
  readonly type: 'progress';
  readonly progress: AssessmentProgress;
}

interface CompletedAssessmentPayload {
  readonly type: 'report';
  readonly progress: AssessmentProgress;
  readonly profile: AssessmentProfile;
  readonly comparison?: Readonly<Record<string, ProfileTrend>>;
}

export interface AssessmentView {
  readonly id: string;
  readonly kind: AssessmentRecord['kind'];
  readonly status: AssessmentRecord['status'];
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly revision: number;
  readonly progress: AssessmentProgress;
  readonly profile?: AssessmentProfile;
  readonly comparison?: Readonly<Record<string, ProfileTrend>>;
}

export interface WeaknessDetail extends StoredWeaknessRecord {
  readonly controls: readonly WeaknessControlRecord[];
}

export interface AnalysisResult {
  readonly sessionId: string;
  readonly weaknessIds: readonly string[];
  readonly proposal: CorrectionProposal;
}

export interface ApplicationServiceOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
}

export class SessionWorkflowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SessionWorkflowError';
  }
}

const weaknessIdFor = (category: string, referenceId: string | undefined): string =>
  `weakness-${createHash('sha256').update(`${category}|${referenceId ?? 'unreferenced'}`).digest('hex').slice(0, 24)}`;

const addHours = (timestamp: string, hours: number): string =>
  new Date(Date.parse(timestamp) + hours * 3_600_000).toISOString();

const warmupPrompt = 'Recuerda una situación reciente y formula mentalmente una frase precisa en español. Cuando estés listo, continúa.';
const diagnosticPrompt = 'Describe en español una decisión difícil que tomaste y explica qué habría pasado si hubieras elegido otra opción.';
const defaultDifficulty: DifficultyState = {
  linguisticComplexity: 3,
  taskOpenness: 3,
  timePressure: 2,
  lexicalSupport: 1,
  grammaticalHints: 1,
  simultaneousTargets: 1,
  topicFamiliarity: 3,
  taskMode: 'production',
  modality: 'written',
};

export class ApplicationService {
  private readonly now: () => Date;
  private readonly createId: () => string;

  constructor(
    private readonly provider: AiProvider,
    private readonly repository: SpanishC1Repository,
    readonly activeDataRoot: string,
    options: ApplicationServiceOptions = {},
  ) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
  }

  createExport(): string {
    return exportRepository(this.repository, initializeDataRoot(this.activeDataRoot));
  }

  async createBackup(): Promise<string> {
    return backupRepository(this.repository, initializeDataRoot(this.activeDataRoot));
  }

  listBackups(): readonly PortableBackup[] {
    return listRepositoryBackups(initializeDataRoot(this.activeDataRoot));
  }

  isSetupAcknowledged(): boolean {
    return this.repository.getSetting<string>('setupAcknowledgedAt') !== undefined;
  }

  acknowledgeSetup(): void {
    this.repository.setSetting('setupAcknowledgedAt', this.now().toISOString());
  }

  getAudioRetention(): AudioRetention {
    return this.repository.getSetting<AudioRetention>('audioRetention') === 'keep' ? 'keep' : 'discard';
  }

  setAudioRetention(retention: AudioRetention): void {
    this.repository.setSetting('audioRetention', retention);
  }

  getState(): ApplicationState {
    const timestamp = this.now().toISOString();
    const activeSession = this.repository.getActiveSessionProgress();
    const storedAssessments = this.repository.listAssessments();
    const classifiedAssessments = storedAssessments.map((assessment) => ({
      stored: assessment,
      view: this.tryAssessmentView(assessment),
    }));
    const assessments = classifiedAssessments
      .map((assessment) => assessment.view)
      .filter((assessment): assessment is AssessmentView => assessment !== undefined);
    const activeAssessment = assessments.find((assessment) => assessment.status === 'active');
    const dueReviews = this.repository.dueReviews(timestamp);
    const selection = this.chooseNextActivity(timestamp);
    return {
      activeDataRoot: this.activeDataRoot,
      recentSessions: this.repository.listSessions(),
      activeSession,
      dueReviewCount: dueReviews.length,
      dueReviews,
      weaknesses: this.repository.listWeaknessSummaries(),
      nextActivityExplanation:
        activeSession?.selectionExplanation ?? selection.explanation,
      activeAssessment,
      assessmentHistory: assessments.filter((assessment) => assessment.status === 'completed'),
      incompatibleAssessmentCount: classifiedAssessments.filter((assessment) =>
        !assessment.view && this.hasUnsupportedRubric(assessment.stored),
      ).length,
      corruptAssessmentCount: classifiedAssessments.filter((assessment) =>
        !assessment.view && !this.hasUnsupportedRubric(assessment.stored),
      ).length,
      setupAcknowledged: this.isSetupAcknowledged(),
      audioRetention: this.getAudioRetention(),
    };
  }

  startAssessment(kind: AssessmentRecord['kind']): AssessmentView {
    const completed = this.repository
      .listAssessments()
      .map((assessment) => this.tryAssessmentView(assessment))
      .filter((assessment): assessment is AssessmentView => assessment !== undefined);
    const active = completed.find((assessment) => assessment.status === 'active');
    if (active) return active;
    const history = completed.filter((assessment) => assessment.status === 'completed');
    const promptSequence = history.length;
    const timestamp = this.now().toISOString();
    const assessment: AssessmentRecord = {
      id: `assessment-${this.createId()}`,
      kind,
      status: 'active',
      startedAt: timestamp,
      profile: {
        type: 'progress',
        progress: startAssessmentProgress(promptSequence, kind === 'checkpoint' ? 'none' : 'minimal'),
      } satisfies ActiveAssessmentPayload,
    };
    this.repository.saveAssessment(assessment, 0);
    return this.toAssessmentView(this.repository.getAssessment(assessment.id)!);
  }

  async submitAssessmentResponse(assessmentId: string, response: string): Promise<AssessmentView> {
    const stored = this.repository.getAssessment(assessmentId);
    if (!stored || stored.status !== 'active') {
      throw new SessionWorkflowError('The assessment is no longer active.');
    }
    const payload = stored.profile as ActiveAssessmentPayload;
    if (payload?.type !== 'progress' || !isAssessmentProgress(payload.progress)) {
      throw new SessionWorkflowError('Assessment progress is invalid or uses an unsupported rubric version.');
    }
    const currentStep = payload.progress.steps[payload.progress.currentIndex];
    if (!currentStep) throw new SessionWorkflowError('Assessment progress is invalid.');
    const proposal = await this.provider.evaluateAssessment({
      rubricVersion: payload.progress.rubricVersion,
      skill: currentStep.skill,
      prompt: currentStep.prompt,
      learnerResponse: response,
      criteria: currentStep.rubricCriteria,
      supportLevel: payload.progress.supportLevel,
    });
    const progress = recordAssessmentStep(payload.progress, response, proposal);
    const completed = progress.currentIndex === progress.steps.length;
    const timestamp = this.now().toISOString();
    let nextPayload: ActiveAssessmentPayload | CompletedAssessmentPayload = {
      type: 'progress',
      progress,
    };
    if (completed) {
      const profile = buildAssessmentProfile(progress);
      const previous = this.repository
        .listAssessments()
        .filter((assessment) => assessment.id !== stored.id && assessment.status === 'completed')
        .map((assessment) => this.tryAssessmentView(assessment))
        .filter((assessment): assessment is AssessmentView => assessment !== undefined)
        .find((assessment) => assessment.profile)?.profile;
      nextPayload = {
        type: 'report',
        progress,
        profile,
        comparison: stored.kind === 'checkpoint'
          ? compareAssessmentProfiles(previous, profile)
          : undefined,
      };
    }
    this.repository.saveAssessment({
      id: stored.id,
      kind: stored.kind,
      status: completed ? 'completed' : 'active',
      startedAt: stored.startedAt,
      completedAt: completed ? timestamp : undefined,
      profile: nextPayload,
    }, stored.revision);
    return this.toAssessmentView(this.repository.getAssessment(stored.id)!);
  }

  getWeaknessDetail(weaknessId: string): WeaknessDetail {
    const record = this.repository.getWeaknessRecord(weaknessId);
    if (!record) throw new SessionWorkflowError('The weakness is no longer available.');
    return { ...record, controls: this.repository.listWeaknessControls(weaknessId) };
  }

  setWeaknessPaused(weaknessId: string, paused: boolean): WeaknessDetail {
    const stored = this.repository.getWeaknessRecord(weaknessId);
    if (!stored) throw new SessionWorkflowError('The weakness is no longer available.');
    const timestamp = this.now().toISOString();
    this.repository.setWeaknessPaused(
      {
        id: `control-${this.createId()}`,
        weaknessId,
        occurredAt: timestamp,
        action: paused ? 'paused' : 'reopened',
        reason: paused
          ? 'Learner paused automatic activity selection.'
          : 'Learner reopened automatic activity selection.',
      },
      stored.revision,
    );
    return this.getWeaknessDetail(weaknessId);
  }

  startFifteenMinuteSession(): StoredSessionProgress {
    const active = this.repository.getActiveSessionProgress();
    if (active) return active;
    const timestamp = this.now().toISOString();
    const selection = this.chooseNextActivity(timestamp);
    const dueReview = selection.dueReview;
    const sessionId = `session-${this.createId()}`;
    const session: SessionRecord = { id: sessionId, mode: 'fifteen_minute', status: 'active', startedAt: timestamp };
    const progress: SessionProgressRecord = {
      sessionId,
      phase: 'warmup',
      selectionReason: dueReview ? 'due_review' : 'diagnostic',
      targetWeaknessId: selection.targetWeaknessId,
      prompt: warmupPrompt,
      weaknessIds: selection.targetWeaknessId ? [selection.targetWeaknessId] : [],
      startedAt: timestamp,
      updatedAt: timestamp,
      selectionExplanation: selection.explanation,
      difficulty: this.repository.getSetting<DifficultyState>('difficultyState') ?? defaultDifficulty,
      difficultyReason: 'Starting from the saved difficulty state.',
    };
    this.repository.saveSessionStep({ session, progress, expectedProgressRevision: 0 });
    return this.requireProgress(sessionId);
  }

  advanceWarmup(sessionId: string): StoredSessionProgress {
    const current = this.requirePhase(sessionId, 'warmup');
    const prompt = current.targetWeaknessId
      ? 'Usa de forma natural la habilidad pendiente de revisión en una situación laboral nueva.'
      : diagnosticPrompt;
    return this.updateProgress(current, { phase: 'production', prompt });
  }

  async submitSessionProduction(sessionId: string, learnerText: string, modality: DifficultyState['modality'] = 'written'): Promise<StoredSessionProgress> {
    const current = this.requirePhase(sessionId, 'production');
    const proposal = await this.provider.proposeCorrection({ learnerText });
    const timestamp = this.now().toISOString();
    const built = this.buildDetectionWrites(proposal, learnerText, sessionId, timestamp);
    const progress: SessionProgressRecord = {
      ...current,
      phase: 'repair',
      prompt: 'Revisa la propuesta. Tu decisión se guardará como evidencia, incluso si discrepas.',
      response: learnerText,
      proposal,
      weaknessIds: [...new Set([...current.weaknessIds, ...built.weaknessIds])],
      updatedAt: timestamp,
      difficulty: { ...(current.difficulty ?? defaultDifficulty), modality },
    };
    this.repository.saveSessionStep({ progress, expectedProgressRevision: current.revision, weaknesses: built.writes });
    return this.requireProgress(sessionId);
  }

  reviewCorrection(sessionId: string, decision: LearnerDecision): StoredSessionProgress {
    const current = this.requirePhase(sessionId, 'repair');
    const timestamp = this.now().toISOString();
    const writes = current.weaknessIds.map((weaknessId) => {
      const stored = this.repository.getWeaknessRecord(weaknessId);
      if (!stored) throw new SessionWorkflowError('The selected weakness is no longer available.');
      const source = stored.evidence.at(-1);
      const disposition: EvidenceDisposition = decision === 'agree' ? 'incorrect' : decision === 'disagree' ? 'learner_disagreed' : 'uncertain';
      const event = this.createEvidence({
        weaknessId,
        sessionId,
        timestamp,
        purpose: 'detection',
        disposition,
        activity: 'learner-review',
        contextKey: `learner-review:${weaknessId}`,
        expected: source?.expectedBehavior ?? 'Review the proposed correction.',
        observed: decision,
        validationSource: 'learner_reviewed',
        confidence: decision === 'agree' ? 0.8 : 0.5,
      });
      return { record: recordEvidence(stored, event), expectedRevision: stored.revision };
    });
    const continuePractice = decision !== 'defer' && current.weaknessIds.length > 0;
    const progress: SessionProgressRecord = {
      ...current,
      phase: continuePractice ? 'targeted_practice' : 'summary',
      prompt: continuePractice
        ? 'Reescribe la idea con tus propias palabras usando la corrección, sin copiar la respuesta propuesta.'
        : 'Revisa el resumen y termina la sesión cuando estés listo.',
      learnerDecision: decision,
      updatedAt: timestamp,
    };
    this.repository.saveSessionStep({ progress, expectedProgressRevision: current.revision, weaknesses: writes });
    return this.requireProgress(sessionId);
  }

  async submitTargetedPractice(sessionId: string, learnerText: string, modality: DifficultyState['modality'] = 'written'): Promise<StoredSessionProgress> {
    const current = this.requirePhase(sessionId, 'targeted_practice');
    const proposal = await this.provider.proposeCorrection({ learnerText });
    return this.savePracticeStep(current, learnerText, proposal, 'remediation', 'transfer', 'Ahora usa la misma habilidad para dar un consejo a un amigo sobre una situación futura distinta.', modality);
  }

  async submitSessionText(sessionId: string, learnerText: string, modality: DifficultyState['modality'] = 'written'): Promise<StoredSessionProgress> {
    switch (this.requireProgress(sessionId).phase) {
      case 'production':
        return this.submitSessionProduction(sessionId, learnerText, modality);
      case 'targeted_practice':
        return this.submitTargetedPractice(sessionId, learnerText, modality);
      case 'transfer':
        return this.submitTransfer(sessionId, learnerText, modality);
      default:
        throw new SessionWorkflowError('This phase does not accept a written response.');
    }
  }

  async submitTransfer(sessionId: string, learnerText: string, modality: DifficultyState['modality'] = 'written'): Promise<StoredSessionProgress> {
    const current = this.requirePhase(sessionId, 'transfer');
    const proposal = await this.provider.proposeCorrection({ learnerText });
    const timestamp = this.now().toISOString();
    const reviews: ReviewRecord[] = current.weaknessIds.map((weaknessId) => ({
      id: `review-${this.createId()}`,
      weaknessId,
      dueAt: addHours(timestamp, 72),
    }));
    const difficulty = this.adjustForProposal(current, proposal);
    const progress: SessionProgressRecord = {
      ...current,
      phase: 'summary',
      prompt: reviews.length
        ? `Sesión completa. Se programaron ${reviews.length} revisión(es) para dentro de 72 horas.`
        : 'Sesión completa. No se inventó una debilidad cuando no hubo evidencia específica.',
      response: learnerText,
      proposal,
      updatedAt: timestamp,
      difficulty: { ...difficulty.state, modality },
      difficultyReason: difficulty.reason,
    };
    this.repository.saveSessionStep({
      progress,
      expectedProgressRevision: current.revision,
      weaknesses: this.practiceWrites(current, learnerText, proposal, 'transfer', timestamp),
      reviews,
      setting: { key: 'difficultyState', value: { ...difficulty.state, modality }, updatedAt: timestamp },
    });
    return this.requireProgress(sessionId);
  }

  completeFifteenMinuteSession(sessionId: string): StoredSessionProgress {
    const current = this.requirePhase(sessionId, 'summary');
    const timestamp = this.now().toISOString();
    const session = this.repository.getSession(sessionId);
    if (!session) throw new SessionWorkflowError('The session is no longer available.');
    const progress: SessionProgressRecord = { ...current, phase: 'completed', prompt: 'Sesión terminada. Tu progreso y las revisiones programadas están guardados.', updatedAt: timestamp };
    this.repository.saveSessionStep({
      session: { ...session, status: 'completed', completedAt: timestamp, summary: `${current.weaknessIds.length} weakness(es) practiced; learner decision: ${current.learnerDecision ?? 'none'}.` },
      progress,
      expectedProgressRevision: current.revision,
    });
    return this.requireProgress(sessionId);
  }

  async analyzeProduction(learnerText: string): Promise<AnalysisResult> {
    const proposal = await this.provider.proposeCorrection({ learnerText });
    const timestamp = this.now().toISOString();
    const sessionId = `session-${this.createId()}`;
    const session: SessionRecord = { id: sessionId, mode: 'normal', status: 'completed', startedAt: timestamp, completedAt: timestamp, summary: `${proposal.issues.length} correction proposal(s) awaiting learner review.` };
    const built = this.buildDetectionWrites(proposal, learnerText, sessionId, timestamp);
    this.repository.saveAnalysis(session, built.writes);
    return { sessionId, weaknessIds: built.weaknessIds, proposal };
  }

  private savePracticeStep(current: StoredSessionProgress, learnerText: string, proposal: CorrectionProposal, purpose: EvidencePurpose, nextPhase: SessionProgressRecord['phase'], nextPrompt: string, modality: DifficultyState['modality']): StoredSessionProgress {
    const timestamp = this.now().toISOString();
    const difficulty = this.adjustForProposal(current, proposal);
    const difficultyState = { ...difficulty.state, modality };
    const progress: SessionProgressRecord = { ...current, phase: nextPhase, prompt: nextPrompt, response: learnerText, proposal, updatedAt: timestamp, difficulty: difficultyState, difficultyReason: difficulty.reason };
    this.repository.saveSessionStep({ progress, expectedProgressRevision: current.revision, weaknesses: this.practiceWrites(current, learnerText, proposal, purpose, timestamp), setting: { key: 'difficultyState', value: difficultyState, updatedAt: timestamp } });
    return this.requireProgress(current.sessionId);
  }

  private practiceWrites(current: StoredSessionProgress, learnerText: string, proposal: CorrectionProposal, purpose: EvidencePurpose, timestamp: string): readonly WeaknessWrite[] {
    return current.weaknessIds.map((weaknessId) => {
      const stored = this.repository.getWeaknessRecord(weaknessId);
      if (!stored) throw new SessionWorkflowError('The selected weakness is no longer available.');
      const issue = proposal.issues[0];
      const event = this.createEvidence({
        weaknessId,
        sessionId: current.sessionId,
        timestamp,
        purpose,
        disposition: issue ? 'uncertain' : 'correct',
        activity: purpose,
        contextKey: `${purpose}:${current.sessionId}`,
        expected: issue?.replacement ?? 'No specific correction proposed.',
        observed: learnerText,
        validationSource: 'model_only',
        confidence: issue?.confidence ?? 0.5,
        proposal,
        issue,
      });
      return { record: recordEvidence(stored, event), expectedRevision: stored.revision };
    });
  }

  private buildDetectionWrites(proposal: CorrectionProposal, learnerText: string, sessionId: string, timestamp: string): { weaknessIds: readonly string[]; writes: readonly WeaknessWrite[] } {
    const weaknessIds: string[] = [];
    const writes = new Map<string, WeaknessWrite>();
    for (const issue of proposal.issues) {
      const weaknessId = weaknessIdFor(issue.category, issue.referenceIds[0]);
      const event = this.createEvidence({ weaknessId, sessionId, timestamp, purpose: 'detection', disposition: 'uncertain', activity: 'production', contextKey: `free-production:${issue.category}`, expected: issue.replacement, observed: issue.span || learnerText, validationSource: 'model_only', confidence: issue.confidence, proposal, issue });
      const pending = writes.get(weaknessId);
      const stored = pending ? undefined : this.repository.getWeaknessRecord(weaknessId);
      if (pending) {
        writes.set(weaknessId, { record: recordEvidence(pending.record, event), expectedRevision: pending.expectedRevision });
      } else if (stored) {
        writes.set(weaknessId, { record: recordEvidence(stored, event), expectedRevision: stored.revision });
      } else {
        const record: WeaknessRecord = {
          weakness: { id: weaknessId, category: issue.category, featureKey: issue.referenceIds[0] ?? issue.category, state: 'suspected', confidence: issue.confidence, severity: 3, communicativeImpact: 3, firstDetectedAt: timestamp, lastObservedAt: timestamp, recurrenceCount: 0, sourceActivityId: event.activityId, referenceIds: issue.referenceIds, mexicanSpanishNotes: proposal.mexicanSpanishNotes },
          evidence: [event],
        };
        writes.set(weaknessId, { record, expectedRevision: 0 });
      }
      if (!weaknessIds.includes(weaknessId)) weaknessIds.push(weaknessId);
    }
    return { weaknessIds, writes: [...writes.values()] };
  }

  private createEvidence(input: { weaknessId: string; sessionId: string; timestamp: string; purpose: EvidencePurpose; disposition: EvidenceDisposition; activity: string; contextKey: string; expected: string; observed: string; validationSource: EvidenceEvent['validationSource']; confidence: number; proposal?: CorrectionProposal; issue?: CorrectionProposal['issues'][number] }): EvidenceEvent {
    return {
      id: `evidence-${this.createId()}`,
      occurredAt: input.timestamp,
      weaknessId: input.weaknessId,
      sessionId: input.sessionId,
      activityId: `${input.activity}-${input.sessionId}`,
      purpose: input.purpose,
      disposition: input.disposition,
      validationSource: input.validationSource,
      confidence: input.confidence,
      contextKey: input.contextKey,
      supportLevel: input.purpose === 'transfer' ? 'none' : 'minimal',
      expectedBehavior: input.expected,
      observedBehavior: input.observed,
      referenceIds: input.issue?.referenceIds ?? [],
      modelProposal: input.proposal && input.issue ? { correctedText: input.proposal.correctedText, issueCategory: input.issue.category, explanation: input.issue.explanation, promptVersion: correctionPromptVersion } : undefined,
      validatorResult: {
        status: 'needs_review',
        referenceIds: input.issue?.referenceIds ?? [],
        explanation: input.validationSource === 'learner_reviewed'
          ? 'Learner decision recorded; it is not independent linguistic verification.'
          : 'Model proposal recorded; linguistic correctness is not independently verified.',
      },
    };
  }

  private updateProgress(current: StoredSessionProgress, changes: Pick<SessionProgressRecord, 'phase' | 'prompt'>): StoredSessionProgress {
    const progress = { ...current, ...changes, updatedAt: this.now().toISOString() };
    this.repository.saveSessionStep({ progress, expectedProgressRevision: current.revision });
    return this.requireProgress(current.sessionId);
  }

  private requireProgress(sessionId: string): StoredSessionProgress {
    const progress = this.repository.getSessionProgress(sessionId);
    if (!progress) throw new SessionWorkflowError('The session is no longer available.');
    return progress;
  }

  private requirePhase(sessionId: string, phase: SessionProgressRecord['phase']): StoredSessionProgress {
    const progress = this.requireProgress(sessionId);
    if (progress.phase !== phase) throw new SessionWorkflowError(`This action requires the ${phase} phase.`);
    return progress;
  }

  private adjustForProposal(current: StoredSessionProgress, proposal: CorrectionProposal) {
    return adjustDifficulty(
      current.difficulty ?? defaultDifficulty,
      proposal.issues.length === 0 ? 'ready_to_increase' : 'needs_support',
    );
  }

  private chooseNextActivity(timestamp: string): {
    dueReview?: ReviewRecord;
    targetWeaknessId?: string;
    explanation: string;
  } {
    const dueReview = this.repository.dueReviews(timestamp)[0];
    if (dueReview) {
      return {
        dueReview,
        targetWeaknessId: dueReview.weaknessId,
        explanation: 'Selected because this weakness has a delayed review due now.',
      };
    }
    const completedFifteenMinute = this.repository.countCompletedFifteenMinuteSessions();
    const priority = this.repository.highestPriorityWeakness();
    if (priority && completedFifteenMinute % 3 !== 2) {
      return {
        targetWeaknessId: priority.id,
        explanation: `Selected ${priority.featureKey} because it is the highest-impact active weakness.`,
      };
    }
    return {
      explanation: priority
        ? 'Selected broader diagnostic practice to prevent narrow weakness work from crowding out C1 range.'
        : 'Selected diagnostic practice because no active weakness has enough evidence yet.',
    };
  }

  private toAssessmentView(assessment: StoredAssessmentRecord): AssessmentView {
    const payload = assessment.profile as ActiveAssessmentPayload | CompletedAssessmentPayload;
    const validProgress = payload && ['progress', 'report'].includes(payload.type) && isAssessmentProgress(payload.progress);
    const validStatus = assessment.status === 'active' ? payload?.type === 'progress' : payload?.type === 'report';
    const validLifecycle = validProgress && (assessment.status === 'active'
      ? payload.progress.currentIndex < payload.progress.steps.length
      : payload.progress.currentIndex === payload.progress.steps.length);
    const validReport = payload?.type !== 'report' || (
      isAssessmentProfile(payload.profile)
      && (payload.comparison === undefined || isProfileComparison(payload.comparison))
    );
    if (!validProgress || !validStatus || !validLifecycle || !validReport) {
      throw new SessionWorkflowError('Stored assessment data is invalid or uses an unsupported rubric version.');
    }
    return {
      id: assessment.id,
      kind: assessment.kind,
      status: assessment.status,
      startedAt: assessment.startedAt,
      completedAt: assessment.completedAt,
      revision: assessment.revision,
      progress: payload.progress,
      profile: payload.type === 'report' ? payload.profile : undefined,
      comparison: payload.type === 'report' ? payload.comparison : undefined,
    };
  }

  private tryAssessmentView(assessment: StoredAssessmentRecord): AssessmentView | undefined {
    try {
      return this.toAssessmentView(assessment);
    } catch (error) {
      if (error instanceof SessionWorkflowError) return undefined;
      throw error;
    }
  }

  private hasUnsupportedRubric(assessment: StoredAssessmentRecord): boolean {
    const payload = assessment.profile;
    if (typeof payload !== 'object' || payload === null || !('progress' in payload)) return false;
    const progress = payload.progress;
    return typeof progress === 'object' && progress !== null && 'rubricVersion' in progress
      && typeof progress.rubricVersion === 'string'
      && progress.rubricVersion !== assessmentRubricVersion;
  }
}
