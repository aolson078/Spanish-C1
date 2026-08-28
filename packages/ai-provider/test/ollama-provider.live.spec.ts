import { describe, expect, it } from 'vitest';
import { FetchHttpTransport } from '../src/fetch-transport.js';
import { loadOllamaConfig } from '../src/config.js';
import { OllamaProvider } from '../src/ollama-provider.js';

describe.runIf(process.env.RUN_LIVE_OLLAMA_TEST === '1')('local Ollama smoke test', () => {
  it('gets diagnostics and a schema-valid correction from the configured local model', async () => {
    const provider = new OllamaProvider(loadOllamaConfig(), new FetchHttpTransport());

    const diagnostics = await provider.getDiagnostics();
    const proposal = await provider.proposeCorrection({
      learnerText: 'Si tendría más tiempo, viajaría más.',
    });

    expect(diagnostics.modelAvailable).toBe(true);
    expect(proposal.correctedText.length).toBeGreaterThan(0);
    expect(proposal.issues.length).toBeGreaterThan(0);
  }, 60_000);
});
