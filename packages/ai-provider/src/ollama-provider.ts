import type {
  AiProvider,
  AssessmentEvaluation,
  AssessmentEvaluationRequest,
  CorrectionProposal,
  CorrectionRequest,
  HttpTransport,
  ProviderDiagnostics,
} from './contracts.js';
import type { OllamaProviderConfig } from './config.js';
import { AiProviderError } from './errors.js';
import { assessmentPromptVersion, assessmentSystemPrompt, correctionPromptVersion, correctionSystemPrompt } from './prompt.js';
import {
  assessmentEvaluationSchema,
  correctionProposalSchema,
  ollamaChatSchema,
  ollamaTagsSchema,
  ollamaVersionSchema,
} from './schemas.js';

const responseFormat = {
  type: 'object',
  additionalProperties: false,
  required: ['correctedText', 'issues', 'mexicanSpanishNotes', 'uncertainties'],
  properties: {
    correctedText: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'span', 'replacement', 'explanation', 'confidence', 'referenceIds'],
        properties: {
          category: {
            enum: [
              'grammar.conditional.si_clause',
              'grammar.subjunctive',
              'grammar.tense_aspect',
              'grammar.agreement',
              'lexicon.precision',
              'discourse.cohesion',
              'pragmatics.register',
            ],
          },
          span: { type: 'string' },
          replacement: { type: 'string' },
          explanation: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          referenceIds: {
            type: 'array',
            items: {
              enum: [
                'conditional.present_hypothetical',
                'conditional.real_present_future',
                'conditional.past_counterfactual',
              ],
            },
          },
        },
      },
    },
    mexicanSpanishNotes: { type: 'array', items: { type: 'string' } },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
} as const;

const assessmentResponseFormat = {
  type: 'object',
  additionalProperties: false,
  required: ['skill', 'judgment', 'confidence', 'evidence', 'weaknesses', 'mexicanSpanishNotes', 'uncertainties'],
  properties: {
    skill: { enum: ['written_production', 'comprehension', 'grammatical_control', 'lexical_precision_range', 'cohesion_discourse', 'register_pragmatics', 'mexican_spanish_naturalness'] },
    judgment: { enum: ['strong_evidence', 'mixed_evidence', 'limited_evidence', 'not_assessable'] },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    evidence: { type: 'array', items: { type: 'string' } },
    weaknesses: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['category', 'explanation', 'confidence', 'referenceIds'],
        properties: {
          category: { enum: ['grammar.conditional.si_clause', 'grammar.subjunctive', 'grammar.tense_aspect', 'grammar.agreement', 'lexicon.precision', 'discourse.cohesion', 'pragmatics.register'] },
          explanation: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          referenceIds: { type: 'array', items: { enum: ['conditional.present_hypothetical', 'conditional.real_present_future', 'conditional.past_counterfactual'] } },
        },
      },
    },
    mexicanSpanishNotes: { type: 'array', items: { type: 'string' } },
    uncertainties: { type: 'array', items: { type: 'string' } },
  },
} as const;

export class OllamaProvider implements AiProvider {
  constructor(
    private readonly config: OllamaProviderConfig,
    private readonly transport: HttpTransport,
  ) {}

  async getDiagnostics(signal?: AbortSignal): Promise<ProviderDiagnostics> {
    const version = ollamaVersionSchema.parse(
      await this.requestJson('/api/version', 'GET', undefined, signal),
    );
    const tags = ollamaTagsSchema.parse(await this.requestJson('/api/tags', 'GET', undefined, signal));
    const modelAvailable = tags.models.some(
      (candidate) => candidate.name === this.config.model || candidate.model === this.config.model,
    );

    return {
      endpoint: this.config.baseUrl,
      model: this.config.model,
      contextLength: this.config.contextLength,
      providerVersion: version.version,
      modelAvailable,
    };
  }

