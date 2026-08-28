import { existsSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createExportDocument } from '../../packages/persistence/src/portable-transfer.js';
import { backupRepository } from '../../packages/persistence/src/portable-files.js';
import { SpanishC1Repository } from '../../packages/persistence/src/repository.js';
import { createTestDataRoot, removeTestDataRoot } from '../../packages/persistence/test/test-root.js';
import { reconcilePendingRecovery } from './recovery-coordinator.js';
import { RecoveryModeService } from './recovery-mode.js';

const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) removeTestDataRoot(root); });

describe('limited database recovery mode', () => {
  it('preserves an unreadable live family before validated JSON replacement', () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const sourcePath = path.join(paths.root, 'incoming.sqlite');
    using incoming = new SpanishC1Repository(sourcePath);
    incoming.setSetting('marker', 'validated-incoming');
    const bytes = Buffer.from(JSON.stringify(createExportDocument(incoming, '2026-08-25T12:00:00.000Z')));

    writeFileSync(paths.database, 'synthetic corrupt database used only under the allowlisted test root');
    expect(() => new SpanishC1Repository(paths.database)).toThrow();
    const service = new RecoveryModeService(paths, () => new Date('2026-08-25T12:00:00.000Z'));
    const preview = service.previewImport(bytes, 'validated-export.json');
    service.commit(preview.token, 'IMPORT');
    reconcilePendingRecovery(paths);

    expect(readdirSync(paths.backups).some((name) => name.startsWith('unreadable-live-'))).toBe(true);
    expect(existsSync(paths.database)).toBe(true);
    using restored = new SpanishC1Repository(paths.database);
    expect(restored.getSetting('marker')).toBe('validated-incoming');
  });

  it('restores a managed schema-v5 backup after corrupt-database bootstrap', async () => {
    const paths = createTestDataRoot();
    roots.push(paths.root);
    const repository = new SpanishC1Repository(paths.database);
    repository.setSetting('marker', 'managed-backup');
    const backup = await backupRepository(repository, paths, '2026-08-25T12:00:00.000Z');
    repository.close();
    writeFileSync(paths.database, 'synthetic corrupt database used only under the allowlisted test root');
    expect(() => new SpanishC1Repository(paths.database)).toThrow();

    const service = new RecoveryModeService(paths, () => new Date('2026-08-25T12:01:00.000Z'));
    const preview = service.previewBackup(path.basename(backup));
    service.commit(preview.token, 'RESTORE');
    reconcilePendingRecovery(paths);

    using restored = new SpanishC1Repository(paths.database);
    expect(restored.getSetting('marker')).toBe('managed-backup');
    expect(readdirSync(paths.backups).some((name) => name.startsWith('unreadable-live-'))).toBe(true);
  });
});
