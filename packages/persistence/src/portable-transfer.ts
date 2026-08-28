import { createHash } from 'node:crypto';
import { existsSync, statSync } from 'node:fs';
import { z } from 'zod';
import { correctionProposalSchema } from '../../ai-provider/src/schemas.js';
import { assessmentRubricVersion, isAssessmentProfile, isAssessmentProgress, isProfileComparison } from '../../domain/src/assessment.js';
import { SpanishC1Repository } from './repository.js';

export const applicationVersion = '0.2.0' as const;
export const schemaVersion = 5 as const;
export const maximumImportBytes = 256 * 1_024 * 1_024;

export const transferTables = [
  'sessions',
  'session_progress',
  'weaknesses',
  'evidence_events',
  'weakness_control_events',
  'reviews',
  'settings',
  'assessments',
] as const;

export type TransferTable = (typeof transferTables)[number];
export type TransferData = Readonly<Record<TransferTable, readonly Record<string, unknown>[]>>;

export interface ExportDocumentV2 {
  readonly formatVersion: 2;
  readonly applicationVersion: typeof applicationVersion;
  readonly schemaVersion: typeof schemaVersion;
  readonly exportedAt: string;
  readonly data: TransferData;
}

export interface ParsedTransferDocument {
  readonly formatVersion: 1 | 2;
  readonly applicationVersion: string;
  readonly schemaVersion: number;
  readonly exportedAt: string;
  readonly data: TransferData;
}

export class PortableTransferError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortableTransferError';
  }
}

export const assertImportSize = (byteLength: number): void => {
  if (!Number.isSafeInteger(byteLength) || byteLength < 0 || byteLength > maximumImportBytes) {
    throw new PortableTransferError('The selected export exceeds the 256 MiB import limit.');
  }
};

const isoTimestamp = z.string().refine((value) => {
  try { return new Date(value).toISOString() === value; }
  catch { return false; }
}, 'Expected a canonical UTC ISO timestamp.');
const nullableString = z.string().nullable();
const nullableTimestamp = isoTimestamp.nullable();
const jsonString = z.string().refine((value) => {
  try { JSON.parse(value); return true; } catch { return false; }
}, 'Expected valid JSON text.');
const jsonMatching = (schema: z.ZodType): z.ZodType<string> => z.string().refine((value) => {
  try { return schema.safeParse(JSON.parse(value)).success; } catch { return false; }
}, 'Expected compatible JSON data.');
const nullableJsonMatching = (schema: z.ZodType) => z.string().nullable().refine((value) => value === null || (() => {
  try { return schema.safeParse(JSON.parse(value)).success; } catch { return false; }
})(), 'Expected compatible JSON data.');
const stringArrayJson = jsonMatching(z.array(z.string()));
const difficultyJson = nullableJsonMatching(z.object({
  linguisticComplexity: z.number().int().min(1).max(5), taskOpenness: z.number().int().min(1).max(5),
  timePressure: z.number().int().min(1).max(5), lexicalSupport: z.number().int().min(0).max(3),
  grammaticalHints: z.number().int().min(0).max(3), simultaneousTargets: z.number().int().min(1).max(3),
  topicFamiliarity: z.number().int().min(1).max(5), taskMode: z.enum(['comprehension', 'production']),
  modality: z.enum(['written', 'spoken']),
}).strict());
const evidenceProposalJson = nullableJsonMatching(z.object({
  correctedText: z.string(), issueCategory: z.string(), explanation: z.string(), promptVersion: z.string(),
}).strict());
const validatorResultJson = jsonMatching(z.object({
  status: z.enum(['accepted', 'rejected', 'needs_review']), referenceIds: z.array(z.string()), explanation: z.string(),
}).strict());
const preservedLegacyAssessment = z.object({
  type: z.enum(['progress', 'report']),
  progress: z.object({ rubricVersion: z.string().min(1) }).passthrough(),
}).passthrough().refine((payload) => payload.progress.rubricVersion !== assessmentRubricVersion);
const assessmentPayloadJson = nullableJsonMatching(z.unknown().refine((value) => {
  if (preservedLegacyAssessment.safeParse(value).success) return true;
  if (!value || typeof value !== 'object') return false;
  const payload = value as { type?: unknown; progress?: unknown; profile?: unknown; comparison?: unknown };
  if (payload.type === 'progress') return isAssessmentProgress(payload.progress);
  return payload.type === 'report' && isAssessmentProgress(payload.progress) && isAssessmentProfile(payload.profile)
    && (payload.comparison === undefined || isProfileComparison(payload.comparison));
}));

