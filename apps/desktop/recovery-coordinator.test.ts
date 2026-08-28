import { existsSync, mkdirSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createExportDocument } from '../../packages/persistence/src/portable-transfer.js';
import { SpanishC1Repository } from '../../packages/persistence/src/repository.js';
import { createTestDataRoot, removeTestDataRoot } from '../../packages/persistence/test/test-root.js';
import { RecoveryCoordinator, RecoveryCoordinatorError, reconcilePendingRecovery } from './recovery-coordinator.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) removeTestDataRoot(root); });

const ids = (...values: string[]): (() => string) => {
  let index = 0;
  return () => values[index++] ?? `aaaaaaaa-aaaa-4aaa-8aaa-${String(index).padStart(12, '0')}`;
};

describe('crash-safe recovery coordinator', () => {
  it('imports the exact previewed snapshot, preserves current data, and completes after reconciliation', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    repository.setSetting('marker', 'current');
    const incomingPath = path.join(paths.root, 'incoming.sqlite');
    using incoming = new SpanishC1Repository(incomingPath);
    incoming.setSetting('marker', 'incoming');
    const bytes = Buffer.from(JSON.stringify(createExportDocument(incoming, '2026-08-25T12:00:00.000Z')));
    const coordinator = new RecoveryCoordinator(repository, paths, {
      createId: ids('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222'),
      now: () => new Date('2026-08-25T12:00:00.000Z'),
    });
    const preview = coordinator.previewImport(bytes, 'transfer.json');

    const result = await coordinator.commit(preview.token, 'IMPORT', 0);
    reconcilePendingRecovery(paths);

    using restored = new SpanishC1Repository(paths.database);
    expect(restored.getSetting('marker')).toBe('incoming');
    expect(restored.getSetting('activeDataRoot')).toBe(paths.root);
    using safety = new SpanishC1Repository(path.join(paths.backups, result.safetyBackup));
    expect(safety.getSetting('marker')).toBe('current');
  });

  it('rejects confirmation replay, expiration, and a changed live fingerprint', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    let now = new Date('2026-08-25T12:00:00.000Z');
    const coordinator = new RecoveryCoordinator(repository, paths, { createId: ids('33333333-3333-4333-8333-333333333333'), now: () => now });
    const preview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(repository))), 'transfer.json');
    await expect(coordinator.commit(preview.token, 'RESTORE', 0)).rejects.toThrow('Type IMPORT');
    const changedPreview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(repository))), 'transfer.json');
    repository.setSetting('changed', true);
    await expect(coordinator.commit(changedPreview.token, 'IMPORT', 0)).rejects.toThrow('changed after the preview');
    await expect(coordinator.commit(changedPreview.token, 'IMPORT', 0)).rejects.toThrow('expired');

    const next = new RecoveryCoordinator(repository, paths, { createId: ids('44444444-4444-4444-8444-444444444444'), now: () => now });
    const expiring = next.previewImport(Buffer.from(JSON.stringify(createExportDocument(repository))), 'transfer.json');
    now = new Date('2026-08-25T12:11:00.000Z');
    await expect(next.commit(expiring.token, 'IMPORT', 0)).rejects.toThrow('expired');
  });

  it.each([
    ['manifest-prepared', 'current'],
    ['original-moved:db', 'current'],
    ['candidate-swapped', 'incoming'],
    ['manifest-swapped', 'incoming'],
  ] as const)('reconciles a synthetic crash at %s to the exact durable snapshot', async (faultPoint, expectedMarker) => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    repository.setSetting('marker', 'current');
    const incomingPath = path.join(paths.root, 'fault-incoming.sqlite');
    using incoming = new SpanishC1Repository(incomingPath);
    incoming.setSetting('marker', 'incoming');
    const coordinator = new RecoveryCoordinator(repository, paths, {
      createId: ids('55555555-5555-4555-8555-555555555555', '66666666-6666-4666-8666-666666666666'),
      fault: (point) => { if (point === faultPoint) throw new Error('synthetic crash'); },
    });
    const preview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(incoming))), 'transfer.json');

    await expect(coordinator.commit(preview.token, 'IMPORT', 0)).rejects.toMatchObject({ repositoryClosed: true });
    reconcilePendingRecovery(paths);

    using restored = new SpanishC1Repository(paths.database);
    expect(restored.getSetting('marker')).toBe(expectedMarker);
  });

  it.each(['candidate-validated', 'safety-backup-verified'])('releases the mutation gate when preparation fails at %s before repository close', async (faultPoint) => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    repository.setSetting('marker', 'current');
    const coordinator = new RecoveryCoordinator(repository, paths, {
      createId: ids('88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999'),
      fault: (point) => { if (point === faultPoint) throw new Error('synthetic preparation failure'); },
    });
    const preview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(repository))), 'transfer.json');

    await expect(coordinator.commit(preview.token, 'IMPORT', 0)).rejects.toMatchObject({ repositoryClosed: false });
    expect(coordinator.operationState).toBe('idle');
    expect(repository.getSetting('marker')).toBe('current');
  });

  it('quarantines unexpected live content and restores the independently verified safety backup', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    repository.setSetting('marker', 'current');
    const incomingPath = path.join(paths.root, 'unexpected-incoming.sqlite');
    using incoming = new SpanishC1Repository(incomingPath);
    incoming.setSetting('marker', 'incoming');
    const coordinator = new RecoveryCoordinator(repository, paths, {
      createId: ids('cccccccc-1111-4111-8111-111111111111', 'dddddddd-2222-4222-8222-222222222222'),
      fault: (point) => { if (point === 'candidate-swapped') throw new Error('synthetic crash'); },
    });
    const preview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(incoming))), 'transfer.json');
    await expect(coordinator.commit(preview.token, 'IMPORT', 0)).rejects.toMatchObject({ repositoryClosed: true });

    writeFileSync(paths.database, 'unexpected synthetic live content');
    reconcilePendingRecovery(paths);

    using restored = new SpanishC1Repository(paths.database);
    expect(restored.getSetting('marker')).toBe('current');
    const artifacts = readdirSync(path.join(paths.recovery, 'dddddddd-2222-4222-8222-222222222222'));
    expect(artifacts.some((name) => name.startsWith('quarantine-unexpected-'))).toBe(true);
  });

  it('fails closed on an invalid durable manifest instead of creating an empty live database', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    repository.setSetting('marker', 'must-not-be-masked');
    repository.close();
    const operation = path.join(paths.recovery, 'abababab-1111-4111-8111-111111111111');
    mkdirSync(operation);
    renameSync(paths.database, path.join(operation, 'original.sqlite'));
    writeFileSync(path.join(operation, 'manifest.json'), '{invalid');

    expect(() => reconcilePendingRecovery(paths)).toThrow('manifest is invalid');
    expect(existsSync(paths.database)).toBe(false);
    expect(existsSync(path.join(operation, 'original.sqlite'))).toBe(true);
  });

  it('refuses a commit while an asynchronous mutation is active', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const coordinator = new RecoveryCoordinator(repository, paths, { createId: ids('77777777-7777-4777-8777-777777777777') });
    const preview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(repository))), 'transfer.json');
    await expect(coordinator.commit(preview.token, 'IMPORT', 1)).rejects.toThrow('busy');
    expect(coordinator.operationState).toBe('idle');
  });

  it('binds commit to the exact previewed bytes', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    using repository = new SpanishC1Repository(paths.database);
    const bytes = Buffer.from(JSON.stringify(createExportDocument(repository)));
    const coordinator = new RecoveryCoordinator(repository, paths, {
      createId: ids('eeeeeeee-1111-4111-8111-111111111111', 'ffffffff-2222-4222-8222-222222222222'),
    });
    const preview = coordinator.previewImport(bytes, 'transfer.json');
    bytes[0] = bytes[0]! ^ 1;

    await expect(coordinator.commit(preview.token, 'IMPORT', 0)).rejects.toThrow('bytes changed');
    expect(coordinator.operationState).toBe('idle');
  });

  it('serializes concurrent commit attempts and consumes the preview once', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    const coordinator = new RecoveryCoordinator(repository, paths, {
      createId: ids('aaaaaaaa-1111-4111-8111-111111111111', 'bbbbbbbb-2222-4222-8222-222222222222'),
    });
    const preview = coordinator.previewImport(Buffer.from(JSON.stringify(createExportDocument(repository))), 'transfer.json');

    const first = coordinator.commit(preview.token, 'IMPORT', 0);
    await expect(coordinator.commit(preview.token, 'IMPORT', 0)).rejects.toThrow('busy');
    await first;
    reconcilePendingRecovery(paths);
    using reopened = new SpanishC1Repository(paths.database);
    expect(reopened.schemaVersion()).toBe(5);
  });
});
