export interface DifficultyState {
  readonly linguisticComplexity: 1 | 2 | 3 | 4 | 5;
  readonly taskOpenness: 1 | 2 | 3 | 4 | 5;
  readonly timePressure: 1 | 2 | 3 | 4 | 5;
  readonly lexicalSupport: 0 | 1 | 2 | 3;
  readonly grammaticalHints: 0 | 1 | 2 | 3;
  readonly simultaneousTargets: 1 | 2 | 3;
  readonly topicFamiliarity: 1 | 2 | 3 | 4 | 5;
  readonly taskMode: 'comprehension' | 'production';
  readonly modality: 'written' | 'spoken';
}

export type DifficultyOutcome = 'ready_to_increase' | 'needs_support' | 'hold';

export interface DifficultyAdjustment {
  readonly state: DifficultyState;
  readonly changedDimension?: keyof DifficultyState;
  readonly reason: string;
}

const increase = <K extends keyof DifficultyState>(
  state: DifficultyState,
  key: K,
  maximum: number,
  reason: string,
): DifficultyAdjustment | undefined => {
  const current = state[key] as number;
  if (current >= maximum) return undefined;
  return {
    state: { ...state, [key]: current + 1 },
    changedDimension: key,
    reason,
  };
};

const decrease = <K extends keyof DifficultyState>(
  state: DifficultyState,
  key: K,
  minimum: number,
  reason: string,
): DifficultyAdjustment | undefined => {
  const current = state[key] as number;
  if (current <= minimum) return undefined;
  return {
    state: { ...state, [key]: current - 1 },
    changedDimension: key,
    reason,
  };
};

export const adjustDifficulty = (
  state: DifficultyState,
  outcome: DifficultyOutcome,
): DifficultyAdjustment => {
  if (outcome === 'hold') return { state, reason: 'Held difficulty while evidence remains mixed.' };

  if (outcome === 'ready_to_increase') {
    return (
      decrease(state, 'grammaticalHints', 0, 'Reduced grammatical hints after demonstrated control.') ??
      decrease(state, 'lexicalSupport', 0, 'Reduced lexical support after demonstrated control.') ??
      increase(state, 'linguisticComplexity', 5, 'Increased linguistic complexity after demonstrated control.') ??
      increase(state, 'taskOpenness', 5, 'Increased task openness after demonstrated control.') ??
      increase(state, 'timePressure', 5, 'Increased time pressure after demonstrated control.') ??
      increase(state, 'simultaneousTargets', 3, 'Increased simultaneous targets after demonstrated control.') ??
      { state, reason: 'Difficulty is already at the configured ceiling.' }
    );
  }

  return (
    increase(state, 'grammaticalHints', 3, 'Increased grammatical hints to add support.') ??
    increase(state, 'lexicalSupport', 3, 'Increased lexical support to add support.') ??
    decrease(state, 'simultaneousTargets', 1, 'Reduced simultaneous targets to isolate the weakness.') ??
    decrease(state, 'linguisticComplexity', 1, 'Reduced linguistic complexity to isolate the weakness.') ??
    decrease(state, 'taskOpenness', 1, 'Reduced task openness to isolate the weakness.') ??
    decrease(state, 'timePressure', 1, 'Reduced time pressure to isolate the weakness.') ??
    { state, reason: 'Difficulty is already at the configured floor.' }
  );
};
