import type { DatabaseSync } from 'node:sqlite';

interface Migration {
  readonly version: number;
  readonly sql: string;
}

const migrations: readonly Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE sessions (
        id TEXT PRIMARY KEY,
        mode TEXT NOT NULL CHECK (mode IN ('normal', 'fifteen_minute')),
        status TEXT NOT NULL CHECK (status IN ('active', 'completed', 'abandoned')),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        summary TEXT
      ) STRICT;

      CREATE TABLE weaknesses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        feature_key TEXT NOT NULL,
        state TEXT NOT NULL CHECK (state IN ('suspected', 'confirmed', 'remediating', 'provisional', 'verified', 'resurfaced')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        severity INTEGER NOT NULL CHECK (severity BETWEEN 1 AND 5),
        communicative_impact INTEGER NOT NULL CHECK (communicative_impact BETWEEN 1 AND 5),
        first_detected_at TEXT NOT NULL,
        last_observed_at TEXT NOT NULL,
        recurrence_count INTEGER NOT NULL CHECK (recurrence_count >= 0),
        source_activity_id TEXT NOT NULL,
        next_review_at TEXT,
        reference_ids_json TEXT NOT NULL,
        mexican_notes_json TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 1)
      ) STRICT;

      CREATE TABLE evidence_events (
        id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        weakness_id TEXT NOT NULL REFERENCES weaknesses(id),
        session_id TEXT NOT NULL REFERENCES sessions(id),
        activity_id TEXT NOT NULL,
        purpose TEXT NOT NULL CHECK (purpose IN ('detection', 'remediation', 'transfer', 'delayed_verification', 'recurrence')),
        disposition TEXT NOT NULL CHECK (disposition IN ('correct', 'incorrect', 'uncertain', 'learner_disagreed')),
        validation_source TEXT NOT NULL CHECK (validation_source IN ('model_only', 'deterministic', 'reference_backed', 'learner_reviewed')),
        confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
        context_key TEXT NOT NULL,
        support_level TEXT NOT NULL CHECK (support_level IN ('guided', 'minimal', 'none')),
        expected_behavior TEXT NOT NULL,
        observed_behavior TEXT NOT NULL,
        reference_ids_json TEXT NOT NULL
      ) STRICT;

      CREATE TRIGGER evidence_events_no_update
      BEFORE UPDATE ON evidence_events
      BEGIN
        SELECT RAISE(ABORT, 'evidence events are append-only');
      END;

      CREATE TRIGGER evidence_events_no_delete
      BEFORE DELETE ON evidence_events
      BEGIN
        SELECT RAISE(ABORT, 'evidence events are append-only');
      END;

      CREATE TABLE reviews (
        id TEXT PRIMARY KEY,
        weakness_id TEXT NOT NULL REFERENCES weaknesses(id),
        due_at TEXT NOT NULL,
        completed_at TEXT,
        outcome TEXT CHECK (outcome IS NULL OR outcome IN ('correct', 'incorrect', 'deferred'))
      ) STRICT;

      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      CREATE TABLE assessments (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('baseline', 'checkpoint')),
        status TEXT NOT NULL CHECK (status IN ('active', 'completed')),
        started_at TEXT NOT NULL,
        completed_at TEXT,
        profile_json TEXT
      ) STRICT;

      CREATE INDEX evidence_events_weakness_time
        ON evidence_events(weakness_id, occurred_at);
      CREATE INDEX reviews_due
        ON reviews(due_at, completed_at);
    `,
  },
  {
    version: 2,
    sql: `
      ALTER TABLE evidence_events ADD COLUMN model_proposal_json TEXT;
      ALTER TABLE evidence_events ADD COLUMN validator_result_json TEXT NOT NULL
        DEFAULT '{"status":"needs_review","referenceIds":[],"explanation":"Legacy evidence requires review."}';
    `,
  },
  {
    version: 3,
    sql: `
      CREATE TABLE session_progress (
        session_id TEXT PRIMARY KEY REFERENCES sessions(id),
        phase TEXT NOT NULL CHECK (phase IN ('warmup', 'production', 'repair', 'targeted_practice', 'transfer', 'summary', 'completed')),
        selection_reason TEXT NOT NULL CHECK (selection_reason IN ('due_review', 'diagnostic')),
        target_weakness_id TEXT REFERENCES weaknesses(id),
        prompt TEXT NOT NULL,
        response TEXT,
        proposal_json TEXT,
        weakness_ids_json TEXT NOT NULL,
        learner_decision TEXT CHECK (learner_decision IS NULL OR learner_decision IN ('agree', 'disagree', 'unclear', 'defer')),
        started_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK (revision >= 1)
      ) STRICT;
    `,
  },
  {
    version: 4,
    sql: `
      ALTER TABLE weaknesses ADD COLUMN is_paused INTEGER NOT NULL DEFAULT 0
        CHECK (is_paused IN (0, 1));
      ALTER TABLE session_progress ADD COLUMN selection_explanation TEXT;
      ALTER TABLE session_progress ADD COLUMN difficulty_json TEXT;
      ALTER TABLE session_progress ADD COLUMN difficulty_reason TEXT;

      CREATE TABLE weakness_control_events (
        id TEXT PRIMARY KEY,
        weakness_id TEXT NOT NULL REFERENCES weaknesses(id),
        occurred_at TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('paused', 'reopened')),
        reason TEXT NOT NULL
      ) STRICT;

      CREATE TRIGGER weakness_control_events_no_update
      BEFORE UPDATE ON weakness_control_events
      BEGIN
        SELECT RAISE(ABORT, 'weakness control events are append-only');
      END;

      CREATE TRIGGER weakness_control_events_no_delete
      BEFORE DELETE ON weakness_control_events
      BEGIN
        SELECT RAISE(ABORT, 'weakness control events are append-only');
      END;

      CREATE INDEX weakness_priority
        ON weaknesses(is_paused, communicative_impact DESC, severity DESC, recurrence_count DESC);
    `,
  },
  {
    version: 5,
    sql: `
      ALTER TABLE assessments ADD COLUMN revision INTEGER NOT NULL DEFAULT 1
        CHECK (revision >= 1);
      CREATE INDEX assessments_kind_time ON assessments(kind, started_at DESC);
    `,
  },
];

export const migrateDatabase = (database: DatabaseSync): number => {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    ) STRICT;
  `);

  const current = database
    .prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations')
    .get() as { version: number };

  for (const migration of migrations) {
    if (migration.version <= current.version) continue;
    database.exec('BEGIN IMMEDIATE');
    try {
      database.exec(migration.sql);
      database
        .prepare('INSERT INTO schema_migrations(version, applied_at) VALUES (?, ?)')
        .run(migration.version, new Date().toISOString());
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }

  return migrations.at(-1)?.version ?? 0;
};
