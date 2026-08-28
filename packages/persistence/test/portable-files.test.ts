import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import { backupRepository, exportRepository, validateRepositoryBackup } from '../src/portable-files.js';
import { SpanishC1Repository } from '../src/repository.js';
import { session } from './fixtures.js';
import { createTestDataRoot, removeTestDataRoot } from './test-root.js';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) removeTestDataRoot(root);
});

describe('portable backup and export', () => {
  it('writes a portable JSON snapshot beneath the configured export directory', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);

    const destination = exportRepository(repository, paths, '2026-08-24T12:00:00.000Z');
    const document = JSON.parse(readFileSync(destination, 'utf8')) as Record<string, unknown>;

    expect(destination.startsWith(paths.exports)).toBe(true);
    expect(document).toMatchObject({
      formatVersion: 2,
      applicationVersion: '0.2.0',
      schemaVersion: 5,
      data: { sessions: [{ id: session.id }] },
    });
  });

  it('creates a usable SQLite backup beneath the configured backup directory', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    repository.saveSession(session);
    const destination = await backupRepository(
      repository,
      paths,
      '2026-08-24T12:00:00.000Z',
    );
    repository.close();

    expect(destination.startsWith(paths.backups)).toBe(true);
    expect(existsSync(destination)).toBe(true);
    using restored = new SpanishC1Repository(destination);
    expect(restored.getSession(session.id)).toEqual(session);
  });

  it.each(['../spanish-c1.sqlite', 'C:\\outside.sqlite', 'not-managed.sqlite'])(
    'rejects an unmanaged restore identifier: %s',
    (id) => {
      const paths = createTestDataRoot();
      roots.push(paths.root);
      expect(() => validateRepositoryBackup(paths, id)).toThrow('Choose a backup created by this application.');
    },
  );

  it('rejects a corrupt file that mimics a managed backup name', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const id = 'spanish-c1-backup-2026-08-24T12-00-00-000Z-deadbeef.sqlite';
    writeFileSync(path.join(paths.backups, id), 'not sqlite');
    expect(() => validateRepositoryBackup(paths, id)).toThrow('not a valid Spanish C1 backup');
  });

  it('rejects a schema-v5 managed backup with broken references', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    const destination = await backupRepository(repository, paths, '2026-08-24T12:00:00.000Z');
    repository.close();
    const database = new DatabaseSync(destination);
    database.exec('PRAGMA foreign_keys = OFF');
    database.prepare('INSERT INTO reviews (id, weakness_id, due_at, completed_at, outcome) VALUES (?, ?, ?, NULL, NULL)')
      .run('review-broken', 'weakness-missing', '2026-08-25T12:00:00.000Z');
    database.close();

    expect(() => validateRepositoryBackup(paths, path.basename(destination))).toThrow('not a valid Spanish C1 backup');
  });
});
