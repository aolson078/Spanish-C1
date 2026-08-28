import { randomUUID } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, renameSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { DataPaths } from '../../packages/persistence/src/data-root.js';
import { backupRepository, validateRepositoryBackup } from '../../packages/persistence/src/portable-files.js';
import { buildDatabaseFromTransfer, fingerprintRepository, hashBytes, maximumImportBytes, parseTransferBytes, snapshotCounts, validateTransferData, type ParsedTransferDocument, type TransferTable } from '../../packages/persistence/src/portable-transfer.js';
import { SpanishC1Repository } from '../../packages/persistence/src/repository.js';
import { readBoundedRegularFile } from './bounded-file.js';

export type RecoveryOperationState = 'idle' | 'previewing' | 'committing' | 'reconciling';

export interface DataPreview {
  readonly token: string;
  readonly kind: 'import' | 'restore';
  readonly displayName: string;
  readonly createdAt: string;
  readonly formatVersion: number;
  readonly schemaVersion: number;
  readonly currentCounts: Readonly<Record<TransferTable, number>>;
  readonly incomingCounts: Readonly<Record<TransferTable, number>>;
  readonly expiresAt: string;
}

export interface RecoveryResult {
  readonly kind: 'import' | 'restore';
  readonly safetyBackup: string;
  readonly operationId: string;
}

interface PreviewRecord {
  readonly preview: DataPreview;
  readonly bytes?: Buffer;
  readonly sourceHash?: string;
  readonly document?: ParsedTransferDocument;
  readonly currentFingerprint: string;
  readonly expiresAtMs: number;
}

interface FamilyMember {
  readonly suffix: '' | '-wal' | '-shm';
  readonly hash: string;
}

interface RecoveryManifest {
  readonly formatVersion: 1;
  readonly operationId: string;
  readonly kind: 'import' | 'restore';
  readonly createdAt: string;
  readonly sourceFingerprint: string;
  readonly candidateHash: string;
  readonly safetyBackup?: string;
  readonly originalFamily: readonly FamilyMember[];
  phase: 'prepared' | 'swapped' | 'completed' | 'rolled_back';
}

export interface RecoveryCoordinatorOptions {
  readonly now?: () => Date;
  readonly createId?: () => string;
  readonly fault?: (point: string) => void;
}

export class RecoveryCoordinatorError extends Error {
  constructor(message: string, readonly repositoryClosed = false) {
    super(message);
    this.name = 'RecoveryCoordinatorError';
  }
}

const tokenLifetimeMs = 10 * 60_000;
const operationIdPattern = /^[a-f0-9-]{16,64}$/;
const familySuffixes = ['', '-wal', '-shm'] as const;
const hashPattern = /^[a-f0-9]{64}$/;
const manifestSchema = z.object({
  formatVersion: z.literal(1), operationId: z.string().regex(operationIdPattern), kind: z.enum(['import', 'restore']),
  createdAt: z.string(), sourceFingerprint: z.union([z.string().regex(hashPattern), z.literal('unavailable')]),
  candidateHash: z.string().regex(hashPattern), safetyBackup: z.string().optional(),
  originalFamily: z.array(z.object({ suffix: z.enum(familySuffixes), hash: z.string().regex(hashPattern) }).strict()).max(3),
  phase: z.enum(['prepared', 'swapped', 'completed', 'rolled_back']),
}).strict().refine((manifest) => new Set(manifest.originalFamily.map((member) => member.suffix)).size === manifest.originalFamily.length);

const fileHash = (file: string): string => hashBytes(readFileSync(file));

const flushJson = (destination: string, value: unknown): void => {
  const temporary = `${destination}.tmp`;
  writeFileSync(temporary, JSON.stringify(value, null, 2), { encoding: 'utf8', flag: 'wx', flush: true });
  renameSync(temporary, destination);
};

