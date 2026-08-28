import { AiProviderError } from './errors.js';

export interface OllamaProviderConfig {
  readonly baseUrl: string;
  readonly model: string;
  readonly contextLength: number;
  readonly timeoutMs: number;
}

const positiveInteger = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new AiProviderError('INVALID_CONFIGURATION', 'Context length and timeout must be positive integers.');
  }
  return parsed;
};

export const loadOllamaConfig = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OllamaProviderConfig => {
  const baseUrl = environment.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434';
  const model = environment.OLLAMA_MODEL ?? 'qwen3.5:4b';

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch (error) {
    throw new AiProviderError('INVALID_CONFIGURATION', 'OLLAMA_BASE_URL must be an absolute HTTP URL.', {
      cause: error,
    });
  }

  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new AiProviderError('INVALID_CONFIGURATION', 'OLLAMA_BASE_URL must use HTTP or HTTPS.');
  }
  if (!model.trim()) {
    throw new AiProviderError('INVALID_CONFIGURATION', 'OLLAMA_MODEL cannot be blank.');
  }

  return {
    baseUrl: parsedUrl.toString().replace(/\/$/, ''),
    model: model.trim(),
    contextLength: positiveInteger(environment.OLLAMA_CONTEXT_LENGTH, 4_096),
    timeoutMs: positiveInteger(environment.OLLAMA_TIMEOUT_MS, 30_000),
  };
};
