export const assessmentRubricVersion = 'practical-c1-text.v2';

export const assessmentSkills = [
  'written_production',
  'comprehension',
  'grammatical_control',
  'lexical_precision_range',
  'cohesion_discourse',
  'register_pragmatics',
  'mexican_spanish_naturalness',
] as const;

export type AssessmentSkill = (typeof assessmentSkills)[number];
export type AssessmentJudgment = 'strong_evidence' | 'mixed_evidence' | 'limited_evidence' | 'not_assessable';

export const assessmentRubric: Readonly<Record<AssessmentSkill, {
  readonly label: string;
  readonly criteria: readonly string[];
}>> = {
  written_production: {
    label: 'Written production',
    criteria: [
      'Completes the requested communicative task with developed, relevant ideas.',
      'Expresses qualifications, implications, and objections precisely.',
      'Maintains clarity and control across 120–180 words.',
    ],
  },
  comprehension: {
    label: 'Comprehension',
    criteria: [
      'Identifies the central relationship or tension in the source statement.',
      'Explains implied meaning without contradicting the source.',
      'Supports the interpretation with a relevant concrete example.',
    ],
  },
  grammatical_control: {
    label: 'Grammatical control',
    criteria: [
      'Uses the requested tense, mood, and clause relationships accurately.',
      'Sustains agreement and reference clearly across complex sentences.',
      'Errors are infrequent and do not obscure temporal or hypothetical meaning.',
    ],
  },
  lexical_precision_range: {
    label: 'Lexical precision and range',
    criteria: [
      'Distinguishes the requested near-synonyms by meaning and usage.',
      'Selects precise collocations and avoids vague substitution.',
      'Uses varied vocabulary naturally in context.',
    ],
  },
  cohesion_discourse: {
    label: 'Cohesion and discourse',
    criteria: [
      'Organizes contrasting positions and consequences into a coherent progression.',
      'Uses varied connectors whose logical relationships are accurate.',
      'Ends with a conclusion that follows from and qualifies the argument.',
    ],
  },
  register_pragmatics: {
    label: 'Register and pragmatics',
    criteria: [
      'Matches formality, directness, and politeness to the relationship and purpose.',
      'Performs the requested speech act without unintended hostility or ambiguity.',
      'Uses tactful mitigation while keeping the requested action clear.',
    ],
  },
  mexican_spanish_naturalness: {
    label: 'Mexican-Spanish naturalness',
    criteria: [
      'Sounds natural and socially appropriate in contemporary Mexican Spanish.',
      'Avoids regionally mismatched wording when a common Mexican form is expected.',
      'Balances responsibility, warmth, and clarity for the stated relationship.',
    ],
  },
};

export interface AssessmentProposal {
  readonly skill: AssessmentSkill;
  readonly judgment: AssessmentJudgment;
  readonly confidence: number;
  readonly evidence: readonly string[];
  readonly weaknesses: readonly {
    readonly category: string;
    readonly explanation: string;
    readonly confidence: number;
    readonly referenceIds: readonly string[];
  }[];
  readonly mexicanSpanishNotes: readonly string[];
  readonly uncertainties: readonly string[];
}

export interface AssessmentPrompt {
  readonly id: string;
  readonly skill: AssessmentSkill;
  readonly prompt: string;
  readonly rubricCriteria: readonly string[];
  readonly supportGuidance?: string;
}

const topics = [
  'la movilidad urbana', 'el acceso a espacios verdes', 'la jornada laboral', 'la vivienda asequible',
  'la educación digital', 'el turismo local', 'la gestión del agua', 'la inteligencia artificial',
  'la salud preventiva', 'el comercio de barrio', 'el transporte público', 'la participación ciudadana',
] as const;
const audiences = [
  'un comité vecinal', 'una dirección de empresa', 'un ayuntamiento', 'un grupo de colegas',
  'una asociación civil', 'una universidad', 'un equipo internacional', 'una comunidad profesional',
  'un consejo escolar', 'una cooperativa', 'un medio local',
] as const;
const constraints = [
  'reconoce un costo importante', 'anticipa una objeción razonable', 'distingue el corto y el largo plazo',
  'incluye una condición para que funcione', 'señala una consecuencia imprevista', 'propón cómo medir el resultado',
  'matiza una afirmación demasiado general', 'compara dos grupos afectados', 'explica un riesgo de implementación',
  'concede un punto a la postura contraria',
] as const;

