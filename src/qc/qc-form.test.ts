import { describe, expect, it } from 'vitest';
import type { RubricFieldDef } from '../shared';
import { describeForm, qcInputSchema, toAnswers } from './qc-form';

const field = (partial: Partial<RubricFieldDef> & Pick<RubricFieldDef, 'id' | 'key' | 'type' | 'scope'>): RubricFieldDef => ({
  order: 0,
  label: partial.key,
  required: true,
  config: {},
  ...partial,
});

const fields: RubricFieldDef[] = [
  field({ id: 's', key: 'section', type: 'SECTION', scope: 'PER_RESPONSE' }),
  field({ id: 'f1', key: 'content_quality', type: 'SCALE', scope: 'PER_RESPONSE', config: { min: 1, max: 7 } }),
  field({ id: 'f2', key: 'content_quality_explanation', type: 'TEXTAREA', scope: 'PER_RESPONSE' }),
  field({ id: 'f3', key: 'ranking', type: 'RANKING', scope: 'PER_TASK' }),
  field({ id: 'f4', key: 'ranking_explanation', type: 'TEXTAREA', scope: 'PER_TASK' }),
];
const responses = [
  { id: 'rA', label: 'A' },
  { id: 'rB', label: 'B' },
];

describe('qc form', () => {
  it('builds one object per response plus task fields, skipping sections', () => {
    const schema = qcInputSchema(fields, responses) as { properties: { responses: { required: string[]; properties: Record<string, { required: string[] }> }; task: { required: string[] } } };
    expect(schema.properties.responses.required).toEqual(['A', 'B']);
    expect(schema.properties.responses.properties.A.required).toEqual(['content_quality', 'content_quality_explanation']);
    expect(schema.properties.task.required).toEqual(['ranking', 'ranking_explanation']);
  });

  it('maps the model output back to answer keys and clamps scores', () => {
    const answers = toAnswers(
      {
        responses: { A: { content_quality: 9, content_quality_explanation: ' Slide 2 shows the totals. ' }, B: { content_quality: 3.6, content_quality_explanation: '' } },
        task: { ranking: ['B', 'A', 'B', 'Z'], ranking_explanation: 'Rank 1: Response B.' },
      },
      fields,
      responses,
    );
    expect(answers).toEqual({
      'f1:rA': 7,
      'f2:rA': 'Slide 2 shows the totals.',
      'f1:rB': 4,
      'f3:task': { rank1: 'rB', rank2: 'rA' },
      'f4:task': 'Rank 1: Response B.',
    });
  });

  it('describes the form in order with scopes', () => {
    const text = describeForm(fields);
    expect(text.indexOf('content_quality')).toBeLessThan(text.indexOf('ranking'));
    expect(text).toContain('Answered once for the whole task');
  });
});
