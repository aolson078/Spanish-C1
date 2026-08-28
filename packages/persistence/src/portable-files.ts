import { lstatSync, readdirSync, realpathSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { backup, DatabaseSync } from 'node:sqlite';
import type { DataPaths } from './data-root.js';
import { SpanishC1Repository } from './repository.js';
import { createExportDocument, validateTransferData } from './portable-transfer.js';

const safeTimestamp = (timestamp: string): string => timestamp.replace(/[:.]/g, '-');
const uniqueSuffix = (): string => randomUUID().slice(0, 8);
const backupName = /^spanish-c1-backup-[A-Za-z0-9-]+\.sqlite$/;
const requiredTables = ['sessions', 'session_progress', 'weaknesses', 'settings', 'assessments'] as const;
const supportedSchemaVersion = 5;

export interface PortableBackup {
  readonly id: string;
  readonly createdAt: string;
  readonly sizeBytes: number;
}

export class PortableRecoveryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PortableRecoveryError';
  }
}

const backupPath = (paths: DataPaths, id: string): string => {
  if (!backupName.test(id) || path.basename(id) !== id) {
    throw new PortableRecoveryError('Choose a backup created by this application.');
  }
  const candidate = path.join(paths.backups, id);
  const canonicalRoot = realpathSync(paths.root);
  const canonicalBackups = realpathSync(paths.backups);
  const relativeBackups = path.relative(canonicalRoot, canonicalBackups);
  if (relativeBackups.startsWith('..') || path.isAbsolute(relativeBackups)) {
    throw new PortableRecoveryError('The backup directory is outside the active data root.');
  }
  const metadata = lstatSync(candidate, { throwIfNoEntry: false });
  if (!metadata?.isFile() || metadata.isSymbolicLink()) {
    throw new PortableRecoveryError('The selected backup is unavailable.');
  }
  return candidate;
};

export const listRepositoryBackups = (paths: DataPaths): readonly PortableBackup[] =>
  readdirSync(paths.backups, { withFileTypes: true })
    .filter((entry) => entry.isFile() && backupName.test(entry.name))
    .map((entry) => {
      const metadata = lstatSync(path.join(paths.backups, entry.name));
      return { id: entry.name, createdAt: metadata.mtime.toISOString(), sizeBytes: metadata.size };
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

const validateDatabaseFile = (candidate: string): void => {
  let database: DatabaseSync | undefined;
  try {
    database = new DatabaseSync(candidate, { readOnly: true });
    const integrity = database.prepare('PRAGMA quick_check').get() as { quick_check?: string } | undefined;
    if (integrity?.quick_check !== 'ok') throw new Error('Integrity check failed.');
    const rows = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    const names = new Set(rows.map((row) => row.name));
    if (requiredTables.some((table) => !names.has(table)) || !names.has('schema_migrations')) throw new Error('Required tables are missing.');
    const schema = database.prepare('SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations').get() as { version: number };
    if (schema.version !== supportedSchemaVersion) throw new Error('Unsupported schema version.');
    if (database.prepare('PRAGMA foreign_key_check').all().length > 0) throw new Error('Foreign-key check failed.');
  } catch (error) {
    throw new PortableRecoveryError('The selected file is not a valid Spanish C1 backup.');
  } finally {
    database?.close();
  }
};

export const validateRepositoryBackup = (paths: DataPaths, id: string): string => {
  const candidate = backupPath(paths, id);
  validateDatabaseFile(candidate);
  try {
    using repository = new SpanishC1Repository(candidate);
    validateTransferData(repository.exportSnapshot());
  } catch {
    throw new PortableRecoveryError('The selected file is not compatible with this version of Spanish C1.');
  }
  return candidate;
};

export const exportRepository = (
  repository: SpanishC1Repository,
  paths: DataPaths,
  now = new Date().toISOString(),
): string => {
  const destination = path.join(
    paths.exports,
    `spanish-c1-export-${safeTimestamp(now)}-${uniqueSuffix()}.json`,
  );
  writeFileSync(
    destination,
    JSON.stringify(createExportDocument(repository, now), null, 2),
    { encoding: 'utf8', flag: 'wx' },
  );
  return destination;
};

export const backupRepository = async (
  repository: SpanishC1Repository,
  paths: DataPaths,
  now = new Date().toISOString(),
): Promise<string> => {
  const destination = path.join(
    paths.backups,
    `spanish-c1-backup-${safeTimestamp(now)}-${uniqueSuffix()}.sqlite`,
  );
  await backup(repository.database, destination);
  return destination;
};
