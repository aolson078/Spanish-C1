import { DatabaseSync } from 'node:sqlite';
import type { EvidenceEvent, Weakness, WeaknessRecord } from '../../domain/src/weakness.js';
import type { IssueCategory, ReferenceId } from '../../references/src/catalog.js';
import { migrateDatabase } from './migrations.js';
import type {
  AssessmentRecord,
  ReviewRecord,
  SessionProgressRecord,
  SessionRecord,
  StoredSessionProgress,
  StoredAssessmentRecord,
  WeaknessControlRecord,
  WeaknessSummaryRecord,
} from './models.js';

export class ConcurrentWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrentWriteError';
  }
}

export interface StoredWeaknessRecord extends WeaknessRecord {
  readonly revision: number;
}

export interface WeaknessWrite {
  readonly record: WeaknessRecord;
  readonly expectedRevision: number;
}

export interface SessionStepWrite {
  readonly session?: SessionRecord;
  readonly progress: SessionProgressRecord;
  readonly expectedProgressRevision: number;
  readonly weaknesses?: readonly WeaknessWrite[];
  readonly reviews?: readonly ReviewRecord[];
  readonly setting?: { readonly key: string; readonly value: unknown; readonly updatedAt: string };
}

const jsonArray = <T>(value: string): readonly T[] => JSON.parse(value) as readonly T[];

const mapWeakness = (row: Record<string, unknown>): Weakness => ({
  id: String(row.id),
  category: String(row.category) as IssueCategory,
  featureKey: String(row.feature_key),
  state: String(row.state) as Weakness['state'],
  confidence: Number(row.confidence),
  severity: Number(row.severity) as Weakness['severity'],
  communicativeImpact: Number(row.communicative_impact) as Weakness['communicativeImpact'],
  firstDetectedAt: String(row.first_detected_at),
  lastObservedAt: String(row.last_observed_at),
  recurrenceCount: Number(row.recurrence_count),
  sourceActivityId: String(row.source_activity_id),
  nextReviewAt: row.next_review_at === null ? undefined : String(row.next_review_at),
  referenceIds: jsonArray<ReferenceId>(String(row.reference_ids_json)),
  mexicanSpanishNotes: jsonArray<string>(String(row.mexican_notes_json)),
  isPaused: Boolean(row.is_paused),
});

const mapEvidence = (row: Record<string, unknown>): EvidenceEvent => ({
  id: String(row.id),
  occurredAt: String(row.occurred_at),
  weaknessId: String(row.weakness_id),
  sessionId: String(row.session_id),
  activityId: String(row.activity_id),
  purpose: String(row.purpose) as EvidenceEvent['purpose'],
  disposition: String(row.disposition) as EvidenceEvent['disposition'],
  validationSource: String(row.validation_source) as EvidenceEvent['validationSource'],
  confidence: Number(row.confidence),
  contextKey: String(row.context_key),
  supportLevel: String(row.support_level) as EvidenceEvent['supportLevel'],
  expectedBehavior: String(row.expected_behavior),
  observedBehavior: String(row.observed_behavior),
  referenceIds: jsonArray<ReferenceId>(String(row.reference_ids_json)),
  modelProposal:
    row.model_proposal_json === null || row.model_proposal_json === undefined
      ? undefined
      : (JSON.parse(String(row.model_proposal_json)) as EvidenceEvent['modelProposal']),
  validatorResult: JSON.parse(String(row.validator_result_json)) as EvidenceEvent['validatorResult'],
});

export class SpanishC1Repository implements Disposable {
  readonly database: DatabaseSync;

  constructor(readonly databasePath: string) {
    this.database = new DatabaseSync(databasePath, { enableForeignKeyConstraints: true });
    try {
      this.database.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;');
      migrateDatabase(this.database);
    } catch (error) {
      this.database.close();
      throw error;
    }
  }

  [Symbol.dispose](): void {
    this.close();
  }

  close(): void {
    this.database.close();
  }

  schemaVersion(): number {
    const row = this.database
      .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
      .get() as { version: number };
    return row.version;
  }

  saveSession(session: SessionRecord): void {
    this.database
      .prepare(`
        INSERT INTO sessions(id, mode, status, started_at, completed_at, summary)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status = excluded.status,
          completed_at = excluded.completed_at,
          summary = excluded.summary
      `)
      .run(
        session.id,
        session.mode,
        session.status,
        session.startedAt,
        session.completedAt ?? null,
        session.summary ?? null,
      );
  }

