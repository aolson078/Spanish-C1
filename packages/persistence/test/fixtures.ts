import type { EvidenceEvent, WeaknessRecord } from '../../domain/src/weakness.js';

export const session = {
  id: 'session-1',
  mode: 'fifteen_minute',
  status: 'active',
  startedAt: '2026-08-24T12:00:00.000Z',
} as const;

export const event = (overrides: Partial<EvidenceEvent> = {}): EvidenceEvent => ({
  id: 'evidence-1',
  occurredAt: '2026-08-24T12:01:00.000Z',
  weaknessId: 'weakness-1',
  sessionId: session.id,
  activityId: 'activity-1',
  purpose: 'detection',
  disposition: 'incorrect',
  validationSource: 'reference_backed',
  confidence: 0.95,
  contextKey: 'travel-hypothetical',
  supportLevel: 'guided',
  expectedBehavior: 'Use the imperfect subjunctive.',
  observedBehavior: 'Used the conditional.',
  referenceIds: ['conditional.present_hypothetical'],
  modelProposal: {
    correctedText: 'Si tuviera más tiempo, viajaría más.',
    issueCategory: 'grammar.conditional.si_clause',
    explanation: 'Use the imperfect subjunctive.',
    promptVersion: 'correction.v1',
  },
  validatorResult: {
    status: 'accepted',
    referenceIds: ['conditional.present_hypothetical'],
    explanation: 'Matched a curated conditional reference.',
  },
  ...overrides,
});

export const weaknessRecord = (events: readonly EvidenceEvent[] = [event()]): WeaknessRecord => ({
  weakness: {
    id: 'weakness-1',
    category: 'grammar.conditional.si_clause',
    featureKey: 'conditional.present_hypothetical',
    state: 'confirmed',
    confidence: 0.95,
    severity: 3,
    communicativeImpact: 3,
    firstDetectedAt: '2026-08-24T12:01:00.000Z',
    lastObservedAt: events.at(-1)?.occurredAt ?? '2026-08-24T12:01:00.000Z',
    recurrenceCount: 0,
    sourceActivityId: 'activity-1',
    nextReviewAt: '2026-08-27T12:01:00.000Z',
    referenceIds: ['conditional.present_hypothetical'],
    mexicanSpanishNotes: [],
    isPaused: false,
  },
  evidence: events,
});
