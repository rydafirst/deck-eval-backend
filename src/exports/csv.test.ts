import { describe, expect, it } from 'vitest';
import { csvCell, csvRow } from './csv';

describe('csv', () => {
  it('quotes cells with commas, quotes and newlines', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a, b')).toBe('"a, b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
  });

  it('writes empty cells for null values and ends rows with CRLF', () => {
    expect(csvRow(['x', null, 3])).toBe('x,,3\r\n');
  });
});
