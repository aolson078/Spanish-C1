import type { LearnerDecision } from '../../packages/persistence/src/models.js';

const sessionIdPattern = /^session-[A-Za-z0-9_-]{1,120}$/;
const weaknessIdPattern = /^weakness-[a-f0-9]{24}$/;
const assessmentIdPattern = /^assessment-[A-Za-z0-9_-]{1,117}$/;
const learnerDecisions = new Set<LearnerDecision>(['agree', 'disagree', 'unclear', 'defer']);

export const isSessionId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && sessionIdPattern.test(value);

export const isLearnerText = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= 5_000;

export const isLearnerDecision = (value: unknown): value is LearnerDecision =>
  typeof value === 'string' && learnerDecisions.has(value as LearnerDecision);

export const isWeaknessId = (value: unknown): value is string =>
  typeof value === 'string' && weaknessIdPattern.test(value);

export const isAssessmentId = (value: unknown): value is string =>
  typeof value === 'string' && value.length <= 128 && assessmentIdPattern.test(value);
