export const FIELD_TYPES = ['SCALE', 'TEXTAREA', 'RANKING', 'SELECT', 'CHECKBOX', 'SECTION'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export const FIELD_SCOPES = ['PER_RESPONSE', 'PER_TASK'] as const;
export type FieldScope = (typeof FIELD_SCOPES)[number];

export interface FieldConfig {
  min?: number;
  max?: number;
  labels?: Record<string, string>;
  minChars?: number;
  maxChars?: number;
  placeholder?: string;
  options?: string[];
}

export interface RubricFieldDef {
  id: string;
  key: string;
  order: number;
  label: string;
  helpText?: string | null;
  type: FieldType;
  scope: FieldScope;
  required: boolean;
  config: FieldConfig;
}

export interface ResponseRef {
  id: string;
  label: string;
}

export type RankingValue = Record<string, string>;
export type AnswerValue = number | string | boolean | RankingValue | null;

export const TASK_SCOPE = 'task';

export function answerKey(fieldId: string, responseId: string | null | undefined): string {
  return `${fieldId}:${responseId ?? TASK_SCOPE}`;
}

export type AnswerMap = Record<string, AnswerValue>;

export interface FieldIssue {
  fieldId: string;
  responseId: string | null;
  label: string;
  responseLabel: string | null;
  message: string;
}

function isEmpty(value: AnswerValue | undefined): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  if (typeof value === 'object') return Object.values(value).filter(Boolean).length === 0;
  return false;
}

export function rankSlots(responses: ResponseRef[]): string[] {
  return responses.map((_, i) => `rank${i + 1}`);
}

function checkField(
  field: RubricFieldDef,
  value: AnswerValue | undefined,
  responses: ResponseRef[],
): string | null {
  if (field.type === 'SECTION') return null;
  if (isEmpty(value)) return field.required ? 'Required' : null;

  switch (field.type) {
    case 'SCALE': {
      const min = field.config.min ?? 1;
      const max = field.config.max ?? 7;
      if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
        return `Choose a score from ${min} to ${max}`;
      }
      return null;
    }
    case 'TEXTAREA': {
      const text = String(value).trim();
      if (field.config.minChars && text.length < field.config.minChars) {
        return `At least ${field.config.minChars} characters (${text.length} so far)`;
      }
      if (field.config.maxChars && text.length > field.config.maxChars) {
        return `No more than ${field.config.maxChars} characters`;
      }
      return null;
    }
    case 'SELECT': {
      const options = field.config.options ?? [];
      return options.length && !options.includes(String(value)) ? 'Choose one of the options' : null;
    }
    case 'CHECKBOX':
      return field.required && value !== true ? 'Required' : null;
    case 'RANKING': {
      const ranking = value as RankingValue;
      const slots = rankSlots(responses);
      const valid = new Set(responses.map((r) => r.id));
      const picked = slots.map((s) => ranking[s]).filter(Boolean);
      if (field.required && picked.length < slots.length) return 'Fill every rank';
      if (picked.some((id) => !valid.has(id))) return 'Unknown response in ranking';
      if (new Set(picked).size !== picked.length) return 'Each response can only be used once';
      return null;
    }
    default:
      return null;
  }
}

export function validateAnswers(
  fields: RubricFieldDef[],
  responses: ResponseRef[],
  answers: AnswerMap,
): FieldIssue[] {
  const issues: FieldIssue[] = [];
  const ordered = [...fields].sort((a, b) => a.order - b.order);

  for (const response of responses) {
    for (const field of ordered.filter((f) => f.scope === 'PER_RESPONSE')) {
      const message = checkField(field, answers[answerKey(field.id, response.id)], responses);
      if (message) {
        issues.push({ fieldId: field.id, responseId: response.id, label: field.label, responseLabel: response.label, message });
      }
    }
  }
  for (const field of ordered.filter((f) => f.scope === 'PER_TASK')) {
    const message = checkField(field, answers[answerKey(field.id, null)], responses);
    if (message) {
      issues.push({ fieldId: field.id, responseId: null, label: field.label, responseLabel: null, message });
    }
  }
  return issues;
}

export interface Progress {
  done: number;
  total: number;
}

export function progressFor(
  fields: RubricFieldDef[],
  responses: ResponseRef[],
  answers: AnswerMap,
  responseId: string | null,
): Progress {
  const scope = responseId ? 'PER_RESPONSE' : 'PER_TASK';
  const scoped = fields.filter((f) => f.scope === scope && f.type !== 'SECTION');
  const done = scoped.filter(
    (f) => checkField({ ...f, required: true }, answers[answerKey(f.id, responseId)], responses) === null,
  ).length;
  return { done, total: scoped.length };
}

export type CompletionState = 'empty' | 'partial' | 'done';

export function completionState(progress: Progress): CompletionState {
  if (progress.done === 0) return 'empty';
  return progress.done >= progress.total ? 'done' : 'partial';
}