export const verifyRecoveryDatabase = (databasePath: string): { fingerprint: string; counts: Readonly<Record<TransferTable, number>> } => {
  using repository = new SpanishC1Repository(databasePath);
  const quickCheck = repository.database.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined;
  if (quickCheck?.quick_check !== 'ok' || repository.schemaVersion() !== 5) throw new RecoveryCoordinatorError('The candidate database failed integrity checks.');
  if (repository.database.prepare('PRAGMA foreign_key_check').all().length > 0) throw new RecoveryCoordinatorError('The candidate database has broken references.');
  const snapshot = validateTransferData(repository.exportSnapshot()) as Record<TransferTable, readonly Record<string, unknown>[]>;
  return { fingerprint: fingerprintRepository(repository), counts: snapshotCounts(snapshot) };
};

const manifestPath = (paths: DataPaths, operationId: string): string => path.join(paths.recovery, operationId, 'manifest.json');
const operationPath = (paths: DataPaths, operationId: string): string => path.join(paths.recovery, operationId);
const rollbackPath = (paths: DataPaths, operationId: string, suffix: string): string => path.join(operationPath(paths, operationId), `original.sqlite${suffix}`);
const candidatePath = (paths: DataPaths, operationId: string): string => path.join(operationPath(paths, operationId), 'candidate.sqlite');
const previewCandidatePath = (paths: DataPaths, token: string): string => path.join(paths.recovery, 'previews', `${token}.sqlite`);

export class RecoveryCoordinator {
  private readonly now: () => Date;
  private readonly createId: () => string;
  private readonly fault: (point: string) => void;
  private readonly previews = new Map<string, PreviewRecord>();
  private state: RecoveryOperationState = 'idle';

  constructor(private readonly repository: SpanishC1Repository, private readonly paths: DataPaths, options: RecoveryCoordinatorOptions = {}) {
    this.now = options.now ?? (() => new Date());
    this.createId = options.createId ?? randomUUID;
    this.fault = options.fault ?? (() => undefined);
  }

  get operationState(): RecoveryOperationState { return this.state; }

  previewImport(bytes: Buffer, displayName: string): DataPreview {
    if (bytes.byteLength > maximumImportBytes) throw new RecoveryCoordinatorError('The selected export exceeds the 256 MiB import limit.');
    const document = parseTransferBytes(bytes);
    const token = this.createId();
    if (!operationIdPattern.test(token)) throw new RecoveryCoordinatorError('Could not create a safe preview identifier.');
    mkdirSync(path.join(this.paths.recovery, 'previews'), { recursive: true });
    const candidate = previewCandidatePath(this.paths, token);
    buildDatabaseFromTransfer(document, candidate, this.paths.root);
    const incoming = verifyRecoveryDatabase(candidate);
    return this.storePreview({ kind: 'import', displayName, createdAt: document.exportedAt, formatVersion: document.formatVersion, schemaVersion: document.schemaVersion }, { bytes, document, incomingCounts: incoming.counts }, token);
  }

  previewBackup(id: string): DataPreview {
    const source = validateRepositoryBackup(this.paths, id);
    const metadata = statSync(source);
    if (metadata.size > maximumImportBytes) throw new RecoveryCoordinatorError('The selected backup exceeds the 256 MiB recovery limit.');
    const bytes = readBoundedRegularFile(source, maximumImportBytes);
    const token = this.createId();
    if (!operationIdPattern.test(token)) throw new RecoveryCoordinatorError('Could not create a safe preview identifier.');
    mkdirSync(path.join(this.paths.recovery, 'previews'), { recursive: true });
    const candidate = previewCandidatePath(this.paths, token);
    writeFileSync(candidate, bytes, { flag: 'wx' });
    const incoming = verifyRecoveryDatabase(candidate);
    return this.storePreview({ kind: 'restore', displayName: id, createdAt: metadata.mtime.toISOString(), formatVersion: 1, schemaVersion: 5 }, { bytes, incomingCounts: incoming.counts }, token);
  }

