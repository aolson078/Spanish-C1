import type {
  EvidenceEvent,
  VerificationPolicy,
  Weakness,
  WeaknessRecord,
  WeaknessState,
} from './weakness.js';
import { defaultVerificationPolicy } from './weakness.js';

export class WeaknessTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WeaknessTransitionError';
  }
}

const addHours = (timestamp: string, hours: number): string => {
  const date = new Date(timestamp);
  date.setUTCHours(date.getUTCHours() + hours);
  return date.toISOString();
};

const hoursBetween = (earlier: string, later: string): number =>
  (Date.parse(later) - Date.parse(earlier)) / 3_600_000;

const supportRank = { none: 0, minimal: 1, guided: 2 } as const;

const assertEvent = (record: WeaknessRecord, event: EvidenceEvent): void => {
  if (event.weaknessId !== record.weakness.id) {
    throw new WeaknessTransitionError('Evidence belongs to a different weakness.');
  }
  if (record.evidence.some((existing) => existing.id === event.id)) {
    throw new WeaknessTransitionError('Evidence IDs must be unique and append-only.');
  }
  if (!Number.isFinite(event.confidence) || event.confidence < 0 || event.confidence > 1) {
    throw new WeaknessTransitionError('Evidence confidence must be between 0 and 1.');
  }
  if (!Number.isFinite(Date.parse(event.occurredAt))) {
    throw new WeaknessTransitionError('Evidence timestamp must be valid.');
  }
  if (Date.parse(event.occurredAt) < Date.parse(record.weakness.lastObservedAt)) {
    throw new WeaknessTransitionError('Evidence cannot be appended out of chronological order.');
  }
};

const confirmationIsSupported = (
  existing: readonly EvidenceEvent[],
  incoming: EvidenceEvent,
): boolean => {
  if (incoming.disposition !== 'incorrect') return false;
  const authoritative =
    incoming.confidence >= 0.9 &&
    ['deterministic', 'reference_backed'].includes(incoming.validationSource);
  const priorIndependentError = existing.some(
    (event) =>
      event.purpose === 'detection' &&
      event.disposition === 'incorrect' &&
      event.sessionId !== incoming.sessionId,
  );
  return authoritative || priorIndependentError;
};

const verificationIsSupported = (
  weakness: Weakness,
  evidence: readonly EvidenceEvent[],
  incoming: EvidenceEvent,
  policy: VerificationPolicy,
): boolean => {
  if (incoming.purpose !== 'delayed_verification' || incoming.disposition !== 'correct') return false;
  if (supportRank[incoming.supportLevel] > supportRank[policy.maximumVerificationSupport]) return false;

  const provisionalEvent = [...evidence]
    .reverse()
    .find((event) => event.purpose === 'transfer' && event.disposition === 'correct');
  if (!provisionalEvent) return false;
  return (
    hoursBetween(provisionalEvent.occurredAt, incoming.occurredAt) >= policy.minimumDelayHours &&
    incoming.contextKey !== provisionalEvent.contextKey &&
    weakness.state === 'provisional'
  );
};

const deriveState = (
  weakness: Weakness,
  existing: readonly EvidenceEvent[],
  incoming: EvidenceEvent,
  policy: VerificationPolicy,
): WeaknessState => {
  if (incoming.disposition === 'learner_disagreed' || incoming.disposition === 'uncertain') {
    return weakness.state;
  }

  switch (weakness.state) {
    case 'suspected':
      return confirmationIsSupported(existing, incoming) ? 'confirmed' : 'suspected';
    case 'confirmed':
      return incoming.purpose === 'remediation' ? 'remediating' : 'confirmed';
    case 'remediating':
      return incoming.purpose === 'transfer' && incoming.disposition === 'correct'
        ? 'provisional'
        : 'remediating';
    case 'provisional':
      if (verificationIsSupported(weakness, existing, incoming, policy)) return 'verified';
      return incoming.disposition === 'incorrect' ? 'remediating' : 'provisional';
    case 'verified':
      return incoming.disposition === 'incorrect' && incoming.purpose === 'recurrence'
        ? 'resurfaced'
        : 'verified';
    case 'resurfaced':
      return incoming.purpose === 'remediation' ? 'remediating' : 'resurfaced';
  }
};

export const recordEvidence = (
  record: WeaknessRecord,
  event: EvidenceEvent,
  policy: VerificationPolicy = defaultVerificationPolicy,
): WeaknessRecord => {
  assertEvent(record, event);
  const state = deriveState(record.weakness, record.evidence, event, policy);
  const becameProvisional = state === 'provisional' && record.weakness.state !== 'provisional';
  const becameVerified = state === 'verified' && record.weakness.state !== 'verified';
  const resurfaced = state === 'resurfaced' && record.weakness.state === 'verified';

  const nextReviewAt = becameProvisional
    ? addHours(event.occurredAt, policy.provisionalReviewDelayHours)
    : becameVerified
      ? addHours(event.occurredAt, policy.verifiedReviewDelayHours)
      : resurfaced
        ? event.occurredAt
        : record.weakness.nextReviewAt;

  return {
    weakness: {
      ...record.weakness,
      state,
      confidence: Math.max(record.weakness.confidence, event.confidence),
      lastObservedAt: event.occurredAt,
      recurrenceCount: record.weakness.recurrenceCount + (resurfaced ? 1 : 0),
      nextReviewAt,
    },
    evidence: [...record.evidence, event],
  };
};
