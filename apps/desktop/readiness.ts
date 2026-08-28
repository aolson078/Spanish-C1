import type { AiProvider, ProviderDiagnostics } from '../../packages/ai-provider/src/contracts.js';
import { AiProviderError } from '../../packages/ai-provider/src/errors.js';
import type { ApplicationService } from './application-service.js';
import type { AudioStatus } from './audio-service.js';

export type ReadinessLevel = 'ready' | 'informational' | 'degraded' | 'blocked';

export interface ReadinessCheck {
  readonly id: 'storage' | 'database' | 'ollama' | 'model' | 'audio' | 'backup' | 'publisher';
  readonly level: ReadinessLevel;
  readonly label: string;
  readonly message: string;
}

export interface ReadinessStatus {
  readonly overall: ReadinessLevel;
  readonly setupAcknowledged: boolean;
  readonly diagnostics?: ProviderDiagnostics;
  readonly checks: readonly ReadinessCheck[];
}

const rank: Readonly<Record<ReadinessLevel, number>> = { ready: 0, informational: 1, degraded: 2, blocked: 3 };

export const getReadinessStatus = async (provider: AiProvider, application: ApplicationService, audio: AudioStatus): Promise<ReadinessStatus> => {
  const checks: ReadinessCheck[] = [
    { id: 'storage', level: 'ready', label: 'Portable storage', message: `Writable at ${application.activeDataRoot}` },
    { id: 'database', level: 'ready', label: 'Learning database', message: 'Opened successfully with the current schema.' },
  ];
  const backups = application.listBackups();
  checks.push(backups.length > 0
    ? { id: 'backup', level: 'ready', label: 'Recovery backup', message: `${backups.length} managed backup(s) available.` }
    : { id: 'backup', level: 'informational', label: 'Recovery backup', message: 'No backup exists yet. Create one from Settings.' });
  checks.push({ id: 'publisher', level: 'informational', label: 'Windows publisher', message: 'This private local build is not code-signed.' });
  checks.push(audio.available
    ? { id: 'audio', level: 'ready', label: 'Offline speech', message: audio.message }
    : { id: 'audio', level: 'degraded', label: 'Offline speech', message: audio.message });

  let diagnostics: ProviderDiagnostics | undefined;
  try {
    diagnostics = await provider.getDiagnostics();
    checks.push({ id: 'ollama', level: 'ready', label: 'Local Ollama', message: `Connected to ${diagnostics.endpoint}.` });
    checks.push(diagnostics.modelAvailable
      ? { id: 'model', level: 'ready', label: 'Spanish model', message: `${diagnostics.model} is available.` }
      : { id: 'model', level: 'degraded', label: 'Spanish model', message: `${diagnostics.model} is not installed. Install it manually before AI practice.` });
  } catch (error) {
    const code = error instanceof AiProviderError ? error.code : 'UNAVAILABLE';
    checks.push({ id: 'ollama', level: 'degraded', label: 'Local Ollama', message: code === 'INVALID_CONFIGURATION' ? 'The local Ollama configuration is invalid. Check the OLLAMA_* environment values.' : 'Ollama is unavailable. Start it locally, then choose Recheck.' });
    checks.push({ id: 'model', level: 'degraded', label: 'Spanish model', message: 'Model availability cannot be checked until Ollama is reachable.' });
  }
  const overall = checks.reduce<ReadinessLevel>((current, check) => rank[check.level] > rank[current] ? check.level : current, 'ready');
  return { overall, setupAcknowledged: application.isSetupAcknowledged(), diagnostics, checks };
};
