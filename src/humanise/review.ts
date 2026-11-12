import { squash } from './key-points';

export interface Review {
  score: number;
  missing: string[];
  fixes: string[];
}

interface RawReview {
  deductions?: Array<{ words?: unknown; reason?: unknown }>;
  missing?: Array<{ original?: unknown; reason?: unknown }>;
}

const MAX_SCORE = 10;
const QUOTED = /["“”]([^"“”]{2,}?)["“”]/g;
const LINE_LABEL = /^[ \t]*[A-Z][A-Za-z ,&/'()-]{1,50}:/gm;

export const REVIEW_PROTOCOL = `# How to reply

This replaces any reply format given above.

The text is a grading rationale, so its format is fixed. Labels at the start of lines (such as "Completeness:"), the colon after each label, the line breaks, slide numbers, figures and text quoted from the deck are required. Never take points off for them.

Start from 10. Take off one point for each AI tell you find, and for each one copy the exact words from the rewrite that show it. Only these count as AI tells: stock formulas or slogan cadence, em dashes, colons or semicolons used for drama inside a sentence, AI-flavoured words (delve, robust, pivotal, seamless, comprehensive, underscore, foster, notably, furthermore, moreover), inflated adjectives, neat summary lines, every sentence having the same rhythm, or wording that does not match the style asked for. When a writing sample is given, small slips like the ones in the sample are wanted and are never a deduction.

List a key point as missing only when a finding, a judgement, a verdict, a slide number, a figure or a quote from the original is gone or now says something different. Copy the exact words from the original. Different wording for the same point, a small slip, a shorter sentence or a new order is not missing.

If you find nothing, return empty lists. Reply with JSON only:
{"deductions": [{"words": "exact words from the rewrite", "reason": "what to change"}], "missing": [{"original": "exact words from the original", "reason": "what was lost"}]}`;

function protectedSpans(original: string): string[] {
  return [...[...original.matchAll(QUOTED)].map((m) => m[1]), ...[...original.matchAll(LINE_LABEL)].map((m) => m[0])].map(squash);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseReview(raw: string, original: string, rewrite: string): Review {
  let parsed: RawReview;
  try {
    parsed = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as RawReview;
  } catch {
    return { score: 0, missing: [], fixes: ['Rewrite again so it reads as written by a person.'] };
  }
  const inRewrite = squash(rewrite);
  const inOriginal = squash(original);
  const kept = protectedSpans(original);

  const deductions = (parsed.deductions ?? [])
    .map((d) => ({ words: text(d.words), reason: text(d.reason) }))
    .filter((d) => d.words && inRewrite.includes(squash(d.words)))
    .filter((d) => !kept.some((span) => span.includes(squash(d.words))));

  const missing = (parsed.missing ?? [])
    .map((m) => ({ original: text(m.original), reason: text(m.reason) }))
    .filter((m) => m.original && inOriginal.includes(squash(m.original)) && !inRewrite.includes(squash(m.original)));

  return {
    score: Math.max(0, MAX_SCORE - deductions.length),
    missing: missing.map((m) => `Put back "${m.original}"${m.reason ? ` (${m.reason})` : ''}.`),
    fixes: deductions.map((d) => `Change "${d.words}"${d.reason ? `: ${d.reason}` : ''}.`),
  };
}