  private storePreview(
    summary: Pick<DataPreview, 'kind' | 'displayName' | 'createdAt' | 'formatVersion' | 'schemaVersion'>,
    source: { readonly bytes?: Buffer; readonly document?: ParsedTransferDocument; readonly incomingCounts?: Readonly<Record<TransferTable, number>> },
    token: string,
  ): DataPreview {
    if (this.state !== 'idle') throw new RecoveryCoordinatorError('Recovery is already active.');
    this.state = 'previewing';
    try {
      const expiresAtMs = this.now().getTime() + tokenLifetimeMs;
      const current = this.repository.exportSnapshot() as Record<TransferTable, readonly Record<string, unknown>[]>;
      const preview: DataPreview = {
        token,
        ...summary,
        currentCounts: snapshotCounts(current),
        incomingCounts: source.incomingCounts ?? snapshotCounts(source.document!.data),
        expiresAt: new Date(expiresAtMs).toISOString(),
      };
      this.previews.clear();
      this.previews.set(token, { preview, ...source, sourceHash: source.bytes ? hashBytes(source.bytes) : undefined, currentFingerprint: fingerprintRepository(this.repository), expiresAtMs });
      return preview;
    } finally { this.state = 'idle'; }
  }

  async commit(token: string, confirmation: string, activeAsyncMutations: number): Promise<RecoveryResult> {
    if (this.state !== 'idle' || activeAsyncMutations > 0) throw new RecoveryCoordinatorError('Learning data is busy. Try again after the current operation finishes.');
    const record = this.previews.get(token);
    this.previews.delete(token);
    if (!record || record.expiresAtMs <= this.now().getTime()) throw new RecoveryCoordinatorError('The recovery preview expired. Preview the file again.');
    const requiredConfirmation = record.preview.kind === 'import' ? 'IMPORT' : 'RESTORE';
    if (confirmation !== requiredConfirmation) throw new RecoveryCoordinatorError(`Type ${requiredConfirmation} to confirm.`);
    if (fingerprintRepository(this.repository) !== record.currentFingerprint) throw new RecoveryCoordinatorError('Learning data changed after the preview. Preview the operation again.');
    this.state = 'committing';
    return this.commitRecord(record);
  }

  private async commitRecord(record: PreviewRecord): Promise<RecoveryResult> {
    const operationId = this.createId();
    if (!operationIdPattern.test(operationId)) throw new RecoveryCoordinatorError('Could not create a safe recovery operation identifier.');
    const directory = operationPath(this.paths, operationId);
    const candidate = candidatePath(this.paths, operationId);
    let sourceFingerprint: string;
    let safetyBackup: string;
    try {
      mkdirSync(directory, { recursive: false });
      if (record.bytes && hashBytes(record.bytes) !== record.sourceHash) throw new RecoveryCoordinatorError('The previewed recovery bytes changed before commit.');
      if (record.preview.kind === 'import') buildDatabaseFromTransfer(record.document!, candidate, this.paths.root);
      else writeFileSync(candidate, record.bytes!, { flag: 'wx' });
      verifyRecoveryDatabase(candidate);
      this.fault('candidate-validated');

      this.repository.database.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      sourceFingerprint = fingerprintRepository(this.repository);
      safetyBackup = await backupRepository(this.repository, this.paths, this.now().toISOString());
      const safetyVerification = verifyRecoveryDatabase(safetyBackup);
      if (safetyVerification.fingerprint !== sourceFingerprint) throw new RecoveryCoordinatorError('The safety backup did not match current learning data.');
      this.fault('safety-backup-verified');
    } catch (error) {
      this.state = 'idle';
      throw error instanceof RecoveryCoordinatorError
        ? error
        : new RecoveryCoordinatorError(error instanceof Error ? error.message : 'Recovery preparation failed safely.');
    }

    this.repository.close();
    try {
      const originalFamily = familySuffixes
        .map((suffix) => ({ suffix, file: `${this.paths.database}${suffix}` }))
        .filter(({ file }) => existsSync(file))
        .map(({ suffix, file }) => ({ suffix, hash: fileHash(file) }));
      const manifest: RecoveryManifest = {
        formatVersion: 1, operationId, kind: record.preview.kind, createdAt: this.now().toISOString(),
        sourceFingerprint, candidateHash: fileHash(candidate), safetyBackup: path.basename(safetyBackup), originalFamily, phase: 'prepared',
      };
      flushJson(manifestPath(this.paths, operationId), manifest);
      this.fault('manifest-prepared');
      for (const member of originalFamily) {
        renameSync(`${this.paths.database}${member.suffix}`, rollbackPath(this.paths, operationId, member.suffix));
        this.fault(`original-moved:${member.suffix || 'db'}`);
      }
      renameSync(candidate, this.paths.database);
      this.fault('candidate-swapped');
      manifest.phase = 'swapped';
      flushJson(manifestPath(this.paths, operationId), manifest);
      this.fault('manifest-swapped');
      return { kind: record.preview.kind, safetyBackup: path.basename(safetyBackup), operationId };
    } catch (error) {
      throw new RecoveryCoordinatorError(error instanceof Error ? error.message : 'Recovery failed after closing the database.', true);
    }
  }
}