const select = <T>(values: readonly T[], sequence: number, offset: number): T =>
  values[(sequence * [1, 3, 7][offset]! + offset * 7) % values.length]!;

const buildPrompts = (
  sequence: number,
  supportLevel: AssessmentProgress['supportLevel'],
): readonly AssessmentPrompt[] => {
  const topic = select(topics, sequence, 0);
  const audience = select(audiences, sequence, 1);
  const constraint = select(constraints, sequence, 2);
  const marker = `escenario ${sequence + 1}`;
  const prompts: readonly Omit<AssessmentPrompt, 'rubricCriteria' | 'supportGuidance'>[] = [
    { id: `wp-${sequence}`, skill: 'written_production', prompt: `Escribe 120–180 palabras para ${audience} proponiendo una medida sobre ${topic}; ${constraint}. (${marker})` },
    { id: `co-${sequence}`, skill: 'comprehension', prompt: `Interpreta para ${audience} esta afirmación sobre ${topic}: «Una solución puede ser eficiente para una institución y contraproducente para quienes la usan». Explica la tensión, da un ejemplo y ${constraint}. (${marker})` },
    { id: `gc-${sequence}`, skill: 'grammatical_control', prompt: `Describe para ${audience} una decisión sobre ${topic}; formula una condición real, una hipótesis presente y una consecuencia contrafactual pasada; ${constraint}. (${marker})` },
    { id: `lp-${sequence}`, skill: 'lexical_precision_range', prompt: `Explica a ${audience}, en el contexto de ${topic}, la diferencia entre indicio, evidencia, prueba y certeza; ${constraint}. (${marker})` },
    { id: `cd-${sequence}`, skill: 'cohesion_discourse', prompt: `Compara dos respuestas posibles a ${topic}, conecta causas y consecuencias y presenta una recomendación matizada para ${audience}; ${constraint}. (${marker})` },
    { id: `rp-${sequence}`, skill: 'register_pragmatics', prompt: `Escribe a ${audience} para cuestionar con tacto una decisión sobre ${topic}, mantener la colaboración y proponer una alternativa; ${constraint}. (${marker})` },
    { id: `mx-${sequence}`, skill: 'mexican_spanish_naturalness', prompt: `Explica de manera natural a una persona mexicana de confianza un malentendido entre tú y ${audience} relacionado con ${topic}; asume tu parte sin sonar acusatorio, propón una solución y ${constraint}. (${marker})` },
  ];
  return prompts.map((prompt) => ({
    ...prompt,
    rubricCriteria: assessmentRubric[prompt.skill].criteria,
    supportGuidance: supportLevel === 'minimal'
      ? `Apoyo: organiza primero propósito, dos ideas desarrolladas y una conclusión; ${constraint}.`
      : undefined,
  }));
};

export interface AssessmentStep extends AssessmentPrompt {
  readonly response?: string;
  readonly proposal?: AssessmentProposal;
}

export interface AssessmentProgress {
  readonly rubricVersion: typeof assessmentRubricVersion;
  readonly promptSequence: number;
  readonly supportLevel: 'minimal' | 'none';
  readonly currentIndex: number;
  readonly steps: readonly AssessmentStep[];
}

export interface SkillProfileEntry {
  readonly status: 'sampled' | 'not_sampled';
  readonly evidencePromptIds: readonly string[];
  readonly judgment?: AssessmentJudgment;
  readonly modelConfidence?: number;
  readonly evidence: readonly string[];
  readonly uncertainties: readonly string[];
}

export interface AssessmentProfile {
  readonly rubricVersion: typeof assessmentRubricVersion;
  readonly dimensions: Readonly<Record<AssessmentSkill | 'spoken_comprehension_production', SkillProfileEntry>>;
  readonly initialWeaknesses: readonly {
    readonly key: string;
    readonly skills: readonly AssessmentSkill[];
    readonly evidencePromptIds: readonly string[];
    readonly observationCount: number;
    readonly modelConfidence: number;
    readonly referenceIds: readonly string[];
    readonly uncertainty: string;
  }[];
}

export const startAssessmentProgress = (
  promptSequence: number,
  supportLevel: AssessmentProgress['supportLevel'] = 'minimal',
): AssessmentProgress => {
  if (!Number.isSafeInteger(promptSequence) || promptSequence < 0) throw new RangeError('Prompt sequence must be a non-negative integer.');
  return {
    rubricVersion: assessmentRubricVersion,
    promptSequence,
    supportLevel,
    currentIndex: 0,
    steps: buildPrompts(promptSequence, supportLevel),
  };
};

