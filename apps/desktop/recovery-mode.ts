import { randomUUID } from 'node:crypto';
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { DataPaths } from '../../packages/persistence/src/data-root.js';
import { listRepositoryBackups, validateRepositoryBackup } from '../../packages/persistence/src/portable-files.js';
import { buildDatabaseFromTransfer, hashBytes, maximumImportBytes, parseTransferBytes, transferTables, type ParsedTransferDocument, type TransferTable } from '../../packages/persistence/src/portable-transfer.js';
import { preserveUnreadableDatabaseFamily, RecoveryCoordinatorError, replaceClosedDatabase, verifyRecoveryDatabase, type DataPreview, type RecoveryResult } from './recovery-coordinator.js';
import { readBoundedRegularFile } from './bounded-file.js';

export interface BootstrapStatus { readonly mode: 'normal' | 'recovery' | 'blocked'; readonly message?: string; readonly activeDataRoot?: string }

interface OfflinePreview { readonly preview: DataPreview; readonly document?: ParsedTransferDocument; readonly bytes?: Buffer; readonly sourceHash?: string; readonly expiresAt: number }

const emptyCounts = Object.fromEntries(transferTables.map((table) => [table, 0])) as Record<TransferTable, number>;

export class RecoveryModeService {
  private preview?: OfflinePreview;
  constructor(readonly paths: DataPaths, private readonly now: () => Date = () => new Date()) {}

  listBackups() { return listRepositoryBackups(this.paths); }

  previewImport(bytes: Buffer, displayName: string): DataPreview {
    const document = parseTransferBytes(bytes);
    const token = randomUUID();
    mkdirSync(path.join(this.paths.recovery, 'previews'), { recursive: true });
    const candidate = path.join(this.paths.recovery, 'previews', `${token}.sqlite`);
    buildDatabaseFromTransfer(document, candidate, this.paths.root);
    const incomingCounts = verifyRecoveryDatabase(candidate).counts;
    return this.store({ kind: 'import', displayName, createdAt: document.exportedAt, formatVersion: document.formatVersion, schemaVersion: document.schemaVersion, incomingCounts }, { bytes, document }, token);
  }

  previewBackup(id: string): DataPreview {
    const source = validateRepositoryBackup(this.paths, id);
    if (statSync(source).size > maximumImportBytes) throw new RecoveryCoordinatorError('The selected backup exceeds the 256 MiB recovery limit.');
    const bytes = readBoundedRegularFile(source, maximumImportBytes);
    const token = randomUUID();
    mkdirSync(path.join(this.paths.recovery, 'previews'), { recursive: true });
    const candidate = path.join(this.paths.recovery, 'previews', `${token}.sqlite`);
    writeFileSync(candidate, bytes, { flag: 'wx' });
    const incomingCounts = verifyRecoveryDatabase(candidate).counts;
    return this.store({ kind: 'restore', displayName: id, createdAt: statSync(source).mtime.toISOString(), formatVersion: 1, schemaVersion: 5, incomingCounts }, { bytes }, token);
  }

  private store(summary: Omit<DataPreview, 'token' | 'currentCounts' | 'expiresAt'>, source: { document?: ParsedTransferDocument; bytes?: Buffer }, token: string): DataPreview {
    const expiresAt = this.now().getTime() + 10 * 60_000;
    const preview = { ...summary, token, currentCounts: emptyCounts, expiresAt: new Date(expiresAt).toISOString() };
    this.preview = { preview, ...source, sourceHash: source.bytes ? hashBytes(source.bytes) : undefined, expiresAt };
    return preview;
  }

  commit(token: string, confirmation: string): RecoveryResult {
    const record = this.preview;
    this.preview = undefined;
    if (!record || record.preview.token !== token || record.expiresAt <= this.now().getTime()) throw new RecoveryCoordinatorError('The recovery preview expired. Preview the operation again.');
    const expected = record.preview.kind === 'import' ? 'IMPORT' : 'RESTORE';
    if (confirmation !== expected) throw new RecoveryCoordinatorError(`Type ${expected} to confirm.`);
    if (record.bytes && hashBytes(record.bytes) !== record.sourceHash) throw new RecoveryCoordinatorError('The previewed recovery bytes changed before commit.');
    preserveUnreadableDatabaseFamily(this.paths, this.now().toISOString());
    mkdirSync(this.paths.testTemp, { recursive: true });
    const candidate = path.join(this.paths.testTemp, `recovery-candidate-${randomUUID()}.sqlite`);
    if (record.preview.kind === 'import') buildDatabaseFromTransfer(record.document!, candidate, this.paths.root);
    else writeFileSync(candidate, record.bytes!, { flag: 'wx' });
    const operationId = replaceClosedDatabase(this.paths, candidate, record.preview.kind);
    return { kind: record.preview.kind, safetyBackup: 'unreadable database family preserved', operationId };
  }
}
