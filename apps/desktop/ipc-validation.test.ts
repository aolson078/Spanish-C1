import { describe, expect, it } from 'vitest';
import { isAssessmentId, isLearnerDecision, isLearnerText, isSessionId, isWeaknessId } from './ipc-validation.js';

describe('desktop IPC validation', () => {
  it.each([
    undefined,
    null,
    42,
    '',
    'session-',
    'other-id',
    'session-with spaces',
    `session-${'a'.repeat(121)}`,
  ])('rejects invalid or oversized session IDs: %s', (value) => {
    expect(isSessionId(value)).toBe(false);
  });

  it('accepts generated and test session IDs within the boundary', () => {
    expect(isSessionId('session-550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isSessionId('session-ui_1')).toBe(true);
  });

  it('bounds learner text after trimming without changing the submitted value', () => {
    expect(isLearnerText('   ')).toBe(false);
    expect(isLearnerText('a'.repeat(5_001))).toBe(false);
    expect(isLearnerText('Una respuesta.')).toBe(true);
  });

  it.each(['agree', 'disagree', 'unclear', 'defer'] as const)('accepts decision %s', (decision) => {
    expect(isLearnerDecision(decision)).toBe(true);
  });

  it.each([undefined, '', 'accepted', 'AGREE', 1])('rejects invalid decision %s', (decision) => {
    expect(isLearnerDecision(decision)).toBe(false);
  });

  it('accepts only stable hash-based weakness IDs', () => {
    expect(isWeaknessId('weakness-0123456789abcdef01234567')).toBe(true);
    expect(isWeaknessId('weakness-1')).toBe(false);
    expect(isWeaknessId(`weakness-${'a'.repeat(25)}`)).toBe(false);
    expect(isWeaknessId('weakness-0123456789ABCDEF01234567')).toBe(false);
  });

  it('bounds assessment IDs', () => {
    expect(isAssessmentId('assessment-550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    expect(isAssessmentId('assessment-')).toBe(false);
    expect(isAssessmentId('assessment-with spaces')).toBe(false);
    expect(isAssessmentId(`assessment-${'a'.repeat(118)}`)).toBe(false);
  });
});
