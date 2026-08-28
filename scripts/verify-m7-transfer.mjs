import { existsSync } from 'node:fs';
import path from 'node:path';
import { initializeDataRoot } from '../dist/packages/persistence/src/data-root.js';
import { backupRepository } from '../dist/packages/persistence/src/portable-files.js';
import { createExportDocument, fingerprintRepository } from '../dist/packages/persistence/src/portable-transfer.js';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';
import { RecoveryCoordinator, reconcilePendingRecovery } from '../dist/apps/desktop/recovery-coordinator.js';

const releaseRoot = path.resolve('release');
const requestedRoot = process.argv[2] ?? path.join(releaseRoot, `smoke-data-m7-transfer-${Date.now()}`);
const root = path.resolve(requestedRoot);
if (path.dirname(root) !== releaseRoot || !path.basename(root).startsWith('smoke-data-m7-transfer-')) {
  throw new Error('Transfer verification is restricted to a new release\\smoke-data-m7-transfer-* root.');
}
if (existsSync(root)) throw new Error(`Refusing to reuse synthetic root: ${root}`);

const sourcePaths = initializeDataRoot(path.join(root, 'source'));
using source = new SpanishC1Repository(sourcePaths.database);
source.setSetting('marker', 'portable-source', '2026-08-25T12:00:00.000Z');
source.setSetting('activeDataRoot', 'D:\\foreign-root', '2026-08-25T12:00:00.000Z');
const v2 = createExportDocument(source, '2026-08-25T12:00:00.000Z');
const documents = [
  { label: 'v1', value: { formatVersion: 1, exportedAt: v2.exportedAt, data: v2.data } },
  { label: 'v2', value: v2 },
];
const results = [];

for (const document of documents) {
  const targetPaths = initializeDataRoot(path.join(root, document.label));
  let target = new SpanishC1Repository(targetPaths.database);
  target.setSetting('marker', `current-${document.label}`, '2026-08-25T12:01:00.000Z');
  const coordinator = new RecoveryCoordinator(target, targetPaths);
  const preview = coordinator.previewImport(Buffer.from(JSON.stringify(document.value)), `export-${document.label}.json`);
  const committed = await coordinator.commit(preview.token, 'IMPORT', 0);
  reconcilePendingRecovery(targetPaths);
  target = new SpanishC1Repository(targetPaths.database);
  if (target.getSetting('marker') !== 'portable-source' || target.getSetting('activeDataRoot') !== targetPaths.root) {
    throw new Error(`${document.label} import did not preserve snapshot or receiving activeDataRoot.`);
  }
  const importedFingerprint = fingerprintRepository(target);
  const backup = await backupRepository(target, targetPaths, '2026-08-25T12:02:00.000Z');
  const backupId = path.basename(backup);
  target.setSetting('marker', `changed-${document.label}`, '2026-08-25T12:03:00.000Z');
  const restore = new RecoveryCoordinator(target, targetPaths);
  const restorePreview = restore.previewBackup(backupId);
  const restored = await restore.commit(restorePreview.token, 'RESTORE', 0);
  reconcilePendingRecovery(targetPaths);
  target = new SpanishC1Repository(targetPaths.database);
  if (fingerprintRepository(target) !== importedFingerprint) throw new Error(`${document.label} backup restore did not recover exact snapshot equality.`);
  target.close();
  results.push({ format: document.label, importSafetyBackup: committed.safetyBackup, restoreSafetyBackup: restored.safetyBackup, fingerprint: importedFingerprint });
}

console.log(JSON.stringify({ root, results }, null, 2));
