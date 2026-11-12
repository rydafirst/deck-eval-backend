import { describe, expect, it } from 'vitest';
import { parseReview } from './review';

const original = 'Accuracy: Slide 3 says "Databricks was fastest in 15 of 20 tests", which matches the workbook.';
const rewrite = 'Accuracy: Slide 3 says "Databricks was fastest in 15 of 20 tests", which is a robust match for the workbook.';

describe('parseReview', () => {
  it('counts only deductions whose words are really in the rewrite', () => {
    const raw = JSON.stringify({
      deductions: [
        { words: 'robust match', reason: 'AI word' },
        { words: 'seamlessly aligns', reason: 'not in the text' },
      ],
      missing: [],
    });
    expect(parseReview(raw, original, rewrite)).toEqual({ score: 9, missing: [], fixes: ['Change "robust match": AI word.'] });
  });

  it('ignores deductions aimed at labels or quoted deck text', () => {
    const raw = JSON.stringify({ deductions: [{ words: 'Accuracy:', reason: 'colon' }, { words: 'fastest in 15 of 20', reason: 'slogan' }], missing: [] });
    expect(parseReview(raw, original, rewrite).score).toBe(10);
  });

  it('keeps a missing point only when the original words are gone from the rewrite', () => {
    const raw = JSON.stringify({
      deductions: [],
      missing: [
        { original: 'which matches the workbook', reason: 'verdict changed' },
        { original: 'Slide 3 says', reason: 'still there' },
      ],
    });
    expect(parseReview(raw, original, rewrite).missing).toEqual(['Put back "which matches the workbook" (verdict changed).']);
  });

  it('asks for another rewrite when the reply is not JSON', () => {
    expect(parseReview('no json here', original, rewrite).score).toBe(0);
  });
});
