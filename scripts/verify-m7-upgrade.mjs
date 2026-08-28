import { existsSync } from 'node:fs';
import path from 'node:path';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';
import { launchPackagedAndStop } from './m7-packaged-process.mjs';

const versionOne = path.resolve(process.argv[2] ?? 'release/m7-validation/version-a/Spanish C1 0.1.0.exe');
const versionTwo = path.resolve(process.argv[3] ?? 'release/Spanish C1 0.2.0.exe');
if (!existsSync(versionOne) || !existsSync(versionTwo)) throw new Error('Both preserved 0.1.0 and candidate 0.2.0 executables are required.');
const releaseRoot = path.resolve('release');
const root = path.resolve(process.argv[4] ?? path.join(releaseRoot, `smoke-data-m7-upgrade-${Date.now()}`));
if (path.dirname(root) !== releaseRoot || !path.basename(root).startsWith('smoke-data-m7-upgrade-') || existsSync(root)) {
  throw new Error('Upgrade verification requires a new release\\smoke-data-m7-upgrade-* root.');
}
const offline = { OLLAMA_BASE_URL: 'http://127.0.0.1:1', OLLAMA_MODEL: 'synthetic-unavailable-model' };
await launchPackagedAndStop(versionOne, root, offline);
const legacy = new SpanishC1Repository(path.join(root, 'spanish-c1.sqlite'));
legacy.setSetting('upgradeMarker', 'created-after-0.1.0-launch', '2026-08-25T12:00:00.000Z');
legacy.close();

await launchPackagedAndStop(versionTwo, root, offline);
using upgraded = new SpanishC1Repository(path.join(root, 'spanish-c1.sqlite'));
if (upgraded.getSetting('upgradeMarker') !== 'created-after-0.1.0-launch' || upgraded.schemaVersion() !== 5) {
  throw new Error('The 0.2.0 candidate did not preserve and open the synthetic 0.1.0 data root.');
}
console.log(JSON.stringify({ root, versionOne, versionTwo, schemaVersion: upgraded.schemaVersion(), markerPreserved: true }));
