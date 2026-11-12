const QUOTED = /["“”]([^"“”]{2,}?)["“”]/g;
const LINE_LABEL = /^[ \t]*([A-Z][A-Za-z ,&/'()-]{1,40}):/gm;
const NUMBER = /[£$€]?\d[\d,.]*%?/g;

const squash = (text: string) => text.replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
const cleanNumber = (raw: string) => raw.replace(/[.,]+$/, '').replace(/,/g, '');

function matches(text: string, pattern: RegExp, group = 0): string[] {
  return [...text.matchAll(pattern)].map((m) => m[group]);
}

export function missingKeyPoints(original: string, rewrite: string): string[] {
  const missing: string[] = [];
  const target = squash(rewrite);

  for (const quote of new Set(matches(original, QUOTED, 1))) {
    if (!target.includes(squash(quote))) missing.push(`the quote "${quote.trim()}"`);
  }
  for (const label of new Set(matches(original, LINE_LABEL, 1))) {
    if (!target.includes(`${squash(label)}:`)) missing.push(`the line label "${label.trim()}:"`);
  }
  const rewriteNumbers = new Set(matches(rewrite, NUMBER).map(cleanNumber));
  for (const raw of new Set(matches(original, NUMBER))) {
    const number = cleanNumber(raw);
    if (number && !rewriteNumbers.has(number)) missing.push(`the figure ${raw.replace(/[.,]+$/, '')}`);
  }
  return missing;
}