export const recordAssessmentStep = (
  progress: AssessmentProgress,
  response: string,
  proposal: AssessmentProposal,
): AssessmentProgress => {
  if (progress.currentIndex >= progress.steps.length) throw new RangeError('Assessment is already complete.');
  const current = progress.steps[progress.currentIndex]!;
  if (proposal.skill !== current.skill) throw new RangeError('Assessment evaluation does not match the requested skill.');
  return {
    ...progress,
    currentIndex: progress.currentIndex + 1,
    steps: progress.steps.map((step, index) => index === progress.currentIndex ? { ...step, response, proposal } : step),
  };
};

export const buildAssessmentProfile = (progress: AssessmentProgress): AssessmentProfile => {
  if (progress.currentIndex !== progress.steps.length) throw new RangeError('Assessment is incomplete.');
  const weaknessEvidence = new Map<string, {
    skills: Set<AssessmentSkill>;
    promptIds: Set<string>;
    confidences: number[];
    referenceIds: Set<string>;
  }>();
  const sampled = {} as Record<AssessmentSkill, SkillProfileEntry>;
  for (const step of progress.steps) {
    if (!step.proposal) throw new RangeError('Completed assessment evidence is missing.');
    sampled[step.skill] = {
      status: 'sampled',
      evidencePromptIds: [step.id],
      judgment: step.proposal.judgment,
      modelConfidence: step.proposal.confidence,
      evidence: step.proposal.evidence,
      uncertainties: [...step.proposal.uncertainties, 'This is a local-model judgment from one written sample, not verified C1 mastery.'],
    };
    for (const weakness of step.proposal.weaknesses) {
      const evidence = weaknessEvidence.get(weakness.category) ?? {
        skills: new Set<AssessmentSkill>(), promptIds: new Set<string>(), confidences: [], referenceIds: new Set<string>(),
      };
      evidence.skills.add(step.skill);
      evidence.promptIds.add(step.id);
      evidence.confidences.push(weakness.confidence);
      for (const referenceId of weakness.referenceIds) evidence.referenceIds.add(referenceId);
      weaknessEvidence.set(weakness.category, evidence);
    }
  }
  return {
    rubricVersion: assessmentRubricVersion,
    initialWeaknesses: [...weaknessEvidence].map(([key, evidence]) => ({
      key,
      skills: [...evidence.skills],
      evidencePromptIds: [...evidence.promptIds],
      observationCount: evidence.confidences.length,
      modelConfidence: Number((evidence.confidences.reduce((sum, value) => sum + value, 0) / evidence.confidences.length).toFixed(6)),
      referenceIds: [...evidence.referenceIds],
      uncertainty: 'Model-proposed weakness; learner or deterministic reference verification is still required.',
    })),
    dimensions: {
      ...sampled,
      spoken_comprehension_production: {
        status: 'not_sampled',
        evidencePromptIds: [],
        evidence: [],
        uncertainties: ['This text assessment did not sample spoken performance, so no spoken-language claim is made.'],
      },
    },
  };
};

export type ProfileTrend = 'stronger_evidence' | 'weaker_evidence' | 'same_evidence_band' | 'insufficient_evidence';
const judgmentRank: Readonly<Record<AssessmentJudgment, number>> = {
  not_assessable: 0,
  limited_evidence: 1,
  mixed_evidence: 2,
  strong_evidence: 3,
};

export const compareAssessmentProfiles = (
  previous: AssessmentProfile | undefined,
  current: AssessmentProfile,
): Readonly<Record<AssessmentSkill, ProfileTrend>> => Object.fromEntries(
  assessmentSkills.map((skill) => {
    const before = previous?.rubricVersion === current.rubricVersion ? previous.dimensions[skill].judgment : undefined;
    const after = current.dimensions[skill].judgment;
    const trend: ProfileTrend = before === undefined || after === undefined || before === 'not_assessable' || after === 'not_assessable'
      ? 'insufficient_evidence'
      : judgmentRank[after] > judgmentRank[before]
        ? 'stronger_evidence'
        : judgmentRank[after] < judgmentRank[before]
          ? 'weaker_evidence'
          : 'same_evidence_band';
    return [skill, trend];
  }),
) as Record<AssessmentSkill, ProfileTrend>;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isSkill = (value: unknown): value is AssessmentSkill => assessmentSkills.includes(value as AssessmentSkill);
const isJudgment = (value: unknown): value is AssessmentJudgment =>
  ['strong_evidence', 'mixed_evidence', 'limited_evidence', 'not_assessable'].includes(String(value));
