import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { initializeDataRoot } from '../dist/packages/persistence/src/data-root.js';
import { backupRepository, exportRepository } from '../dist/packages/persistence/src/portable-files.js';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';

const requestedRoot = process.argv[2];
if (!requestedRoot) throw new Error('Pass the synthetic portable data root.');

const root = path.resolve(requestedRoot);
const expectedParent = path.resolve('release');
if (path.dirname(root) !== expectedParent || !path.basename(root).startsWith('smoke-data-portable-')) {
  throw new Error('Recovery verification is restricted to release\\smoke-data-portable-* roots.');
}
if (!existsSync(path.join(root, 'spanish-c1.sqlite'))) {
  throw new Error('The synthetic portable database does not exist.');
}

const marker = 'portable-recovery-2026-08-25';
const paths = initializeDataRoot(root);
const repository = new SpanishC1Repository(paths.database);
repository.setSetting('recoverySmokeMarker', marker, '2026-08-25T14:10:00.000Z');
const exportPath = exportRepository(repository, paths, '2026-08-25T14:10:00.000Z');
const backupPath = await backupRepository(repository, paths, '2026-08-25T14:10:00.000Z');
repository.close();

const exported = JSON.parse(readFileSync(exportPath, 'utf8'));
const exportedMarker = exported.data.settings.find((setting) => setting.key === 'recoverySmokeMarker');
if (!exportedMarker || JSON.parse(exportedMarker.value_json) !== marker) {
  throw new Error('The JSON export did not preserve the recovery marker.');
}

using restored = new SpanishC1Repository(backupPath);
if (restored.getSetting('recoverySmokeMarker') !== marker) {
  throw new Error('The SQLite backup did not preserve the recovery marker.');
}

console.log(JSON.stringify({
  marker,
  exportPath,
  backupPath,
  exportFormatVersion: exported.formatVersion,
  exportVerified: true,
  backupVerified: true,
}));
