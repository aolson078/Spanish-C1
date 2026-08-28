import { describe, expect, it } from 'vitest';
import { adjustDifficulty, type DifficultyState } from './difficulty.js';

const baseline: DifficultyState = {
  linguisticComplexity: 3,
  taskOpenness: 3,
  timePressure: 2,
  lexicalSupport: 1,
  grammaticalHints: 1,
  simultaneousTargets: 1,
  topicFamiliarity: 3,
  taskMode: 'production',
  modality: 'written',
};

const changedKeys = (before: DifficultyState, after: DifficultyState) =>
  (Object.keys(before) as (keyof DifficultyState)[]).filter((key) => before[key] !== after[key]);

describe('controlled difficulty', () => {
  it('removes only one support dimension after demonstrated control', () => {
    const result = adjustDifficulty(baseline, 'ready_to_increase');

    expect(result.changedDimension).toBe('grammaticalHints');
    expect(result.state.grammaticalHints).toBe(0);
    expect(changedKeys(baseline, result.state)).toEqual(['grammaticalHints']);
  });

  it('adds only one support dimension after repeated failure', () => {
    const result = adjustDifficulty(baseline, 'needs_support');

    expect(result.changedDimension).toBe('grammaticalHints');
    expect(result.state.grammaticalHints).toBe(2);
    expect(changedKeys(baseline, result.state)).toEqual(['grammaticalHints']);
  });

  it('holds all dimensions when evidence is mixed', () => {
    const result = adjustDifficulty(baseline, 'hold');

    expect(result.state).toBe(baseline);
    expect(result.changedDimension).toBeUndefined();
  });

  it('keeps every dimension within its configured bounds across repeated adjustments', () => {
    let state = baseline;
    for (let index = 0; index < 50; index += 1) {
      const before = state;
      state = adjustDifficulty(state, 'ready_to_increase').state;
      expect(changedKeys(before, state).length).toBeLessThanOrEqual(1);
    }
    expect(state).toEqual({
      linguisticComplexity: 5,
      taskOpenness: 5,
      timePressure: 5,
      lexicalSupport: 0,
      grammaticalHints: 0,
      simultaneousTargets: 3,
      topicFamiliarity: 3,
      taskMode: 'production',
      modality: 'written',
    });
  });
});
