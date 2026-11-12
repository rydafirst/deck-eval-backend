const TRIGGER = /rate each response independently/i;

const RESPONSE_MENTION = /\b(?:response|output)\s+([a-d])\b/gi;

const COMPARATIVE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
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

export function findComparativeWords(text: string, ownLabel?: string | null): string[] {
  const others = [...new Set([...text.matchAll(RESPONSE_MENTION)].map((m) => m[1].toUpperCase()))]
    .filter((label) => label !== ownLabel?.toUpperCase())
    .map((label) => `Response ${label}`);
  return [...others, ...COMPARATIVE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label)];
}
