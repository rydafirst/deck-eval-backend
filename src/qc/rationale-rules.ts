import { findComparativeWords, type ResponseRef, type RubricFieldDef } from '../shared';
import type { QcToolInput } from './qc-form';

interface Axis {
  name: string;
  match: RegExp;
  labels: string[] | null;
  quotes?: boolean;
}

const AXES: Axis[] = [
  { name: 'Content Quality', match: /content/, labels: ['completeness', 'accuracy', 'omissions', 'omission', 'misleading omission', 'additions', 'addition', 'usefulness'] },
  { name: 'Storytelling', match: /story/, labels: ['narrative', 'structure', 'transitions', 'build-up', 'build up', 'engagement', 'titles'] },
  {
    name: 'Writing Style',
    match: /writing/,
    labels: ['clarity', 'conciseness', 'specificity', 'naturalness', 'ai slop', 'slop'],
    quotes: true,
  },
  {
    name: 'Aesthetics',
    match: /aesthetic/,
    labels: ['typography', 'colour use', 'color use', 'colour', 'color', 'visual consistency', 'visual variety', 'visual quality', 'consistency', 'variety'],
  },
  { name: 'Layout', match: /layout/, labels: ['spacing', 'alignment', 'grouping', 'hierarchy', 'clutter', 'overlap', 'clutter and overlap'] },
  { name: 'Editability', match: /edit/, labels: null },
];

const AXIS_NAMES = AXES.map((a) => a.name.toLowerCase()).join('|');
const DECIDED = new RegExp(`^(${AXIS_NAMES}) decided this rating\\.`, 'i');
const DETERMINED = new RegExp(`^(${AXIS_NAMES}) determined this ranking\\.`, 'i');
const LABELLED = /^([A-Za-z][A-Za-z ,&/-]{1,50}):\s*(.*)$/;
const SLIDE = /\bslides?\s*\d/i;
const WHOLE_DECK = /\b(every|each|all) slides?\b/i;
const QUOTE = /["“”]/;
const COMPARATIVE = /\b(better|worse|stronger|weaker|strongest|weakest|unlike|compared (?:with|to)|of the (?:two|three|four|five)|the (?:most|least|best|worst))\b/gi;
const MAX_EXAMPLES = 2;

function sentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).filter((s) => s.trim());
}

function labelAllowed(label: string, allowed: string[]): boolean {
  const parts = label.toLowerCase().split(/,|\band\b|&|\//).map((p) => p.trim()).filter(Boolean);
  return parts.length > 0 && parts.every((part) => allowed.includes(part));
}

function axisLines(text: string, axis: Axis, where: string): string[] {
  const issues: string[] = [];
  for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
    const short = line.length > 70 ? `${line.slice(0, 70)}…` : line;
    const labelled = line.match(LABELLED);
    if (!labelled) {
      issues.push(`${where}: the line "${short}" has no sub-criterion label. Start every line with a ${axis.name} sub-criterion, such as "${axis.labels?.[0] ?? 'Editability'}:".`);
      continue;
    }
    const [, label, body] = labelled;
    if (axis.labels && !labelAllowed(label, axis.labels)) {
      issues.push(`${where}: "${label}:" is not a ${axis.name} sub-criterion. Use one or a combination of: ${[...new Set(axis.labels)].join(', ')}.`);
    }
    if (!SLIDE.test(body) && !WHOLE_DECK.test(body)) issues.push(`${where}: the "${label}:" line does not name a slide. Every point names the slide it is about.`);
    const examples = sentences(body).filter((s) => SLIDE.test(s)).length;
    if (examples > MAX_EXAMPLES) issues.push(`${where}: the "${label}:" line gives ${examples} examples. Use one or two examples per point, never more.`);
    if (axis.quotes && !QUOTE.test(body)) issues.push(`${where}: the "${label}:" line does not quote the wording. Every Writing Style point quotes the line it judges.`);
  }
  return issues;
}

function styleIssues(text: string, where: string): string[] {
  const issues: string[] = [];
  if (text.includes('—')) issues.push(`${where}: remove the em dashes.`);
  if (/\*\*|^#|^\s*[-•*]\s/m.test(text)) issues.push(`${where}: write plain text, with no markdown, headings or bullet symbols.`);
  return issues;
}

function comparisonIssues(text: string, ownLabel: string, where: string): string[] {
  const words = [...new Set([...findComparativeWords(text, ownLabel), ...[...text.matchAll(COMPARATIVE)].map((m) => m[0].toLowerCase())])];
  return words.length ? [`${where}: rate this response on its own. Remove the comparison (${words.join(', ')}).`] : [];
}

export function ruleIssues(input: QcToolInput, fields: RubricFieldDef[], responses: ResponseRef[]): string[] {
  const issues: string[] = [];
  const textFields = fields.filter((f) => f.type === 'TEXTAREA');

  for (const response of responses) {
    for (const field of textFields.filter((f) => f.scope === 'PER_RESPONSE')) {
      const text = String(input.responses?.[response.label]?.[field.key] ?? '').trim();
      if (!text) continue;
      const where = `Response ${response.label}, ${field.label}`;
      const key = field.key.toLowerCase();
      issues.push(...styleIssues(text, where), ...comparisonIssues(text, response.label, where));
      if (key.startsWith('overall')) {
        if (!DECIDED.test(text)) issues.push(`${where}: start with "[Axis] decided this rating.", naming the axis that decided it.`);
        continue;
      }
      const axis = AXES.find((a) => a.match.test(key));
      if (axis) issues.push(...axisLines(text, axis, where));
    }
  }

  for (const field of textFields.filter((f) => f.scope === 'PER_TASK')) {
    const text = String(input.task?.[field.key] ?? '').trim();
    if (!text) continue;
    issues.push(...styleIssues(text, field.label));
    const afterRanks = text.replace(/^(\s*Rank \d+\b[^.\n]*\.\s*)+/i, '');
    if (/rank/i.test(field.key) && !DETERMINED.test(afterRanks)) {
      issues.push(`${field.label}: start with "[Axis] determined this ranking.", naming the axis that decided the order.`);
    }
  }
  return issues;
}
