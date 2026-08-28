import { describe, expect, it } from 'vitest';
import { FetchHttpTransport } from '../src/fetch-transport.js';
import { loadOllamaConfig } from '../src/config.js';
import { OllamaProvider } from '../src/ollama-provider.js';

describe.runIf(process.env.RUN_LIVE_OLLAMA_TEST === '1')('local Ollama smoke test', () => {
  it('gets diagnostics plus schema-valid correction and assessment responses from the configured model', async () => {
    const provider = new OllamaProvider(loadOllamaConfig(), new FetchHttpTransport());

    const diagnostics = await provider.getDiagnostics();
    const proposal = await provider.proposeCorrection({
      learnerText: 'Si tendría más tiempo, viajaría más.',
    });
    const assessment = await provider.evaluateAssessment({
      rubricVersion: 'practical-c1-text.v2',
      skill: 'grammatical_control',
      prompt: 'Explica qué harías si tuvieras más tiempo.',
      learnerResponse: 'Si tendría más tiempo, viajaría más.',
      criteria: ['Use a hypothetical condition accurately.', 'Explain a plausible consequence.'],
      supportLevel: 'none',
    });

    expect(diagnostics.modelAvailable).toBe(true);
    expect(proposal.correctedText.length).toBeGreaterThan(0);
    expect(proposal.issues.length).toBeGreaterThan(0);
    expect(assessment.skill).toBe('grammatical_control');
    expect(assessment.evidence.length).toBeGreaterThan(0);
  }, 60_000);
});
