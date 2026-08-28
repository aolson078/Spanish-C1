import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fingerprintRepository } from '../dist/packages/persistence/src/portable-transfer.js';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';
import { spawnPackaged, stopPackaged, waitForPackagedDatabase } from './m7-packaged-process.mjs';

const candidate = path.resolve(process.argv[2] ?? 'release/Spanish C1 0.2.0.exe');
if (!existsSync(candidate)) throw new Error(`Portable candidate not found: ${candidate}`);
const releaseRoot = path.resolve('release');
const root = path.join(releaseRoot, `smoke-data-m7-shared-root-${Date.now()}`);
if (existsSync(root)) throw new Error(`Refusing to reuse synthetic root: ${root}`);
const secondInstallation = path.join(releaseRoot, 'm7-validation', `installation-b-${Date.now()}`);
mkdirSync(secondInstallation, { recursive: false });
const secondExecutable = path.join(secondInstallation, 'Spanish C1 0.2.0.exe');
copyFileSync(candidate, secondExecutable, 1);
const offline = { OLLAMA_BASE_URL: 'http://127.0.0.1:1', OLLAMA_MODEL: 'synthetic-unavailable-model' };

const first = spawnPackaged(candidate, root, offline);
await waitForPackagedDatabase(first, root);
using before = new SpanishC1Repository(path.join(root, 'spanish-c1.sqlite'));
const beforeFingerprint = fingerprintRepository(before);

const second = spawnPackaged(secondExecutable, root, offline);
await delay(2_000);
if (second.exitCode !== null) {
  await stopPackaged(first);
  throw new Error('The second portable installation exited instead of showing root-ownership guidance.');
}
using after = new SpanishC1Repository(path.join(root, 'spanish-c1.sqlite'));
const afterFingerprint = fingerprintRepository(after);
if (afterFingerprint !== beforeFingerprint) throw new Error('The blocked portable installation changed synthetic learner data.');
await stopPackaged(second);
await stopPackaged(first);

console.log(JSON.stringify({ root, firstInstallation: path.dirname(candidate), secondInstallation, concurrentProcesses: 2, learnerFingerprintUnchanged: true }));