const rowSchemas = {
  sessions: z.object({
    id: z.string().min(1), mode: z.enum(['normal', 'fifteen_minute']), status: z.enum(['active', 'completed', 'abandoned']),
    started_at: isoTimestamp, completed_at: nullableTimestamp, summary: nullableString,
  }).strict(),
  session_progress: z.object({
    session_id: z.string().min(1), phase: z.enum(['warmup', 'production', 'repair', 'targeted_practice', 'transfer', 'summary', 'completed']),
    selection_reason: z.enum(['due_review', 'diagnostic']), target_weakness_id: nullableString, prompt: z.string(), response: nullableString,
    proposal_json: nullableJsonMatching(correctionProposalSchema),
    weakness_ids_json: stringArrayJson, learner_decision: z.enum(['agree', 'disagree', 'unclear', 'defer']).nullable(),
    started_at: isoTimestamp, updated_at: isoTimestamp, revision: z.number().int().min(1), selection_explanation: nullableString,
    difficulty_json: difficultyJson,
    difficulty_reason: nullableString,
  }).strict(),
  weaknesses: z.object({
    id: z.string().min(1), category: z.string().min(1), feature_key: z.string().min(1),
    state: z.enum(['suspected', 'confirmed', 'remediating', 'provisional', 'verified', 'resurfaced']),
    confidence: z.number().min(0).max(1), severity: z.number().int().min(1).max(5), communicative_impact: z.number().int().min(1).max(5),
    first_detected_at: isoTimestamp, last_observed_at: isoTimestamp, recurrence_count: z.number().int().min(0), source_activity_id: z.string().min(1),
    next_review_at: nullableTimestamp, reference_ids_json: stringArrayJson, mexican_notes_json: stringArrayJson, revision: z.number().int().min(1),
    is_paused: z.number().int().min(0).max(1),
  }).strict(),
  evidence_events: z.object({
    id: z.string().min(1), occurred_at: isoTimestamp, weakness_id: z.string().min(1), session_id: z.string().min(1), activity_id: z.string().min(1),
    purpose: z.enum(['detection', 'remediation', 'transfer', 'delayed_verification', 'recurrence']),
    disposition: z.enum(['correct', 'incorrect', 'uncertain', 'learner_disagreed']),
    validation_source: z.enum(['model_only', 'deterministic', 'reference_backed', 'learner_reviewed']),
    confidence: z.number().min(0).max(1), context_key: z.string(), support_level: z.enum(['guided', 'minimal', 'none']),
    expected_behavior: z.string(), observed_behavior: z.string(), reference_ids_json: stringArrayJson,
    model_proposal_json: evidenceProposalJson,
    validator_result_json: validatorResultJson,
  }).strict(),
  weakness_control_events: z.object({
    id: z.string().min(1), weakness_id: z.string().min(1), occurred_at: isoTimestamp,
    action: z.enum(['paused', 'reopened']), reason: z.string(),
  }).strict(),
  reviews: z.object({
    id: z.string().min(1), weakness_id: z.string().min(1), due_at: isoTimestamp,
    completed_at: nullableTimestamp, outcome: z.enum(['correct', 'incorrect', 'deferred']).nullable(),
  }).strict(),
  settings: z.object({ key: z.string().min(1), value_json: jsonString, updated_at: isoTimestamp }).strict(),
  assessments: z.object({
    id: z.string().min(1), kind: z.enum(['baseline', 'checkpoint']), status: z.enum(['active', 'completed']),
    started_at: isoTimestamp, completed_at: nullableTimestamp, profile_json: assessmentPayloadJson,
    revision: z.number().int().min(1),
  }).strict(),
} satisfies Record<TransferTable, z.ZodType<Record<string, unknown>>>;

