import { describe, expect, it } from 'vitest';
import {
  assessmentRubric,
  assessmentRubricVersion,
  assessmentSkills,
  buildAssessmentProfile,
  compareAssessmentProfiles,
  isAssessmentProfile,
  isAssessmentProgress,
  recordAssessmentStep,
  startAssessmentProgress,
  type AssessmentJudgment,
  type AssessmentSkill,
} from './assessment.js';

const proposal = (
  skill: AssessmentSkill,
  judgment: AssessmentJudgment,
  weaknessCount = 1,
) => ({
  skill,
  judgment,
  confidence: 0.82,
  evidence: [`Evidence for ${skill}.`],
  weaknesses: Array.from({ length: weaknessCount }, () => ({
    category: 'grammar.conditional.si_clause',
    confidence: 0.8,
    explanation: 'Model proposal.',
    referenceIds: ['conditional.present_hypothetical'],
  })),
  mexicanSpanishNotes: [],
  uncertainties: [`Specific uncertainty for ${skill}.`],
});

const complete = (sequence: number, judgment: AssessmentJudgment) => {
  let progress = startAssessmentProgress(sequence, sequence === 0 ? 'minimal' : 'none');
  while (progress.currentIndex < progress.steps.length) {
    const step = progress.steps[progress.currentIndex]!;
    progress = recordAssessmentStep(progress, 'Respuesta sintética.', proposal(step.skill, judgment));
  }
  return buildAssessmentProfile(progress);
};

describe('stable practical-C1 text assessment', () => {
  it('keeps skill-specific criteria stable across unfamiliar prompt sequences', () => {
    const seenPrompts = new Set<string>();
    for (let sequence = 0; sequence < 660; sequence += 1) {
      const progress = startAssessmentProgress(sequence, sequence === 0 ? 'minimal' : 'none');
      expect(progress.rubricVersion).toBe(assessmentRubricVersion);
      expect(progress.steps.map((step) => step.skill)).toEqual(assessmentSkills);
      for (const step of progress.steps) {
        expect(step.rubricCriteria).toEqual(assessmentRubric[step.skill].criteria);
        const semanticPrompt = step.prompt.replace(/ \(escenario \d+\)$/, '');
        expect(seenPrompts.has(semanticPrompt), `duplicate sequence ${sequence}: ${semanticPrompt}`).toBe(false);
        seenPrompts.add(semanticPrompt);
      }
    }
  });

  it('shows baseline scaffolding and removes it from checkpoints', () => {
    expect(startAssessmentProgress(0, 'minimal').steps.every((step) => step.supportGuidance)).toBe(true);
    expect(startAssessmentProgress(1, 'none').steps.every((step) => step.supportGuidance === undefined)).toBe(true);
  });

  it('builds a confidence-bearing evidence profile with actual model uncertainty and no score', () => {
    const profile = complete(0, 'mixed_evidence');
    expect(profile.dimensions.written_production).toMatchObject({
      status: 'sampled',
      evidencePromptIds: ['wp-0'],
      judgment: 'mixed_evidence',
      modelConfidence: 0.82,
      evidence: ['Evidence for written_production.'],
    });
    expect(profile.dimensions.written_production.uncertainties).toContain('Specific uncertainty for written_production.');
    expect(profile.dimensions.spoken_comprehension_production).toMatchObject({
      status: 'not_sampled',
      evidencePromptIds: [],
    });
    expect(profile.initialWeaknesses[0]).toMatchObject({
      key: 'grammar.conditional.si_clause',
      skills: assessmentSkills,
      observationCount: 7,
      modelConfidence: 0.8,
      referenceIds: ['conditional.present_hypothetical'],
    });
    expect(profile).not.toHaveProperty('score');
  });

  it('compares the same rubric judgment bands and rejects incompatible evidence', () => {
    const trends = compareAssessmentProfiles(complete(0, 'limited_evidence'), complete(1, 'strong_evidence'));
    expect(Object.values(trends)).toEqual(assessmentSkills.map(() => 'stronger_evidence'));
    const incompatible = { ...complete(0, 'limited_evidence'), rubricVersion: 'old-rubric' } as never;
    expect(Object.values(compareAssessmentProfiles(incompatible, complete(1, 'strong_evidence'))))
      .toEqual(assessmentSkills.map(() => 'insufficient_evidence'));
  });

  it('refuses incomplete, mismatched, or structurally invalid durable state', () => {
    const progress = startAssessmentProgress(0);
    expect(() => buildAssessmentProfile(progress)).toThrow('incomplete');
    expect(() => recordAssessmentStep(progress, 'Respuesta.', proposal('comprehension', 'mixed_evidence')))
      .toThrow('does not match');
    expect(isAssessmentProgress(progress)).toBe(true);
    expect(isAssessmentProgress({ ...progress, steps: [{ id: 'broken' }] })).toBe(false);
    expect(isAssessmentProgress({
      ...progress,
      steps: progress.steps.map((step, index) => index === 0 ? { ...step, rubricCriteria: ['changed'] } : step),
    })).toBe(false);
    expect(isAssessmentProfile({ rubricVersion: assessmentRubricVersion, dimensions: {}, initialWeaknesses: [] })).toBe(false);
  });
});