const parseManifest = (paths: DataPaths, operationId: string): RecoveryManifest | undefined => {
  if (!operationIdPattern.test(operationId)) return undefined;
  const file = manifestPath(paths, operationId);
  if (!existsSync(file) || lstatSync(file).isSymbolicLink()) return undefined;
  try {
    const result = manifestSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    return result.success && result.data.operationId === operationId ? result.data : undefined;
  } catch { return undefined; }
};

const restoreOriginal = (paths: DataPaths, manifest: RecoveryManifest): void => {
  for (const member of manifest.originalFamily) {
    const live = `${paths.database}${member.suffix}`;
    const rollback = rollbackPath(paths, manifest.operationId, member.suffix);
    if (existsSync(live) && fileHash(live) === member.hash) continue;
    if (!existsSync(rollback) || fileHash(rollback) !== member.hash) throw new RecoveryCoordinatorError('The original database family is incomplete.');
    if (existsSync(live)) renameSync(live, path.join(operationPath(paths, manifest.operationId), `quarantine${member.suffix}-${randomUUID()}`));
    copyFileSync(rollback, live, 1);
  }
};

const updateManifest = (paths: DataPaths, manifest: RecoveryManifest, phase: RecoveryManifest['phase']): void => {
  manifest.phase = phase;
  flushJson(manifestPath(paths, manifest.operationId), manifest);
};

const quarantineLiveFamily = (paths: DataPaths, manifest: RecoveryManifest, label: string): void => {
  for (const suffix of familySuffixes) {
    const live = `${paths.database}${suffix}`;
    if (!existsSync(live)) continue;
    renameSync(live, path.join(operationPath(paths, manifest.operationId), `quarantine-${label}-${randomUUID()}.sqlite${suffix}`));
  }
};

const restoreSafetyBackup = (paths: DataPaths, manifest: RecoveryManifest, label: string): void => {
  if (!manifest.safetyBackup) throw new RecoveryCoordinatorError('No verified safety backup is recorded for this operation.');
  const safety = path.join(paths.backups, manifest.safetyBackup);
  validateRepositoryBackup(paths, manifest.safetyBackup);
  const verifiedSafety = verifyRecoveryDatabase(safety);
  if (manifest.sourceFingerprint !== 'unavailable' && verifiedSafety.fingerprint !== manifest.sourceFingerprint) {
    throw new RecoveryCoordinatorError('The recorded safety backup no longer matches the original learning data.');
  }
  quarantineLiveFamily(paths, manifest, label);
  copyFileSync(safety, paths.database, 1);
};