  getSession(id: string): SessionRecord | undefined {
    const row = this.database.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;
    return {
      id: String(row.id),
      mode: String(row.mode) as SessionRecord['mode'],
      status: String(row.status) as SessionRecord['status'],
      startedAt: String(row.started_at),
      completedAt: row.completed_at === null ? undefined : String(row.completed_at),
      summary: row.summary === null ? undefined : String(row.summary),
    };
  }

  listSessions(limit = 20): readonly SessionRecord[] {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('Session history limit must be between 1 and 100.');
    }
    const rows = this.database
      .prepare('SELECT * FROM sessions ORDER BY started_at DESC, id DESC LIMIT ?')
      .all(limit) as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      mode: String(row.mode) as SessionRecord['mode'],
      status: String(row.status) as SessionRecord['status'],
      startedAt: String(row.started_at),
      completedAt: row.completed_at === null ? undefined : String(row.completed_at),
      summary: row.summary === null ? undefined : String(row.summary),
    }));
  }

  countCompletedFifteenMinuteSessions(): number {
    const row = this.database
      .prepare(`
        SELECT COUNT(*) AS count FROM sessions
        WHERE mode = 'fifteen_minute' AND status = 'completed'
      `)
      .get() as { count: number };
    return Number(row.count);
  }

  saveWeaknessRecord(record: WeaknessRecord, expectedRevision: number): number {
    return this.runTransaction(() =>
      this.saveWeaknessRecordInTransaction(record, expectedRevision),
    );
  }

  saveAnalysis(session: SessionRecord, weaknesses: readonly WeaknessWrite[]): readonly number[] {
    return this.runTransaction(() => {
      this.saveSession(session);
      return weaknesses.map(({ record, expectedRevision }) =>
        this.saveWeaknessRecordInTransaction(record, expectedRevision),
      );
    });
  }

  saveSessionStep(write: SessionStepWrite): number {
    return this.runTransaction(() => {
      if (write.session) this.saveSession(write.session);
      for (const weakness of write.weaknesses ?? []) {
        this.saveWeaknessRecordInTransaction(weakness.record, weakness.expectedRevision);
      }
      for (const review of write.reviews ?? []) this.saveReview(review);
      if (write.setting) this.setSetting(write.setting.key, write.setting.value, write.setting.updatedAt);
      return this.saveSessionProgressInTransaction(
        write.progress,
        write.expectedProgressRevision,
      );
    });
  }

  getActiveSessionProgress(): StoredSessionProgress | undefined {
    const row = this.database
      .prepare(`
        SELECT p.* FROM session_progress p
        JOIN sessions s ON s.id = p.session_id
        WHERE s.status = 'active' AND p.phase <> 'completed'
        ORDER BY p.updated_at DESC, p.session_id DESC
        LIMIT 1
      `)
      .get() as Record<string, unknown> | undefined;
    return row ? this.mapSessionProgress(row) : undefined;
  }

  getSessionProgress(sessionId: string): StoredSessionProgress | undefined {
    const row = this.database
      .prepare('SELECT * FROM session_progress WHERE session_id = ?')
      .get(sessionId) as Record<string, unknown> | undefined;
    return row ? this.mapSessionProgress(row) : undefined;
  }

  private runTransaction<T>(action: () => T): T {
    this.database.exec('BEGIN IMMEDIATE');
    try {
      const result = action();
      this.database.exec('COMMIT');
      return result;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }

  private saveSessionProgressInTransaction(
    progress: SessionProgressRecord,
    expectedRevision: number,
  ): number {
    const nextRevision = expectedRevision + 1;
    if (expectedRevision === 0) {
      this.database
        .prepare(`
          INSERT INTO session_progress(
            session_id, phase, selection_reason, target_weakness_id, prompt, response,
            proposal_json, weakness_ids_json, learner_decision, started_at, updated_at, revision,
            selection_explanation, difficulty_json, difficulty_reason
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          progress.sessionId,
          progress.phase,
          progress.selectionReason,
          progress.targetWeaknessId ?? null,
          progress.prompt,
          progress.response ?? null,
          progress.proposal === undefined ? null : JSON.stringify(progress.proposal),
          JSON.stringify(progress.weaknessIds),
          progress.learnerDecision ?? null,
          progress.startedAt,
          progress.updatedAt,
          nextRevision,
          progress.selectionExplanation ?? null,
          progress.difficulty === undefined ? null : JSON.stringify(progress.difficulty),
          progress.difficultyReason ?? null,
        );
    } else {
      const result = this.database
        .prepare(`
          UPDATE session_progress SET
            phase = ?, prompt = ?, response = ?, proposal_json = ?, weakness_ids_json = ?,
            learner_decision = ?, updated_at = ?, revision = ?, selection_explanation = ?,
            difficulty_json = ?, difficulty_reason = ?
          WHERE session_id = ? AND revision = ?
        `)
        .run(
          progress.phase,
          progress.prompt,
          progress.response ?? null,
          progress.proposal === undefined ? null : JSON.stringify(progress.proposal),
          JSON.stringify(progress.weaknessIds),
          progress.learnerDecision ?? null,
          progress.updatedAt,
          nextRevision,
          progress.selectionExplanation ?? null,
          progress.difficulty === undefined ? null : JSON.stringify(progress.difficulty),
          progress.difficultyReason ?? null,
          progress.sessionId,
          expectedRevision,
        );
      if (result.changes !== 1) {
        throw new ConcurrentWriteError('Session changed after it was read; reload before retrying.');
      }
    }
    return nextRevision;
  }

  private mapSessionProgress(row: Record<string, unknown>): StoredSessionProgress {
    return {
      sessionId: String(row.session_id),
      phase: String(row.phase) as StoredSessionProgress['phase'],
      selectionReason: String(row.selection_reason) as StoredSessionProgress['selectionReason'],
      targetWeaknessId:
        row.target_weakness_id === null ? undefined : String(row.target_weakness_id),
      prompt: String(row.prompt),
      response: row.response === null ? undefined : String(row.response),
      proposal:
        row.proposal_json === null ? undefined : JSON.parse(String(row.proposal_json)),
      weaknessIds: jsonArray<string>(String(row.weakness_ids_json)),
      learnerDecision:
        row.learner_decision === null
          ? undefined
          : (String(row.learner_decision) as StoredSessionProgress['learnerDecision']),
      startedAt: String(row.started_at),
      updatedAt: String(row.updated_at),
      revision: Number(row.revision),
      selectionExplanation:
        row.selection_explanation === null ? undefined : String(row.selection_explanation),
      difficulty:
        row.difficulty_json === null
          ? undefined
          : (JSON.parse(String(row.difficulty_json)) as StoredSessionProgress['difficulty']),
      difficultyReason:
        row.difficulty_reason === null ? undefined : String(row.difficulty_reason),
    };
  }

  private saveWeaknessRecordInTransaction(
    record: WeaknessRecord,
    expectedRevision: number,
  ): number {
      const nextRevision = expectedRevision + 1;
      if (expectedRevision === 0) {
        this.database
          .prepare(`
            INSERT INTO weaknesses(
              id, category, feature_key, state, confidence, severity, communicative_impact,
              first_detected_at, last_observed_at, recurrence_count, source_activity_id,
              next_review_at, reference_ids_json, mexican_notes_json, revision
              , is_paused
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `)
          .run(
            record.weakness.id,
            record.weakness.category,
            record.weakness.featureKey,
            record.weakness.state,
            record.weakness.confidence,
            record.weakness.severity,
            record.weakness.communicativeImpact,
            record.weakness.firstDetectedAt,
            record.weakness.lastObservedAt,
            record.weakness.recurrenceCount,
            record.weakness.sourceActivityId,
            record.weakness.nextReviewAt ?? null,
            JSON.stringify(record.weakness.referenceIds),
            JSON.stringify(record.weakness.mexicanSpanishNotes),
            nextRevision,
            record.weakness.isPaused ? 1 : 0,
          );
      } else {
        const result = this.database
          .prepare(`
            UPDATE weaknesses SET
              state = ?, confidence = ?, last_observed_at = ?, recurrence_count = ?,
              next_review_at = ?, reference_ids_json = ?, mexican_notes_json = ?, revision = ?
              , is_paused = ?
            WHERE id = ? AND revision = ?
          `)
          .run(
            record.weakness.state,
            record.weakness.confidence,
            record.weakness.lastObservedAt,
            record.weakness.recurrenceCount,
            record.weakness.nextReviewAt ?? null,
            JSON.stringify(record.weakness.referenceIds),
            JSON.stringify(record.weakness.mexicanSpanishNotes),
            nextRevision,
            record.weakness.isPaused ? 1 : 0,
            record.weakness.id,
            expectedRevision,
          );
        if (result.changes !== 1) {
          throw new ConcurrentWriteError('Weakness changed after it was read; reload before retrying.');
        }
      }

      const insertEvidence = this.database.prepare(`
        INSERT INTO evidence_events(
          id, occurred_at, weakness_id, session_id, activity_id, purpose, disposition,
          validation_source, confidence, context_key, support_level, expected_behavior,
          observed_behavior, reference_ids_json, model_proposal_json, validator_result_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const existingIds = new Set(
        (
          this.database
            .prepare('SELECT id FROM evidence_events WHERE weakness_id = ?')
            .all(record.weakness.id) as { id: string }[]
        ).map((row) => row.id),
      );
      for (const event of record.evidence) {
        if (existingIds.has(event.id)) continue;
        insertEvidence.run(
          event.id,
          event.occurredAt,
          event.weaknessId,
          event.sessionId,
          event.activityId,
          event.purpose,
          event.disposition,
          event.validationSource,
          event.confidence,
          event.contextKey,
          event.supportLevel,
          event.expectedBehavior,
          event.observedBehavior,
          JSON.stringify(event.referenceIds),
          event.modelProposal === undefined ? null : JSON.stringify(event.modelProposal),
          JSON.stringify(event.validatorResult),
        );
      }
      return nextRevision;
  }

  getWeaknessRecord(id: string): StoredWeaknessRecord | undefined {
    const row = this.database.prepare('SELECT * FROM weaknesses WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) return undefined;
    const evidenceRows = this.database
      .prepare('SELECT * FROM evidence_events WHERE weakness_id = ? ORDER BY occurred_at, id')
      .all(id) as Record<string, unknown>[];
    return {
      weakness: mapWeakness(row),
      evidence: evidenceRows.map(mapEvidence),
      revision: Number(row.revision),
    };
  }

  listWeaknessSummaries(): readonly WeaknessSummaryRecord[] {
    const rows = this.database
      .prepare(`
        SELECT w.*, COUNT(e.id) AS evidence_count
        FROM weaknesses w
        LEFT JOIN evidence_events e ON e.weakness_id = w.id
        GROUP BY w.id
        ORDER BY w.is_paused, w.communicative_impact DESC, w.severity DESC,
          w.recurrence_count DESC, w.last_observed_at DESC, w.id
      `)
      .all() as Record<string, unknown>[];
    return rows.map((row) => ({
      id: String(row.id),
      category: String(row.category) as IssueCategory,
      featureKey: String(row.feature_key),
      state: String(row.state),
      confidence: Number(row.confidence),
      severity: Number(row.severity),
      communicativeImpact: Number(row.communicative_impact),
      recurrenceCount: Number(row.recurrence_count),
      nextReviewAt: row.next_review_at === null ? undefined : String(row.next_review_at),
      isPaused: Boolean(row.is_paused),
      evidenceCount: Number(row.evidence_count),
    }));
  }

  highestPriorityWeakness(): WeaknessSummaryRecord | undefined {
    return this.listWeaknessSummaries().find(
      (weakness) => !weakness.isPaused && weakness.state !== 'verified',
    );
  }

  setWeaknessPaused(control: WeaknessControlRecord, expectedRevision: number): void {
    this.runTransaction(() => {
      const isPaused = control.action === 'paused';
      const update = this.database
        .prepare(`
          UPDATE weaknesses SET is_paused = ?, revision = revision + 1
          WHERE id = ? AND revision = ? AND is_paused <> ?
        `)
        .run(isPaused ? 1 : 0, control.weaknessId, expectedRevision, isPaused ? 1 : 0);
      if (update.changes !== 1) {
        throw new ConcurrentWriteError('Weakness changed or already has that control state.');
      }
      this.database
        .prepare(`
          INSERT INTO weakness_control_events(id, weakness_id, occurred_at, action, reason)
          VALUES (?, ?, ?, ?, ?)
        `)
        .run(control.id, control.weaknessId, control.occurredAt, control.action, control.reason);
    });
  }

  listWeaknessControls(weaknessId: string): readonly WeaknessControlRecord[] {
    return (
      this.database
        .prepare('SELECT * FROM weakness_control_events WHERE weakness_id = ? ORDER BY occurred_at, id')
        .all(weaknessId) as Record<string, unknown>[]
    ).map((row) => ({
      id: String(row.id),
      weaknessId: String(row.weakness_id),
      occurredAt: String(row.occurred_at),
      action: String(row.action) as WeaknessControlRecord['action'],
      reason: String(row.reason),
    }));
  }

  saveReview(review: ReviewRecord): void {
    this.database
      .prepare(`
        INSERT INTO reviews(id, weakness_id, due_at, completed_at, outcome)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET completed_at = excluded.completed_at, outcome = excluded.outcome
      `)
      .run(
        review.id,
        review.weaknessId,
        review.dueAt,
        review.completedAt ?? null,
        review.outcome ?? null,
      );
  }

  dueReviews(asOf: string): readonly ReviewRecord[] {
    return (
      this.database
        .prepare(`
          SELECT r.* FROM reviews r
          JOIN weaknesses w ON w.id = r.weakness_id
          WHERE r.completed_at IS NULL AND r.due_at <= ? AND w.is_paused = 0
          ORDER BY r.due_at, r.id
        `)
        .all(asOf) as Record<string, unknown>[]
    ).map((row) => ({
      id: String(row.id),
      weaknessId: String(row.weakness_id),
      dueAt: String(row.due_at),
    }));
  }

  setSetting(key: string, value: unknown, updatedAt = new Date().toISOString()): void {
    this.database
      .prepare(`
        INSERT INTO settings(key, value_json, updated_at) VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at
      `)
      .run(key, JSON.stringify(value), updatedAt);
  }

  getSetting<T>(key: string): T | undefined {
    const row = this.database.prepare('SELECT value_json FROM settings WHERE key = ?').get(key) as
      | { value_json: string }
      | undefined;
    return row ? (JSON.parse(row.value_json) as T) : undefined;
  }

  saveAssessment(assessment: AssessmentRecord, expectedRevision = 0): number {
    const nextRevision = expectedRevision + 1;
    if (expectedRevision === 0) {
      this.database
        .prepare(`
          INSERT INTO assessments(id, kind, status, started_at, completed_at, profile_json, revision)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `)
        .run(
          assessment.id,
          assessment.kind,
          assessment.status,
          assessment.startedAt,
          assessment.completedAt ?? null,
          assessment.profile === undefined ? null : JSON.stringify(assessment.profile),
          nextRevision,
        );
    } else {
      const result = this.database
        .prepare(`
          UPDATE assessments SET status = ?, completed_at = ?, profile_json = ?, revision = ?
          WHERE id = ? AND revision = ?
        `)
        .run(
          assessment.status,
          assessment.completedAt ?? null,
          assessment.profile === undefined ? null : JSON.stringify(assessment.profile),
          nextRevision,
          assessment.id,
          expectedRevision,
        );
      if (result.changes !== 1) {
        throw new ConcurrentWriteError('Assessment changed after it was read; reload before retrying.');
      }
    }
    return nextRevision;
  }

  getAssessment(id: string): StoredAssessmentRecord | undefined {
    const row = this.database.prepare('SELECT * FROM assessments WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    return row ? this.mapAssessment(row) : undefined;
  }

  getActiveAssessment(): StoredAssessmentRecord | undefined {
    const row = this.database
      .prepare(`
        SELECT * FROM assessments WHERE status = 'active'
        ORDER BY started_at DESC, id DESC LIMIT 1
      `)
      .get() as Record<string, unknown> | undefined;
    return row ? this.mapAssessment(row) : undefined;
  }

  listAssessments(): readonly StoredAssessmentRecord[] {
    return (
      this.database.prepare('SELECT * FROM assessments ORDER BY started_at DESC, id DESC').all() as Record<string, unknown>[]
    ).map((row) => this.mapAssessment(row));
  }

  private mapAssessment(row: Record<string, unknown>): StoredAssessmentRecord {
    return {
      id: String(row.id),
      kind: String(row.kind) as AssessmentRecord['kind'],
      status: String(row.status) as AssessmentRecord['status'],
      startedAt: String(row.started_at),
      completedAt: row.completed_at === null ? undefined : String(row.completed_at),
      profile: row.profile_json === null ? undefined : JSON.parse(String(row.profile_json)),
      revision: Number(row.revision),
    };
  }

  exportSnapshot(): Record<string, readonly Record<string, unknown>[]> {
    const tables = ['sessions', 'session_progress', 'weaknesses', 'evidence_events', 'weakness_control_events', 'reviews', 'settings', 'assessments'];
    return Object.fromEntries(
      tables.map((table) => [table, this.database.prepare(`SELECT * FROM ${table}`).all()]),
    );
  }
}
