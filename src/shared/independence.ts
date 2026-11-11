const TRIGGER = /rate each response independently/i;

const COMPARATIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Response A/B/C/D', pattern: /\b(response|output)\s+[a-d]\b/i },
  { label: 'better', pattern: /\bbetter\b/i },
  { label: 'worse', pattern: /\bworse\b/i },
  { label: 'unlike', pattern: /\bunlike\b/i },
  { label: 'compared with', pattern: /\bcompared (with|to)\b/i },
  { label: 'the most', pattern: /\bthe most\b/i },
  { label: 'of the three', pattern: /\bof the (two|three|four)\b/i },
];

export function needsIndependenceCheck(instructions: string): boolean {
  return TRIGGER.test(instructions.replace(/<[^>]+>/g, ' '));
}

export function findComparativeWords(text: string): string[] {
  return COMPARATIVE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}
