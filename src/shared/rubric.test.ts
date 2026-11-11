import { describe, expect, it } from 'vitest';
import { answerKey, progressFor, validateAnswers, type RubricFieldDef } from './rubric';
import { findComparativeWords, needsIndependenceCheck } from './independence';
import { naturalCompare } from './sort';

const scale: RubricFieldDef = {
  id: 'f1', key: 'content', order: 1, label: 'Content quality', type: 'SCALE', scope: 'PER_RESPONSE',
  required: true, config: { min: 1, max: 7 },
};
const why: RubricFieldDef = {
  id: 'f2', key: 'content_why', order: 2, label: 'Explain', type: 'TEXTAREA', scope: 'PER_RESPONSE',
  required: true, config: { minChars: 10 },
};
const ranking: RubricFieldDef = {
  id: 'f3', key: 'ranking', order: 3, label: 'Overall ranking', type: 'RANKING', scope: 'PER_TASK',
  required: true, config: {},
};
const responses = [{ id: 'a', label: 'A' }, { id: 'b', label: 'B' }];

describe('validateAnswers', () => {
  it('flags every missing required field', () => {
    const issues = validateAnswers([scale, why, ranking], responses, {});
    expect(issues).toHaveLength(5);
  });

  it('enforces minimum characters and scale bounds', () => {
    const issues = validateAnswers([scale, why], [responses[0]], {
      [answerKey('f1', 'a')]: 9,
      [answerKey('f2', 'a')]: 'too short',
    });
    expect(issues.map((i) => i.message)).toEqual(['Choose a score from 1 to 7', 'At least 10 characters (9 so far)']);
  });

  it('rejects duplicate ranks', () => {
    const issues = validateAnswers([ranking], responses, { [answerKey('f3', null)]: { rank1: 'a', rank2: 'a' } });
    expect(issues[0].message).toBe('Each response can only be used once');
  });

  it('passes a complete submission', () => {
    const answers = {
      [answerKey('f1', 'a')]: 5, [answerKey('f2', 'a')]: 'Covers the brief well.',
      [answerKey('f1', 'b')]: 3, [answerKey('f2', 'b')]: 'Misses the key figures.',
      [answerKey('f3', null)]: { rank1: 'a', rank2: 'b' },
    };
    expect(validateAnswers([scale, why, ranking], responses, answers)).toEqual([]);
  });
});

describe('progressFor', () => {
  it('counts fields done per response', () => {
    expect(progressFor([scale, why], responses, { [answerKey('f1', 'b')]: 4 }, 'b')).toEqual({ done: 1, total: 2 });
  });
});

describe('independence check', () => {
  it('only applies when the instructions ask for it', () => {
    expect(needsIndependenceCheck('<p>Please rate each response independently.</p>')).toBe(true);
    expect(needsIndependenceCheck('Compare them')).toBe(false);
  });

  it('finds comparative words', () => {
    expect(findComparativeWords('Better layout than Response B')).toEqual(['Response A/B/C/D', 'better']);
    expect(findComparativeWords('Clean layout with good spacing')).toEqual([]);
  });
});

describe('naturalCompare', () => {
  it('sorts slide2 before slide10', () => {
    expect(['slide10.png', 'slide2.png', 'slide1.png'].sort(naturalCompare)).toEqual(['slide1.png', 'slide2.png', 'slide10.png']);
  });
});
