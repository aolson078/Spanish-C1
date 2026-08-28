import { existsSync } from 'node:fs';
import path from 'node:path';
import { ApplicationService } from '../dist/apps/desktop/application-service.js';
import { initializeDataRoot } from '../dist/packages/persistence/src/data-root.js';
import { fingerprintRepository } from '../dist/packages/persistence/src/portable-transfer.js';
import { SpanishC1Repository } from '../dist/packages/persistence/src/repository.js';

const releaseRoot = path.resolve('release');
const requestedRoot = process.argv[2] ?? path.join(releaseRoot, `smoke-data-m7-soak-${Date.now()}`);
const root = path.resolve(requestedRoot);
if (path.dirname(root) !== releaseRoot || !path.basename(root).startsWith('smoke-data-m7-soak-')) {
  throw new Error('The soak is restricted to a new release\\smoke-data-m7-soak-* root.');
}
if (existsSync(root)) throw new Error(`Refusing to reuse synthetic root: ${root}`);

const proposal = {
  correctedText: 'Si tuviera tiempo, viajaría más.',
  issues: [{
    category: 'grammar.conditional.si_clause', span: 'tendría', replacement: 'tuviera',
    explanation: 'Use the imperfect subjunctive.', confidence: 0.94,
    referenceIds: ['conditional.present_hypothetical'],
  }],
  mexicanSpanishNotes: ['Natural in Mexican Spanish.'], uncertainties: [],
};
const provider = {
  async getDiagnostics() { return { endpoint: 'synthetic://m7-soak', model: 'deterministic', contextLength: 4096, providerVersion: 'm7', modelAvailable: true }; },
  async proposeCorrection() { return proposal; },
  async evaluateAssessment() { throw new Error('Assessment evaluation is outside the M7 soak.'); },
};

const paths = initializeDataRoot(root);
let repository = new SpanishC1Repository(paths.database);
let sequence = 0;
let tick = 0;
const createApplication = () => new ApplicationService(provider, repository, root, {
  createId: () => `m7-${String(++sequence).padStart(8, '0')}`,
  now: () => new Date(Date.UTC(2026, 7, 25, 12, tick++, 0)),
});
let application = createApplication();

for (let index = 1; index <= 10; index += 1) {
  const session = application.startFifteenMinuteSession();
  application.advanceWarmup(session.sessionId);
  await application.submitSessionText(session.sessionId, `Si tendría tiempo ${index}, viajaría más.`);
  application.reviewCorrection(session.sessionId, 'agree');
  await application.submitSessionText(session.sessionId, `Si tuviera tiempo ${index}, estudiaría más.`);
  await application.submitSessionText(session.sessionId, `Si tuviera vacaciones ${index}, visitaría Oaxaca.`);
  application.completeFifteenMinuteSession(session.sessionId);
  if (index === 3 || index === 7) {
    repository.close();
    repository = new SpanishC1Repository(paths.database);
    application = createApplication();
    if (application.getState().activeSession) throw new Error(`A completed session reappeared after restart ${index}.`);
  }
}

const beforeRestart = fingerprintRepository(repository);
const completedSessions = repository.listSessions().filter((session) => session.status === 'completed').length;
repository.close();
repository = new SpanishC1Repository(paths.database);
const afterRestart = fingerprintRepository(repository);
const snapshot = repository.exportSnapshot();
repository.close();
if (completedSessions !== 10 || beforeRestart !== afterRestart) throw new Error('The ten-session restart soak did not preserve the exact snapshot.');

console.log(JSON.stringify({ root, completedSessions, restarts: [3, 7, 10], fingerprint: afterRestart, counts: Object.fromEntries(Object.entries(snapshot).map(([table, rows]) => [table, rows.length])) }, null, 2));