const isConfidence = (value: unknown): value is number => typeof value === 'number' && value >= 0 && value <= 1;
const isAssessmentProposal = (value: unknown, skill: AssessmentSkill): value is AssessmentProposal => {
  if (!isRecord(value) || value.skill !== skill || !isJudgment(value.judgment) || !isConfidence(value.confidence)
    || !isStringArray(value.evidence) || !Array.isArray(value.weaknesses)
    || !isStringArray(value.mexicanSpanishNotes) || !isStringArray(value.uncertainties)) return false;
  return value.weaknesses.every((weakness) => isRecord(weakness) && typeof weakness.category === 'string'
    && typeof weakness.explanation === 'string' && isConfidence(weakness.confidence)
    && isStringArray(weakness.referenceIds));
};

export const isAssessmentProgress = (value: unknown): value is AssessmentProgress => {
  if (!isRecord(value) || value.rubricVersion !== assessmentRubricVersion || !Number.isSafeInteger(value.promptSequence)
    || Number(value.promptSequence) < 0 || !['minimal', 'none'].includes(String(value.supportLevel))
    || !Number.isSafeInteger(value.currentIndex) || !Array.isArray(value.steps) || value.steps.length !== assessmentSkills.length
    || Number(value.currentIndex) < 0 || Number(value.currentIndex) > value.steps.length) return false;
  const canonical = buildPrompts(Number(value.promptSequence), value.supportLevel as AssessmentProgress['supportLevel']);
  return value.steps.every((step, index) => {
    const expected = canonical[index]!;
    if (!isRecord(step) || typeof step.id !== 'string' || !isSkill(step.skill) || typeof step.prompt !== 'string'
      || step.skill !== assessmentSkills[index] || !isStringArray(step.rubricCriteria)
      || (value.supportLevel === 'minimal' && typeof step.supportGuidance !== 'string')
      || (value.supportLevel === 'none' && step.supportGuidance !== undefined)) return false;
    if (step.id !== expected.id || step.prompt !== expected.prompt
      || step.supportGuidance !== expected.supportGuidance
      || step.rubricCriteria.length !== expected.rubricCriteria.length
      || step.rubricCriteria.some((criterion, criterionIndex) => criterion !== expected.rubricCriteria[criterionIndex])) return false;
    if (index >= Number(value.currentIndex)) return true;
    return typeof step.response === 'string' && isAssessmentProposal(step.proposal, step.skill);
  });
};

export const isAssessmentProfile = (value: unknown): value is AssessmentProfile => {
  if (!isRecord(value) || value.rubricVersion !== assessmentRubricVersion || !isRecord(value.dimensions)
    || !Array.isArray(value.initialWeaknesses)) return false;
  const dimensions = value.dimensions;
  const dimensionsValid = [...assessmentSkills, 'spoken_comprehension_production'].every((skill) => {
    const dimension = dimensions[skill];
    if (!isRecord(dimension) || !['sampled', 'not_sampled'].includes(String(dimension.status))) return false;
    if (!isStringArray(dimension.evidencePromptIds) || !isStringArray(dimension.evidence)
      || !isStringArray(dimension.uncertainties)) return false;
    return dimension.status === 'not_sampled'
      ? dimension.judgment === undefined && dimension.modelConfidence === undefined
      : isJudgment(dimension.judgment) && isConfidence(dimension.modelConfidence);
  });
  return dimensionsValid && value.initialWeaknesses.every((weakness) => isRecord(weakness)
    && typeof weakness.key === 'string' && Array.isArray(weakness.skills) && weakness.skills.every(isSkill)
    && isStringArray(weakness.evidencePromptIds) && Number.isSafeInteger(weakness.observationCount)
    && Number(weakness.observationCount) > 0 && isConfidence(weakness.modelConfidence)
    && isStringArray(weakness.referenceIds) && typeof weakness.uncertainty === 'string');
};

export const isProfileComparison = (value: unknown): value is Readonly<Record<AssessmentSkill, ProfileTrend>> =>
  isRecord(value) && assessmentSkills.every((skill) =>
    ['stronger_evidence', 'weaker_evidence', 'same_evidence_band', 'insufficient_evidence'].includes(String(value[skill])),
  );