const dataSchema = z.object(Object.fromEntries(
  transferTables.map((table) => [table, z.array(rowSchemas[table])]),
) as unknown as Record<TransferTable, z.ZodType<Record<string, unknown>[]>>).strict();

const versionOneSchema = z.object({ formatVersion: z.literal(1), exportedAt: isoTimestamp, data: dataSchema }).strict();
const versionTwoSchema = z.object({
  formatVersion: z.literal(2), applicationVersion: z.literal(applicationVersion), schemaVersion: z.literal(schemaVersion), exportedAt: isoTimestamp, data: dataSchema,
}).strict();

export const validateTransferData = (data: unknown): TransferData => {
  const result = dataSchema.safeParse(data);
  if (!result.success) throw new PortableTransferError('The stored rows are invalid or incompatible.');
  return result.data;
};

const stableValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, stableValue(item)]));
  return value;
};

export const hashBytes = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

export const snapshotCounts = (data: TransferData): Readonly<Record<TransferTable, number>> =>
  Object.fromEntries(transferTables.map((table) => [table, data[table].length])) as Record<TransferTable, number>;

export const fingerprintData = (data: TransferData): string => {
  const canonical = Object.fromEntries(transferTables.map((table) => [
    table,
    [...data[table]].map((row) => stableValue(row)).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right))),
  ]));
  return hashBytes(Buffer.from(JSON.stringify(canonical)));
};

export const fingerprintRepository = (repository: SpanishC1Repository): string =>
  fingerprintData(repository.exportSnapshot() as TransferData);

export const parseTransferBytes = (bytes: Uint8Array): ParsedTransferDocument => {
  assertImportSize(bytes.byteLength);
  let raw: unknown;
  try { raw = JSON.parse(Buffer.from(bytes).toString('utf8')); }
  catch { throw new PortableTransferError('The selected file is not valid JSON.'); }
  const version = typeof raw === 'object' && raw !== null ? (raw as { formatVersion?: unknown }).formatVersion : undefined;
  if (version === 1) {
    const result = versionOneSchema.safeParse(raw);
    if (!result.success) throw new PortableTransferError('The export structure is invalid or incompatible.');
    return { ...result.data, applicationVersion: '0.1.0', schemaVersion };
  }
  if (version === 2) {
    const result = versionTwoSchema.safeParse(raw);
    if (!result.success) throw new PortableTransferError('The export structure is invalid or incompatible.');
    return result.data;
  }
  throw new PortableTransferError('The export format version is unsupported.');
};

const insertOrder: readonly TransferTable[] = ['sessions', 'weaknesses', 'session_progress', 'evidence_events', 'weakness_control_events', 'reviews', 'settings', 'assessments'];

export const buildDatabaseFromTransfer = (document: ParsedTransferDocument, destination: string, activeDataRoot: string): void => {
  if (existsSync(destination)) throw new PortableTransferError('The staging database already exists.');
  const repository = new SpanishC1Repository(destination);
  try {
    repository.database.exec('BEGIN IMMEDIATE');
    try {
      for (const table of insertOrder) {
        for (const rawRow of document.data[table]) {
          if (table === 'settings' && rawRow.key === 'activeDataRoot') continue;
          const columns = Object.keys(rawRow);
          const statement = repository.database.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`);
          statement.run(...columns.map((column) => rawRow[column] as string | number | null));
        }
      }
      repository.database.exec('COMMIT');
    } catch (error) {
      repository.database.exec('ROLLBACK');
      throw error;
    }
    repository.setSetting('activeDataRoot', activeDataRoot);
    repository.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  } catch (error) {
    throw new PortableTransferError('The export could not be loaded into a compatible Spanish C1 database.');
  } finally {
    repository.close();
  }
  if (!statSync(destination).isFile()) throw new PortableTransferError('The staged database was not created.');
};

export const createExportDocument = (repository: SpanishC1Repository, now = new Date().toISOString()): ExportDocumentV2 => ({
  formatVersion: 2,
  applicationVersion,
  schemaVersion,
  exportedAt: now,
  data: repository.exportSnapshot() as TransferData,
});
