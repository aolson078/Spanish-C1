import { describe, expect, it } from 'vitest';
import type { AiProvider } from '../../packages/ai-provider/src/contracts.js';
import { AiProviderError } from '../../packages/ai-provider/src/errors.js';
import type { ApplicationService } from './application-service.js';
import { getReadinessStatus } from './readiness.js';
import type { AudioStatus } from './audio-service.js';

const application = (acknowledged = false, backupCount = 0) => ({
  activeDataRoot: 'C:\\synthetic-data',
  isSetupAcknowledged: () => acknowledged,
  listBackups: () => Array.from({ length: backupCount }, (_, index) => ({ id: `backup-${index}`, createdAt: '', sizeBytes: 1 })),
}) as unknown as ApplicationService;

const provider = (diagnostics: { modelAvailable: boolean } | Error): AiProvider => ({
  getDiagnostics: async () => {
    if (diagnostics instanceof Error) throw diagnostics;
    return { endpoint: 'http://127.0.0.1:11434', model: 'qwen3.5:4b', contextLength: 32_768, providerVersion: 'test', ...diagnostics };
  },
  proposeCorrection: async () => { throw new Error('not used'); },
  evaluateAssessment: async () => { throw new Error('not used'); },
});

const audio = (available = true): AudioStatus => ({
  available,
  speechToTextModel: 'whisper-base-int8',
  textToSpeechModel: 'claude-high-int8',
  message: available ? 'Offline speech is ready.' : 'Speech models are unavailable.',
  retention: 'discard',
});

describe('first-run readiness classification', () => {
  it('keeps navigation available when setup is unacknowledged and AI is usable', async () => {
    const status = await getReadinessStatus(provider({ modelAvailable: true }), application(false), audio());
    expect(status.setupAcknowledged).toBe(false);
    expect(status.checks.find((check) => check.id === 'database')?.level).toBe('ready');
    expect(status.overall).toBe('informational');
  });

  it.each([
    ['missing model', provider({ modelAvailable: false }), 'model'],
    ['offline Ollama', provider(new AiProviderError('UNAVAILABLE', 'offline')), 'ollama'],
    ['invalid configuration', provider(new AiProviderError('INVALID_CONFIGURATION', 'invalid')), 'ollama'],
  ])('classifies %s as degraded without blocking stored data', async (_label, selectedProvider, degradedCheck) => {
    const status = await getReadinessStatus(selectedProvider, application(true, 1), audio());
    expect(status.overall).toBe('degraded');
    expect(status.checks.find((check) => check.id === degradedCheck)?.level).toBe('degraded');
    expect(status.checks.find((check) => check.id === 'database')?.level).toBe('ready');
  });

  it('degrades only spoken features when the speech models are unavailable', async () => {
    const status = await getReadinessStatus(provider({ modelAvailable: true }), application(true, 1), audio(false));
    expect(status.overall).toBe('degraded');
    expect(status.checks.find((check) => check.id === 'audio')?.level).toBe('degraded');
    expect(status.checks.find((check) => check.id === 'database')?.level).toBe('ready');
  });
});
