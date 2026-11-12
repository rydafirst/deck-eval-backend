import { describe, expect, it } from 'vitest';
import { missingKeyPoints } from './key-points';

const original = `Accuracy: Slide 5 shows that "Peru cost the least", which contradicts the cost sheet.
Completeness: Slide 8 suggests a left over of £1,050 rather than £650.`;

describe('missingKeyPoints', () => {
  it('passes a rewrite that keeps every quote, label and figure', () => {
    const rewrite = `Accuracy: On slide 5 the deck says “Peru cost the least” and this goes against the cost sheet.
Completeness: slide 8 gives a left over of £1050, not £650.`;
    expect(missingKeyPoints(original, rewrite)).toEqual([]);
  });

  it('reports a changed quote, a dropped label and a lost figure', () => {
    const rewrite = 'Accuracy: Slide 5 says Peru is cheapest, which contradicts the cost sheet. Slide 8 gives £1,050.';
    expect(missingKeyPoints(original, rewrite)).toEqual(['the quote "Peru cost the least"', 'the line label "Completeness:"', 'the figure £650']);
  });
});
