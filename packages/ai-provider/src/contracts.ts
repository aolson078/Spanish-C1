import type { z } from 'zod';
import type { assessmentEvaluationSchema, correctionProposalSchema } from './schemas.js';
import type { AssessmentSkill } from '../../domain/src/assessment.js';

export type CorrectionProposal = z.infer<typeof correctionProposalSchema>;
export type AssessmentEvaluation = z.infer<typeof assessmentEvaluationSchema>;

export interface CorrectionRequest {
  readonly learnerText: string;
  readonly signal?: AbortSignal;
}

export interface ProviderDiagnostics {
  readonly endpoint: string;
  readonly model: string;
  readonly contextLength: number;
  readonly providerVersion: string;
  readonly modelAvailable: boolean;
}

export interface AssessmentEvaluationRequest {
  readonly rubricVersion: string;
  readonly skill: AssessmentSkill;
  readonly prompt: string;
  readonly learnerResponse: string;
  readonly criteria: readonly string[];
  readonly supportLevel: 'minimal' | 'none';
  readonly signal?: AbortSignal;
}

export interface AiProvider {
  getDiagnostics(signal?: AbortSignal): Promise<ProviderDiagnostics>;
  proposeCorrection(request: CorrectionRequest): Promise<CorrectionProposal>;
  evaluateAssessment(request: AssessmentEvaluationRequest): Promise<AssessmentEvaluation>;
}

export interface HttpRequest {
  readonly url: string;
  readonly method: 'GET' | 'POST';
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly signal: AbortSignal;
}

export interface HttpResponse {
  readonly ok: boolean;
  readonly status: number;
  json(): Promise<unknown>;
}

export interface HttpTransport {
  send(request: HttpRequest): Promise<HttpResponse>;
}
