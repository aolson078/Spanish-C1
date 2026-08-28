import { afterEach, describe, expect, it } from 'vitest';
import { ConcurrentWriteError, SpanishC1Repository } from '../src/repository.js';
import { event, session, weaknessRecord } from './fixtures.js';
import { createTestDataRoot, removeTestDataRoot } from './test-root.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeTestDataRoot(root);
});

describe('SQLite repository', () => {
  it('migrates idempotently and preserves sessions across close and reopen', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const first = new SpanishC1Repository(paths.database);
    expect(first.schemaVersion()).toBe(5);
    first.saveSession(session);
    first.close();

    const reopened = new SpanishC1Repository(paths.database);
    expect(reopened.schemaVersion()).toBe(5);
    expect(reopened.getSession(session.id)).toEqual(session);
    reopened.close();
  });

  it('persists a weakness with ordered append-only evidence', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);

    const revision = repository.saveWeaknessRecord(weaknessRecord(), 0);
    const saved = repository.getWeaknessRecord('weakness-1');

    expect(revision).toBe(1);
    expect(saved).toEqual({ ...weaknessRecord(), revision: 1 });
    expect(() =>
      repository.database
        .prepare('UPDATE evidence_events SET observed_behavior = ? WHERE id = ?')
        .run('rewritten', 'evidence-1'),
    ).toThrow('append-only');
    expect(() =>
      repository.database.prepare('DELETE FROM evidence_events WHERE id = ?').run('evidence-1'),
    ).toThrow('append-only');
    expect(repository.getWeaknessRecord('weakness-1')?.evidence[0]?.observedBehavior).toBe(
      'Used the conditional.',
    );
  });

  it('rolls back a stale writer rather than losing the current update', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using writerA = new SpanishC1Repository(paths.database);
    using writerB = new SpanishC1Repository(paths.database);
    writerA.saveSession(session);
    writerA.saveWeaknessRecord(weaknessRecord(), 0);
    const stale = writerB.getWeaknessRecord('weakness-1');
    expect(stale?.revision).toBe(1);

    const nextEvent = event({
      id: 'evidence-2',
      occurredAt: '2026-08-25T12:01:00.000Z',
      sessionId: session.id,
      purpose: 'remediation',
      disposition: 'correct',
    });
    const current = weaknessRecord([event(), nextEvent]);
    writerA.saveWeaknessRecord(current, 1);

    expect(() => writerB.saveWeaknessRecord(stale!, 1)).toThrow(ConcurrentWriteError);
    expect(writerA.getWeaknessRecord('weakness-1')).toMatchObject({
      revision: 2,
      evidence: [{ id: 'evidence-1' }, { id: 'evidence-2' }],
    });
  });

  it('stores due reviews, settings, and assessment state', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);
    repository.saveWeaknessRecord(weaknessRecord(), 0);
    repository.saveReview({
      id: 'review-1',
      weaknessId: 'weakness-1',
      dueAt: '2026-08-27T12:01:00.000Z',
    });
    repository.setSetting('activeDataRoot', paths.root, '2026-08-24T12:00:00.000Z');
    repository.saveAssessment({
      id: 'assessment-1',
      kind: 'baseline',
      status: 'active',
      startedAt: '2026-08-24T12:00:00.000Z',
      profile: { grammaticalControl: { confidence: 0.4 } },
    });

    expect(repository.dueReviews('2026-08-28T00:00:00.000Z')).toEqual([
      {
        id: 'review-1',
        weaknessId: 'weakness-1',
        dueAt: '2026-08-27T12:01:00.000Z',
      },
    ]);
    expect(repository.getSetting('activeDataRoot')).toBe(paths.root);
    expect(repository.exportSnapshot().assessments).toHaveLength(1);
  });

  it('rejects a stale assessment response without overwriting current progress', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using writerA = new SpanishC1Repository(paths.database);
    using writerB = new SpanishC1Repository(paths.database);
    const assessment = {
      id: 'assessment-concurrent',
      kind: 'baseline' as const,
      status: 'active' as const,
      startedAt: '2026-08-24T12:00:00.000Z',
      profile: { type: 'progress', currentIndex: 0 },
    };
    writerA.saveAssessment(assessment, 0);
    const stale = writerB.getAssessment(assessment.id)!;
    writerA.saveAssessment({ ...assessment, profile: { type: 'progress', currentIndex: 1 } }, 1);

    expect(() => writerB.saveAssessment({
      ...stale,
      profile: { type: 'progress', currentIndex: 2 },
    }, stale.revision)).toThrow(ConcurrentWriteError);
    expect(writerA.getAssessment(assessment.id)).toMatchObject({
      revision: 2,
      profile: { currentIndex: 1 },
    });
  });

  it('rejects a stale session transition without overwriting current progress', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using writerA = new SpanishC1Repository(paths.database);
    using writerB = new SpanishC1Repository(paths.database);
    const activeSession = { ...session, mode: 'fifteen_minute' as const, status: 'active' as const };
    const warmup = {
      sessionId: session.id,
      phase: 'warmup' as const,
      selectionReason: 'diagnostic' as const,
      prompt: 'Warm up.',
      weaknessIds: [],
      startedAt: session.startedAt,
      updatedAt: session.startedAt,
    };
    writerA.saveSessionStep({ session: activeSession, progress: warmup, expectedProgressRevision: 0 });
    const stale = writerB.getSessionProgress(session.id)!;
    writerA.saveSessionStep({
      progress: { ...warmup, phase: 'production', prompt: 'Produce.', updatedAt: '2026-08-24T12:01:00.000Z' },
      expectedProgressRevision: 1,
    });

    expect(() => writerB.saveSessionStep({
      progress: { ...stale, phase: 'repair', prompt: 'Stale repair.', updatedAt: '2026-08-24T12:02:00.000Z' },
      expectedProgressRevision: stale.revision,
    })).toThrow(ConcurrentWriteError);
    expect(writerA.getSessionProgress(session.id)).toMatchObject({ phase: 'production', revision: 2 });
  });

  it('rolls back evidence and progress when review scheduling fails', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const activeSession = { ...session, mode: 'fifteen_minute' as const, status: 'active' as const };
    const progress = {
      sessionId: session.id,
      phase: 'transfer' as const,
      selectionReason: 'diagnostic' as const,
      prompt: 'Transfer.',
      weaknessIds: ['weakness-1'],
      startedAt: session.startedAt,
      updatedAt: session.startedAt,
    };
    repository.saveSession(activeSession);
    repository.saveWeaknessRecord(weaknessRecord(), 0);
    repository.saveSessionStep({ progress, expectedProgressRevision: 0 });
    const transferEvent = event({
      id: 'evidence-2',
      occurredAt: '2026-08-24T13:00:00.000Z',
      purpose: 'transfer',
      disposition: 'correct',
    });

    expect(() => repository.saveSessionStep({
      progress: { ...progress, phase: 'summary', prompt: 'Summary.', updatedAt: transferEvent.occurredAt },
      expectedProgressRevision: 1,
      weaknesses: [{ record: weaknessRecord([event(), transferEvent]), expectedRevision: 1 }],
      reviews: [{ id: 'bad-review', weaknessId: 'missing-weakness', dueAt: '2026-08-27T13:00:00.000Z' }],
    })).toThrow(/FOREIGN KEY constraint failed/);
    expect(repository.getWeaknessRecord('weakness-1')).toMatchObject({ revision: 1, evidence: [{ id: 'evidence-1' }] });
    expect(repository.getSessionProgress(session.id)).toMatchObject({ phase: 'transfer', revision: 1 });
    expect(repository.exportSnapshot().reviews).toEqual([]);
  });

  it('pauses and reopens activity selection with append-only control evidence', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);
    repository.saveWeaknessRecord(weaknessRecord(), 0);
    repository.saveReview({
      id: 'review-paused',
      weaknessId: 'weakness-1',
      dueAt: '2026-08-24T12:00:00.000Z',
    });

    repository.setWeaknessPaused({
      id: 'control-pause',
      weaknessId: 'weakness-1',
      occurredAt: '2026-08-24T12:02:00.000Z',
      action: 'paused',
      reason: 'Learner paused automatic activity selection.',
    }, 1);
    expect(repository.listWeaknessSummaries()[0]).toMatchObject({ isPaused: true, evidenceCount: 1 });
    expect(repository.dueReviews('2026-08-24T13:00:00.000Z')).toEqual([]);
    expect(() => repository.setWeaknessPaused({
      id: 'control-stale',
      weaknessId: 'weakness-1',
      occurredAt: '2026-08-24T12:02:30.000Z',
      action: 'paused',
      reason: 'Stale duplicate.',
    }, 1)).toThrow(ConcurrentWriteError);
    expect(repository.listWeaknessControls('weakness-1')).toHaveLength(1);
    expect(() => repository.database.prepare(
      'UPDATE weakness_control_events SET reason = ? WHERE id = ?',
    ).run('changed', 'control-pause')).toThrow('append-only');

    repository.setWeaknessPaused({
      id: 'control-reopen',
      weaknessId: 'weakness-1',
      occurredAt: '2026-08-24T12:03:00.000Z',
      action: 'reopened',
      reason: 'Learner reopened automatic activity selection.',
    }, 2);
    expect(repository.listWeaknessControls('weakness-1').map((control) => control.action)).toEqual([
      'paused',
      'reopened',
    ]);
    expect(repository.dueReviews('2026-08-24T13:00:00.000Z')).toHaveLength(1);
  });

  it('rolls back pause state when its control event cannot be inserted', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);
    repository.saveWeaknessRecord(weaknessRecord(), 0);
    repository.setWeaknessPaused({
      id: 'control-duplicate',
      weaknessId: 'weakness-1',
      occurredAt: '2026-08-24T12:02:00.000Z',
      action: 'paused',
      reason: 'Pause.',
    }, 1);

    expect(() => repository.setWeaknessPaused({
      id: 'control-duplicate',
      weaknessId: 'weakness-1',
      occurredAt: '2026-08-24T12:03:00.000Z',
      action: 'reopened',
      reason: 'Duplicate ID forces rollback.',
    }, 2)).toThrow(/UNIQUE constraint failed/);
    expect(repository.getWeaknessRecord('weakness-1')).toMatchObject({
      revision: 2,
      weakness: { isPaused: true },
    });
    expect(repository.listWeaknessControls('weakness-1')).toEqual([
      expect.objectContaining({ id: 'control-duplicate', action: 'paused' }),
    ]);
  });
});