export const reconcilePendingRecovery = (paths: DataPaths): void => {
  const canonicalRoot = realpathSync(paths.root);
  const canonicalRecovery = realpathSync(paths.recovery);
  const relative = path.relative(canonicalRoot, canonicalRecovery);
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new RecoveryCoordinatorError('Recovery storage escaped the data root.');
  for (const entry of readdirSync(paths.recovery, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifest = parseManifest(paths, entry.name);
    if (!manifest) {
      if (existsSync(manifestPath(paths, entry.name))) throw new RecoveryCoordinatorError('A recovery manifest is invalid. Recovery mode is required.');
      continue;
    }
    if (manifest.phase === 'completed' || manifest.phase === 'rolled_back') continue;
    const liveHash = existsSync(paths.database) ? fileHash(paths.database) : undefined;
    const originalDatabase = manifest.originalFamily.find((member) => member.suffix === '');
    if (liveHash === manifest.candidateHash) {
      try {
        verifyRecoveryDatabase(paths.database);
        for (const member of manifest.originalFamily.filter((item) => item.suffix !== '')) {
          const liveSidecar = `${paths.database}${member.suffix}`;
          if (existsSync(liveSidecar) && fileHash(liveSidecar) === member.hash) renameSync(liveSidecar, rollbackPath(paths, manifest.operationId, member.suffix));
        }
        updateManifest(paths, manifest, 'completed');
        continue;
      } catch {
        quarantineLiveFamily(paths, manifest, 'candidate');
        try { restoreOriginal(paths, manifest); }
        catch { restoreSafetyBackup(paths, manifest, 'candidate-rollback'); }
        verifyRecoveryDatabase(paths.database);
        updateManifest(paths, manifest, 'rolled_back');
        continue;
      }
    }
    if (originalDatabase && liveHash === originalDatabase.hash) {
      restoreOriginal(paths, manifest);
      updateManifest(paths, manifest, 'rolled_back');
      continue;
    }
    if (liveHash === undefined) {
      try { restoreOriginal(paths, manifest); }
      catch { restoreSafetyBackup(paths, manifest, 'missing-live'); }
    } else if (manifest.safetyBackup) {
      restoreSafetyBackup(paths, manifest, 'unexpected');
    } else {
      restoreOriginal(paths, manifest);
    }
    verifyRecoveryDatabase(paths.database);
    updateManifest(paths, manifest, 'rolled_back');
  }
};

export const replaceClosedDatabase = (paths: DataPaths, candidate: string, kind: 'import' | 'restore', operationId = randomUUID(), now = new Date().toISOString()): string => {
  if (!operationIdPattern.test(operationId)) throw new RecoveryCoordinatorError('Could not create a safe recovery operation identifier.');
  verifyRecoveryDatabase(candidate);
  const directory = operationPath(paths, operationId);
  mkdirSync(directory, { recursive: false });
  const storedCandidate = candidatePath(paths, operationId);
  copyFileSync(candidate, storedCandidate, 1);
  const originalFamily = familySuffixes
    .map((suffix) => ({ suffix, file: `${paths.database}${suffix}` }))
    .filter(({ file }) => existsSync(file))
    .map(({ suffix, file }) => ({ suffix, hash: fileHash(file) }));
  const manifest: RecoveryManifest = {
    formatVersion: 1, operationId, kind, createdAt: now, sourceFingerprint: 'unavailable',
    candidateHash: fileHash(storedCandidate), originalFamily, phase: 'prepared',
  };
  flushJson(manifestPath(paths, operationId), manifest);
  for (const member of originalFamily) renameSync(`${paths.database}${member.suffix}`, rollbackPath(paths, operationId, member.suffix));
  renameSync(storedCandidate, paths.database);
  manifest.phase = 'swapped';
  flushJson(manifestPath(paths, operationId), manifest);
  return operationId;
};

export const preserveUnreadableDatabaseFamily = (paths: DataPaths, now = new Date().toISOString()): readonly string[] => {
  const suffix = now.replace(/[:.]/g, '-');
  const preserved: string[] = [];
  for (const familySuffix of familySuffixes) {
    const source = `${paths.database}${familySuffix}`;
    if (!existsSync(source)) continue;
    const destination = path.join(paths.backups, `unreadable-live-${suffix}-${randomUUID().slice(0, 8)}.sqlite${familySuffix}`);
    copyFileSync(source, destination, 1);
    if (fileHash(destination) !== fileHash(source)) throw new RecoveryCoordinatorError('The unreadable database could not be preserved safely.');
    preserved.push(path.basename(destination));
  }
  return preserved;
};
