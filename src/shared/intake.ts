import { naturalCompare } from './sort';

export const RESPONSE_LABELS = ['A', 'B', 'C', 'D'] as const;
export type ResponseLabel = (typeof RESPONSE_LABELS)[number];

export type IntakeFileKind = 'pdf' | 'presentation' | 'image' | 'document';
export type IntakeFileStatus = 'processing' | 'ready' | 'failed';

export interface IntakeFileDTO {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: IntakeFileKind;
  status: IntakeFileStatus;
  error: string | null;
  pageCount: number;
  thumbnailUrl: string | null;
}

export type DraftFileRole = 'response' | 'combined' | 'input' | 'ignore';

export interface DraftFile {
  fileId: string;
  role: DraftFileRole;
  label: ResponseLabel | null;
  labels?: ResponseLabel[];
}

export interface TaskDraft {
  title: string;
  projectId: string;
  priority: number;
  tagNames: string[];
  dueAt: string | null;
  ratersNeeded: number;
  instructionsHtml: string;
  userRequestHtml: string;
  files: DraftFile[];
  notes: string | null;
}

export interface IntakeTurn {
  role: 'user' | 'assistant';
  text: string;
  fileIds: string[];
  draft: TaskDraft | null;
}

export interface IntakeReply {
  reply: string;
  draft: TaskDraft | null;
}

const RESPONSE_PATTERNS = [
  /(?:response|output|deck|option|model|candidate|answer)[\s_.-]*([a-d1-4])(?![a-z0-9])/i,
  /(?:^|[\s_.-])([a-d])(?:[\s_.-]|$)/i,
];

function toLabel(token: string): ResponseLabel | null {
  const upper = token.toUpperCase();
  if ((RESPONSE_LABELS as readonly string[]).includes(upper)) return upper as ResponseLabel;
  const index = Number(token) - 1;
  return RESPONSE_LABELS[index] ?? null;
}

export function guessResponseLabel(filename: string): ResponseLabel | null {
  const stem = filename.replace(/\.[^.]+$/, '');
  for (const pattern of RESPONSE_PATTERNS) {
    const match = stem.match(pattern);
    if (match) return toLabel(match[1]);
  }
  return null;
}

const COMBINED_PATTERN = /responses?[\s_-]*([a-d1-4])\s*(?:-|–|_|to)\s*([a-d1-4])(?![a-z0-9])/i;

export function guessCombinedLabels(filename: string): ResponseLabel[] | null {
  const match = filename.replace(/\.[^.]+$/, '').match(COMBINED_PATTERN);
  if (!match) return null;
  const from = RESPONSE_LABELS.indexOf(toLabel(match[1])!);
  const to = RESPONSE_LABELS.indexOf(toLabel(match[2])!);
  return to > from ? RESPONSE_LABELS.slice(from, to + 1) : null;
}

export function responseLabelsIn(files: DraftFile[]): ResponseLabel[] {
  const used = new Set<ResponseLabel>();
  for (const file of files) {
    if (file.role === 'response' && file.label) used.add(file.label);
    if (file.role === 'combined') file.labels?.forEach((label) => used.add(label));
  }
  return RESPONSE_LABELS.filter((label) => used.has(label));
}

export function guessFileRoles(files: Array<Pick<IntakeFileDTO, 'id' | 'name' | 'kind'>>): DraftFile[] {
  const sorted = [...files].sort((a, b) => naturalCompare(a.name, b.name));
  return sorted.map((file) => {
    const slideLike = file.kind === 'pdf' || file.kind === 'presentation' || file.kind === 'image';
    const combined = slideLike ? guessCombinedLabels(file.name) : null;
    if (combined) return { fileId: file.id, role: 'combined', label: null, labels: combined };
    const label = slideLike ? guessResponseLabel(file.name) : null;
    return label ? { fileId: file.id, role: 'response', label } : { fileId: file.id, role: 'input', label: null };
  });
}

export function textToHtml(text: string): string {
  const escape = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .trim()
    .split(/\n{2,}/)
    .filter(Boolean)
    .map((paragraph) => `<p>${escape(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
}
