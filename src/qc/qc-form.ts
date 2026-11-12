import { answerKey, rankSlots, type AnswerMap, type AnswerValue, type ResponseRef, type RubricFieldDef } from '../shared';

type JsonSchema = Record<string, unknown>;

export interface QcToolInput {
  responses?: Record<string, Record<string, unknown>>;
  task?: Record<string, unknown>;
  notes?: string | null;
}

const answerable = (field: RubricFieldDef) => field.type !== 'SECTION';

function scaleRange(field: RubricFieldDef) {
  return { min: field.config.min ?? 1, max: field.config.max ?? 7 };
}

function fieldSchema(field: RubricFieldDef, labels: string[]): JsonSchema {
  switch (field.type) {
    case 'SCALE': {
      const { min, max } = scaleRange(field);
      return { type: 'integer', minimum: min, maximum: max };
    }
    case 'SELECT':
      return field.config.options?.length ? { type: 'string', enum: field.config.options } : { type: 'string' };
    case 'CHECKBOX':
      return { type: 'boolean' };
    case 'RANKING':
      return { type: 'array', items: { type: 'string', enum: labels }, minItems: labels.length, maxItems: labels.length, description: 'Response labels from best to worst' };
    default:
      return { type: 'string' };
  }
}

function objectOf(fields: RubricFieldDef[], labels: string[]): JsonSchema {
  return {
    type: 'object',
    properties: Object.fromEntries(fields.map((f) => [f.key, fieldSchema(f, labels)])),
    required: fields.map((f) => f.key),
  };
}

export function qcInputSchema(fields: RubricFieldDef[], responses: ResponseRef[]): JsonSchema {
  const labels = responses.map((r) => r.label);
  const perResponse = fields.filter((f) => answerable(f) && f.scope === 'PER_RESPONSE');
  const perTask = fields.filter((f) => answerable(f) && f.scope === 'PER_TASK');
  return {
    type: 'object',
    properties: {
      responses: {
        type: 'object',
        properties: Object.fromEntries(labels.map((label) => [label, objectOf(perResponse, labels)])),
        required: labels,
      },
      task: objectOf(perTask, labels),
      notes: { type: ['string', 'null'], description: 'Anything the admin should check before submitting, or null' },
    },
    required: ['responses', 'task', 'notes'],
  };
}

function describeField(field: RubricFieldDef): string {
  const parts = [`- ${field.key}: "${field.label}"`];
  if (field.type === 'SCALE') {
    const { min, max } = scaleRange(field);
    const labels = Object.entries(field.config.labels ?? {}).map(([value, text]) => `${value} = ${text}`);
    parts.push(`score from ${min} to ${max}${labels.length ? ` (${labels.join(', ')})` : ''}`);
  }
  if (field.type === 'TEXTAREA') parts.push('written answer');
  if (field.type === 'SELECT') parts.push(`one of: ${(field.config.options ?? []).join(', ')}`);
  if (field.type === 'CHECKBOX') parts.push('true or false');
  if (field.type === 'RANKING') parts.push('response labels in order, best first');
  if (field.config.minChars) parts.push(`at least ${field.config.minChars} characters`);
  if (field.config.maxChars) parts.push(`at most ${field.config.maxChars} characters`);
  const line = parts.join(', ');
  return field.helpText ? `${line}\n  Definition: ${field.helpText}` : line;
}

export function describeForm(fields: RubricFieldDef[]): string {
  const lines: string[] = [];
  let scope: string | null = null;
  for (const field of fields) {
    if (field.scope !== scope) {
      scope = field.scope;
      lines.push(scope === 'PER_RESPONSE' ? '\nAnswered once for each response:' : '\nAnswered once for the whole task, after every response is rated:');
    }
    lines.push(field.type === 'SECTION' ? `\n[Section: ${field.label}]` : describeField(field));
  }
  return lines.join('\n').trim();
}

function coerce(field: RubricFieldDef, value: unknown, responses: ResponseRef[]): AnswerValue | undefined {
  if (value === null || value === undefined) return undefined;
  switch (field.type) {
    case 'SCALE': {
      const { min, max } = scaleRange(field);
      const n = Math.round(Number(value));
      return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : undefined;
    }
    case 'CHECKBOX':
      return Boolean(value);
    case 'RANKING': {
      if (!Array.isArray(value)) return undefined;
      const byLabel = new Map(responses.map((r) => [r.label, r.id]));
      const ids = [...new Set(value.map((label) => byLabel.get(String(label))).filter((id): id is string => !!id))];
      const slots = rankSlots(responses);
      return Object.fromEntries(ids.slice(0, slots.length).map((id, i) => [slots[i], id]));
    }
    default: {
      const text = String(value).trim();
      return text ? text : undefined;
    }
  }
}

export function toAnswers(input: QcToolInput, fields: RubricFieldDef[], responses: ResponseRef[]): AnswerMap {
  const answers: AnswerMap = {};
  for (const field of fields.filter(answerable)) {
    if (field.scope === 'PER_TASK') {
      const value = coerce(field, input.task?.[field.key], responses);
      if (value !== undefined) answers[answerKey(field.id, null)] = value;
      continue;
    }
    for (const response of responses) {
      const value = coerce(field, input.responses?.[response.label]?.[field.key], responses);
      if (value !== undefined) answers[answerKey(field.id, response.id)] = value;
    }
  }
  return answers;
}