  async proposeCorrection(request: CorrectionRequest): Promise<CorrectionProposal> {
    const payload = {
      model: this.config.model,
      stream: false,
      think: this.config.think,
      format: responseFormat,
      options: { num_ctx: this.config.contextLength, temperature: 0 },
      messages: [
        { role: 'system', content: correctionSystemPrompt },
        {
          role: 'user',
          content: `Prompt version: ${correctionPromptVersion}\nAnalyze this learner text:\n${request.learnerText}`,
        },
      ],
    };

    const raw = ollamaChatSchema.parse(
      await this.requestJson('/api/chat', 'POST', payload, request.signal),
    );

    let proposal: unknown;
    try {
      proposal = JSON.parse(raw.message.content);
    } catch (error) {
      throw new AiProviderError('BAD_RESPONSE', 'Ollama returned correction content that was not JSON.', {
        cause: error,
      });
    }

    const parsed = correctionProposalSchema.safeParse(proposal);
    if (!parsed.success) {
      throw new AiProviderError('BAD_RESPONSE', 'Ollama returned a correction that failed validation.', {
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  async evaluateAssessment(request: AssessmentEvaluationRequest): Promise<AssessmentEvaluation> {
    const payload = {
      model: this.config.model,
      stream: false,
      think: this.config.think,
      format: assessmentResponseFormat,
      options: { num_ctx: this.config.contextLength, temperature: 0 },
      messages: [
        { role: 'system', content: assessmentSystemPrompt },
        {
          role: 'user',
          content: [
            `Prompt version: ${assessmentPromptVersion}`,
            `Rubric version: ${request.rubricVersion}`,
            `Requested skill: ${request.skill}`,
            `Support condition: ${request.supportLevel}`,
            `Task: ${request.prompt}`,
            `Criteria:\n- ${request.criteria.join('\n- ')}`,
            `Learner response:\n<learner_response>\n${request.learnerResponse}\n</learner_response>`,
          ].join('\n'),
        },
      ],
    };
    const raw = ollamaChatSchema.parse(await this.requestJson('/api/chat', 'POST', payload, request.signal));
    let evaluation: unknown;
    try {
      evaluation = JSON.parse(raw.message.content);
    } catch (error) {
      throw new AiProviderError('BAD_RESPONSE', 'Ollama returned assessment content that was not JSON.', { cause: error });
    }
    const parsed = assessmentEvaluationSchema.safeParse(evaluation);
    if (!parsed.success || parsed.data.skill !== request.skill) {
      throw new AiProviderError('BAD_RESPONSE', 'Ollama returned an assessment that failed validation.', {
        cause: parsed.success ? new Error('Assessment skill did not match the request.') : parsed.error,
      });
    }
    return parsed.data;
  }

  private async requestJson(
    path: string,
    method: 'GET' | 'POST',
    body: unknown,
    callerSignal?: AbortSignal,
  ): Promise<unknown> {
    const timeoutSignal = AbortSignal.timeout(this.config.timeoutMs);
    const signal = callerSignal ? AbortSignal.any([callerSignal, timeoutSignal]) : timeoutSignal;

    try {
      const response = await this.transport.send({
        url: `${this.config.baseUrl}${path}`,
        method,
        headers: body === undefined ? undefined : { 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        const code = response.status === 404 ? 'MODEL_UNAVAILABLE' : 'UNAVAILABLE';
        throw new AiProviderError(code, `Ollama request failed with HTTP ${response.status}.`);
      }
      return await response.json();
    } catch (error) {
      if (error instanceof AiProviderError) {
        throw error;
      }
      if (callerSignal?.aborted) {
        throw new AiProviderError('CANCELLED', 'The Ollama request was cancelled.', { cause: error });
      }
      if (timeoutSignal.aborted) {
        throw new AiProviderError('TIMEOUT', 'The Ollama request timed out.', { cause: error });
      }
      throw new AiProviderError('UNAVAILABLE', 'Ollama is unavailable.', { cause: error });
    }
  }
}
