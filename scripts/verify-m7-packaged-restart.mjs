import { existsSync } from 'node:fs';
import path from 'node:path';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';
import { launchPackagedAndStop } from './m7-packaged-process.mjs';

const executable = path.resolve(process.argv[2] ?? 'release/Spanish C1 0.2.0.exe');
if (!existsSync(executable)) throw new Error(`Portable candidate not found: ${executable}`);
const releaseRoot = path.resolve('release');
const root = path.resolve(process.argv[3] ?? path.join(releaseRoot, `smoke-data-m7-packaged-${Date.now()}`));
if (path.dirname(root) !== releaseRoot || !path.basename(root).startsWith('smoke-data-m7-packaged-') || existsSync(root)) {
  throw new Error('Packaged verification requires a new release\\smoke-data-m7-packaged-* root.');
}
const offline = { OLLAMA_BASE_URL: 'http://127.0.0.1:1', OLLAMA_MODEL: 'synthetic-unavailable-model' };
await launchPackagedAndStop(executable, root, offline);
const first = new SpanishC1Repository(path.join(root, 'spanish-c1.sqlite'));
first.setSetting('packagedRestartMarker', 'preserve-me', '2026-08-25T12:00:00.000Z');
const sessionsBefore = first.listSessions();
first.close();

await launchPackagedAndStop(executable, root, offline);
using reopened = new SpanishC1Repository(path.join(root, 'spanish-c1.sqlite'));
if (reopened.getSetting('packagedRestartMarker') !== 'preserve-me' || JSON.stringify(reopened.listSessions()) !== JSON.stringify(sessionsBefore)) {
  throw new Error('The packaged restart did not preserve the synthetic learner snapshot.');
}
console.log(JSON.stringify({ executable, root, launches: 2, unreachableLoopbackEndpoint: true, markerPreserved: true }));
