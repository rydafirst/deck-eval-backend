import { describe, expect, it } from 'vitest';
import type { RubricFieldDef } from '../shared';
import { ruleIssues } from './rationale-rules';

const field = (key: string, scope: RubricFieldDef['scope'], label = key): RubricFieldDef => ({
  id: key,
  key,
  label,
  type: 'TEXTAREA',
  scope,
  order: 0,
  required: true,
  config: {},
});

const fields = [
  field('content_quality_explanation', 'PER_RESPONSE', 'Content quality: explanation'),
  field('writing_style_explanation', 'PER_RESPONSE', 'Writing style: explanation'),
  field('overall_explanation', 'PER_RESPONSE', 'Overall: explanation'),
  field('ranking_rationale', 'PER_TASK', 'What drove the ranking?'),
];
const responses = [
  { id: 'a', label: 'A' },
  { id: 'b', label: 'B' },
];

const check = (perResponse: Record<string, string>, task: Record<string, string> = {}) =>
  ruleIssues({ responses: { A: perResponse }, task }, fields, responses);

describe('ruleIssues', () => {
  it('flags an invented label and too many examples', () => {
    const issues = check({
      content_quality_explanation: [
        'Accuracy: Slide 3 shows "15 of 20". Slide 4 shows 2.5x at 5 TB. Also, slide 5 bar values match the sheet.',
        'Problem: Slide 7 puts the "BigQuery" heading over Databricks gaps.',
      ].join('\n'),
    });
    expect(issues.some((i) => i.includes('"Problem:" is not a Content Quality sub-criterion'))).toBe(true);
    expect(issues.some((i) => i.includes('gives 3 examples'))).toBe(true);
  });

  it('accepts lines that follow the guide', () => {
    expect(
      check({
        content_quality_explanation: 'Completeness, accuracy and usefulness: Slide 3 shows "15 of 20", which matches the workbook.',
        writing_style_explanation: 'Clarity: Slide 2 says "Pilot purpose", which is plain and direct.',
        overall_explanation: 'Content Quality decided this rating. Slide 7 needs fixing.',
      }, { ranking_rationale: 'Rank 1: Response A. Rank 2: Response B. Content Quality determined this ranking.' }),
    ).toEqual([]);
  });

  it('flags missing slides, missing quotes, comparisons and the overall opening', () => {
    const issues = check({
      writing_style_explanation: 'Clarity: The wording is plain throughout.',
      overall_explanation: 'This is the strongest deck. It is better than Response B.',
    });
    expect(issues.some((i) => i.includes('does not name a slide'))).toBe(true);
    expect(issues.some((i) => i.includes('does not quote the wording'))).toBe(true);
    expect(issues.some((i) => i.includes('Remove the comparison'))).toBe(true);
    expect(issues.some((i) => i.includes('decided this rating'))).toBe(true);
  });
});
