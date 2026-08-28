export interface SessionRecord {
  readonly id: string;
  readonly mode: 'normal' | 'fifteen_minute';
  readonly status: 'active' | 'completed' | 'abandoned';
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly summary?: string;
}

export const fifteenMinutePhases = [
  'warmup',
  'production',
  'repair',
  'targeted_practice',
  'transfer',
  'summary',
  'completed',
] as const;

export type FifteenMinutePhase = (typeof fifteenMinutePhases)[number];
export type LearnerDecision = 'agree' | 'disagree' | 'unclear' | 'defer';

export interface SessionProgressRecord {
  readonly sessionId: string;
  readonly phase: FifteenMinutePhase;
  readonly selectionReason: 'due_review' | 'diagnostic';
  readonly targetWeaknessId?: string;
  readonly prompt: string;
  readonly response?: string;
  readonly proposal?: unknown;
  readonly weaknessIds: readonly string[];
  readonly learnerDecision?: LearnerDecision;
  readonly startedAt: string;
  readonly updatedAt: string;
  readonly selectionExplanation?: string;
  readonly difficulty?: DifficultyState;
  readonly difficultyReason?: string;
}

export interface StoredSessionProgress extends SessionProgressRecord {
  readonly revision: number;
}

export interface WeaknessSummaryRecord {
  readonly id: string;
  readonly category: IssueCategory;
  readonly featureKey: string;
  readonly state: string;
  readonly confidence: number;
  readonly severity: number;
  readonly communicativeImpact: number;
  readonly recurrenceCount: number;
  readonly nextReviewAt?: string;
  readonly isPaused: boolean;
  readonly evidenceCount: number;
}

export interface WeaknessControlRecord {
  readonly id: string;
  readonly weaknessId: string;
  readonly occurredAt: string;
  readonly action: 'paused' | 'reopened';
  readonly reason: string;
}

export interface ReviewRecord {
  readonly id: string;
  readonly weaknessId: string;
  readonly dueAt: string;
  readonly completedAt?: string;
  readonly outcome?: 'correct' | 'incorrect' | 'deferred';
}

export interface AssessmentRecord {
  readonly id: string;
  readonly kind: 'baseline' | 'checkpoint';
  readonly status: 'active' | 'completed';
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly profile?: unknown;
}

export interface StoredAssessmentRecord extends AssessmentRecord {
  readonly revision: number;
}
import type { DifficultyState } from '../../domain/src/difficulty.js';
import type { IssueCategory } from '../../references/src/catalog.js';
