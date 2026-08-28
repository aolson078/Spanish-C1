import { describe, expect, it } from 'vitest';
import { recordEvidence, WeaknessTransitionError } from './weakness-engine.js';
import type { EvidenceEvent, WeaknessRecord } from './weakness.js';

const start = '2026-08-01T12:00:00.000Z';

const initialRecord = (): WeaknessRecord => ({
  weakness: {
    id: 'weakness-1',
    category: 'grammar.conditional.si_clause',
    featureKey: 'conditional.present_hypothetical',
    state: 'suspected',
    confidence: 0.6,
    severity: 3,
    communicativeImpact: 3,
    firstDetectedAt: start,
    lastObservedAt: start,
    recurrenceCount: 0,
    sourceActivityId: 'activity-1',
    referenceIds: ['conditional.present_hypothetical'],
    mexicanSpanishNotes: [],
  },
  evidence: [],
});

const evidence = (overrides: Partial<EvidenceEvent> = {}): EvidenceEvent => ({
  id: 'evidence-1',
  occurredAt: '2026-08-01T12:01:00.000Z',
  weaknessId: 'weakness-1',
  sessionId: 'session-1',
  activityId: 'activity-1',
  purpose: 'detection',
  disposition: 'incorrect',
  validationSource: 'model_only',
  confidence: 0.8,
  contextKey: 'travel-hypothetical',
  supportLevel: 'guided',
  expectedBehavior: 'Use imperfect subjunctive in a hypothetical si-clause.',
  observedBehavior: 'Used conditional in both clauses.',
  referenceIds: ['conditional.present_hypothetical'],
  validatorResult: {
    status: 'needs_review',
    referenceIds: ['conditional.present_hypothetical'],
    explanation: 'Model-only evidence requires review or repetition.',
  },
  ...overrides,
});

describe('weakness lifecycle', () => {
  it('does not confirm a weakness from one model-only judgment', () => {
    const result = recordEvidence(initialRecord(), evidence());

    expect(result.weakness.state).toBe('suspected');
    expect(result.evidence).toHaveLength(1);
  });

  it('confirms from independent repeated evidence while retaining both events', () => {
    const first = recordEvidence(initialRecord(), evidence());
    const second = recordEvidence(
      first,
      evidence({
        id: 'evidence-2',
        occurredAt: '2026-08-02T12:01:00.000Z',
        sessionId: 'session-2',
        contextKey: 'career-hypothetical',
      }),
    );

    expect(second.weakness.state).toBe('confirmed');
    expect(second.evidence.map((item) => item.id)).toEqual(['evidence-1', 'evidence-2']);
  });

  it('allows high-confidence deterministic evidence to confirm immediately', () => {
    const result = recordEvidence(
      initialRecord(),
      evidence({ validationSource: 'deterministic', confidence: 0.95 }),
    );

    expect(result.weakness.state).toBe('confirmed');
  });

  it('requires remediation, transfer, delay, changed context, and reduced support before verification', () => {
    let record = recordEvidence(
      initialRecord(),
      evidence({ validationSource: 'reference_backed', confidence: 0.95 }),
    );
    record = recordEvidence(
      record,
      evidence({
        id: 'repair',
        occurredAt: '2026-08-01T12:10:00.000Z',
        purpose: 'remediation',
        disposition: 'correct',
      }),
    );
    expect(record.weakness.state).toBe('remediating');

    record = recordEvidence(
      record,
      evidence({
        id: 'transfer',
        occurredAt: '2026-08-01T12:20:00.000Z',
        purpose: 'transfer',
        disposition: 'correct',
        contextKey: 'career-hypothetical',
        supportLevel: 'guided',
      }),
    );
    expect(record.weakness.state).toBe('provisional');
    expect(record.weakness.nextReviewAt).toBe('2026-08-04T12:20:00.000Z');

    const immediate = recordEvidence(
      record,
      evidence({
        id: 'too-soon',
        occurredAt: '2026-08-01T13:20:00.000Z',
        purpose: 'delayed_verification',
        disposition: 'correct',
        contextKey: 'relationships-hypothetical',
        supportLevel: 'none',
      }),
    );
    expect(immediate.weakness.state).toBe('provisional');

    const verified = recordEvidence(
      record,
      evidence({
        id: 'delayed',
        occurredAt: '2026-08-05T12:20:00.000Z',
        purpose: 'delayed_verification',
        disposition: 'correct',
        contextKey: 'relationships-hypothetical',
        supportLevel: 'minimal',
      }),
    );
    expect(verified.weakness.state).toBe('verified');
    expect(verified.weakness.nextReviewAt).toBe('2026-08-19T12:20:00.000Z');
  });

  it('reopens a verified weakness when a materially similar error recurs', () => {
    const verified: WeaknessRecord = {
      ...initialRecord(),
      weakness: {
        ...initialRecord().weakness,
        state: 'verified',
        lastObservedAt: '2026-08-05T12:20:00.000Z',
        nextReviewAt: '2026-08-19T12:20:00.000Z',
      },
    };
    const result = recordEvidence(
      verified,
      evidence({
        id: 'recurrence',
        occurredAt: '2026-08-10T12:20:00.000Z',
        purpose: 'recurrence',
        disposition: 'incorrect',
      }),
    );

    expect(result.weakness.state).toBe('resurfaced');
    expect(result.weakness.recurrenceCount).toBe(1);
    expect(result.weakness.nextReviewAt).toBe('2026-08-10T12:20:00.000Z');
  });

  it('retains disagreement as evidence without changing state', () => {
    const result = recordEvidence(
      initialRecord(),
      evidence({ disposition: 'learner_disagreed', confidence: 0.99 }),
    );

    expect(result.weakness.state).toBe('suspected');
    expect(result.evidence[0]?.disposition).toBe('learner_disagreed');
  });

  it('rejects duplicate, mismatched, and out-of-order evidence', () => {
    const first = recordEvidence(initialRecord(), evidence());

    expect(() => recordEvidence(first, evidence())).toThrow(WeaknessTransitionError);
    expect(() =>
      recordEvidence(first, evidence({ id: 'other', weaknessId: 'weakness-2' })),
    ).toThrow('different weakness');
    expect(() =>
      recordEvidence(
        first,
        evidence({ id: 'old', occurredAt: '2026-07-01T12:00:00.000Z' }),
      ),
    ).toThrow('chronological order');
  });
});
