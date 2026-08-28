import { describe, expect, it, vi } from 'vitest';
import type {
  HttpRequest,
  HttpResponse,
  HttpTransport,
} from '../src/contracts.js';
import { AiProviderError } from '../src/errors.js';
import { OllamaProvider } from '../src/ollama-provider.js';

const config = {
  baseUrl: 'http://127.0.0.1:11434',
  model: 'qwen3.5:4b',
  contextLength: 4_096,
  timeoutMs: 100,
} as const;

const jsonResponse = (value: unknown, status = 200): HttpResponse => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => value,
});

class QueueTransport implements HttpTransport {
  readonly requests: HttpRequest[] = [];

  constructor(private readonly responses: HttpResponse[]) {}

  async send(request: HttpRequest): Promise<HttpResponse> {
    this.requests.push(request);
    const response = this.responses.shift();
    if (!response) throw new Error('No fake response was configured.');
    return response;
  }
}

const validProposal = {
  correctedText: 'Si tuviera más tiempo, viajaría más.',
  issues: [
    {
      category: 'grammar.conditional.si_clause',
      span: 'tendría',
      replacement: 'tuviera',
      explanation: 'Use the imperfect subjunctive for a present hypothetical condition.',
      confidence: 0.94,
      referenceIds: ['conditional.present_hypothetical'],
    },
  ],
  mexicanSpanishNotes: [],
  uncertainties: [],
};

const validAssessment = {
  skill: 'comprehension',
  judgment: 'mixed_evidence',
  confidence: 0.76,
  evidence: ['The response identifies the central tension.'],
  weaknesses: [],
  mexicanSpanishNotes: [],
  uncertainties: ['The example is too brief to confirm the implied consequence.'],
};

const assessmentRequest = {
  rubricVersion: 'practical-c1-text.v2',
  skill: 'comprehension' as const,
  prompt: 'Explica la tensión y da un ejemplo.',
  learnerResponse: 'La eficiencia institucional puede perjudicar al usuario.',
  criteria: ['Identify the central tension.', 'Explain implied meaning.', 'Give a relevant example.'],
  supportLevel: 'none' as const,
};

describe('OllamaProvider', () => {
  it('reports the configured endpoint, model, context, version, and availability', async () => {
    const transport = new QueueTransport([
      jsonResponse({ version: '0.17.1' }),
      jsonResponse({ models: [{ name: 'qwen3.5:4b' }] }),
    ]);

    const result = await new OllamaProvider(config, transport).getDiagnostics();

    expect(result).toEqual({
      endpoint: config.baseUrl,
      model: config.model,
      contextLength: 4_096,
      providerVersion: '0.17.1',
      modelAvailable: true,
    });
  });

  it('returns a validated correction and sends hidden-thinking structured settings', async () => {
    const transport = new QueueTransport([
      jsonResponse({ message: { content: JSON.stringify(validProposal) } }),
    ]);

    const result = await new OllamaProvider(config, transport).proposeCorrection({
      learnerText: 'Si tendría más tiempo, viajaría más.',
    });

    expect(result).toEqual(validProposal);
    const body = JSON.parse(transport.requests[0]?.body ?? '{}') as Record<string, unknown>;
    expect(body).toMatchObject({
      model: 'qwen3.5:4b',
      stream: false,
      think: false,
      options: { num_ctx: 4_096, temperature: 0 },
    });
    expect(body).toHaveProperty('format.type', 'object');
    expect(JSON.stringify(body)).toContain('Never rename, omit, or add fields');
  });

  it('rejects non-JSON model content as a bad response', async () => {
    const provider = new OllamaProvider(
      config,
      new QueueTransport([jsonResponse({ message: { content: 'not json' } })]),
    );

    await expect(provider.proposeCorrection({ learnerText: 'Texto' })).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  it('rejects unsupported category and reference identifiers', async () => {
    const unsupported = {
      ...validProposal,
      issues: [
        {
          ...validProposal.issues[0],
          category: 'invented.category',
          referenceIds: ['invented.reference'],
        },
      ],
    };
    const provider = new OllamaProvider(
      config,
      new QueueTransport([jsonResponse({ message: { content: JSON.stringify(unsupported) } })]),
    );

    await expect(provider.proposeCorrection({ learnerText: 'Texto' })).rejects.toMatchObject({
      code: 'BAD_RESPONSE',
    });
  });

  it('evaluates the requested skill against supplied criteria and preserves specific uncertainty', async () => {
    const transport = new QueueTransport([
      jsonResponse({ message: { content: JSON.stringify(validAssessment) } }),
    ]);

    const result = await new OllamaProvider(config, transport).evaluateAssessment(assessmentRequest);

    expect(result).toEqual(validAssessment);
    const body = JSON.parse(transport.requests[0]?.body ?? '{}') as Record<string, unknown>;
    expect(JSON.stringify(body)).toContain('Requested skill: comprehension');
    expect(JSON.stringify(body)).toContain('Identify the central tension.');
    expect(JSON.stringify(body)).toContain('Support condition: none');
    expect(JSON.stringify(body)).toContain('<learner_response>');
  });

  it('rejects an assessment for a different skill or malformed rubric judgment', async () => {
    const wrongSkill = { ...validAssessment, skill: 'written_production' };
    const wrongJudgment = { ...validAssessment, judgment: 'c1_mastered' };
    const wrongSkillProvider = new OllamaProvider(
      config,
      new QueueTransport([jsonResponse({ message: { content: JSON.stringify(wrongSkill) } })]),
    );
    const wrongJudgmentProvider = new OllamaProvider(
      config,
      new QueueTransport([jsonResponse({ message: { content: JSON.stringify(wrongJudgment) } })]),
    );

    await expect(wrongSkillProvider.evaluateAssessment(assessmentRequest)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
    await expect(wrongJudgmentProvider.evaluateAssessment(assessmentRequest)).rejects.toMatchObject({ code: 'BAD_RESPONSE' });
  });

  it('maps transport failures to unavailable without retrying', async () => {
    const send = vi.fn().mockRejectedValue(new Error('connection refused'));
    const provider = new OllamaProvider(config, { send });

    await expect(provider.proposeCorrection({ learnerText: 'Texto' })).rejects.toMatchObject({
      code: 'UNAVAILABLE',
    });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('maps caller cancellation separately from timeout', async () => {
    const controller = new AbortController();
    const transport: HttpTransport = {
      send: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    };
    const provider = new OllamaProvider(config, transport);
    const result = provider.proposeCorrection({ learnerText: 'Texto', signal: controller.signal });
    controller.abort();

    await expect(result).rejects.toMatchObject({ code: 'CANCELLED' });
  });

  it('returns a timeout error when the local model takes too long', async () => {
    const transport: HttpTransport = {
      send: ({ signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
        }),
    };
    const provider = new OllamaProvider({ ...config, timeoutMs: 5 }, transport);

    try {
      await provider.proposeCorrection({ learnerText: 'Texto' });
      expect.fail('Expected timeout');
    } catch (error) {
      expect(error).toBeInstanceOf(AiProviderError);
      expect(error).toMatchObject({ code: 'TIMEOUT' });
    }
  });
});
