import type { IssueCategory, ReferenceId } from '../../references/src/catalog.js';

export const weaknessStates = [
  'suspected',
  'confirmed',
  'remediating',
  'provisional',
  'verified',
  'resurfaced',
] as const;

export type WeaknessState = (typeof weaknessStates)[number];
export type SupportLevel = 'guided' | 'minimal' | 'none';
export type EvidencePurpose =
  | 'detection'
  | 'remediation'
  | 'transfer'
  | 'delayed_verification'
  | 'recurrence';
export type EvidenceDisposition = 'correct' | 'incorrect' | 'uncertain' | 'learner_disagreed';
export type ValidationSource = 'model_only' | 'deterministic' | 'reference_backed' | 'learner_reviewed';

export interface EvidenceModelProposal {
  readonly correctedText: string;
  readonly issueCategory: string;
  readonly explanation: string;
  readonly promptVersion: string;
}

export interface EvidenceValidatorResult {
  readonly status: 'accepted' | 'rejected' | 'needs_review';
  readonly referenceIds: readonly ReferenceId[];
  readonly explanation: string;
}

export interface EvidenceEvent {
  readonly id: string;
  readonly occurredAt: string;
  readonly weaknessId: string;
  readonly sessionId: string;
  readonly activityId: string;
  readonly purpose: EvidencePurpose;
  readonly disposition: EvidenceDisposition;
  readonly validationSource: ValidationSource;
  readonly confidence: number;
  readonly contextKey: string;
  readonly supportLevel: SupportLevel;
  readonly expectedBehavior: string;
  readonly observedBehavior: string;
  readonly referenceIds: readonly ReferenceId[];
  readonly modelProposal?: EvidenceModelProposal;
  readonly validatorResult: EvidenceValidatorResult;
}

export interface Weakness {
  readonly id: string;
  readonly category: IssueCategory;
  readonly featureKey: string;
  readonly state: WeaknessState;
  readonly confidence: number;
  readonly severity: 1 | 2 | 3 | 4 | 5;
  readonly communicativeImpact: 1 | 2 | 3 | 4 | 5;
  readonly firstDetectedAt: string;
  readonly lastObservedAt: string;
  readonly recurrenceCount: number;
  readonly sourceActivityId: string;
  readonly nextReviewAt?: string;
  readonly referenceIds: readonly ReferenceId[];
  readonly mexicanSpanishNotes: readonly string[];
  readonly isPaused?: boolean;
}

export interface WeaknessRecord {
  readonly weakness: Weakness;
  readonly evidence: readonly EvidenceEvent[];
}

export interface VerificationPolicy {
  readonly minimumDelayHours: number;
  readonly provisionalReviewDelayHours: number;
  readonly verifiedReviewDelayHours: number;
  readonly maximumVerificationSupport: Exclude<SupportLevel, 'guided'>;
}

export const defaultVerificationPolicy: VerificationPolicy = {
  minimumDelayHours: 72,
  provisionalReviewDelayHours: 72,
  verifiedReviewDelayHours: 336,
  maximumVerificationSupport: 'minimal',
};
