import type { AnswerMap } from './rubric';

export type GuideGroup = 'qc' | 'humanise';

export interface GuideDTO {
  key: string;
  title: string;
  group: GuideGroup;
  body: string;
  isDefault: boolean;
  updatedAt: string;
}

export type JobStatus = 'running' | 'done' | 'failed';

export interface JobDTO<T> {
  id: string;
  status: JobStatus;
  result: T | null;
  error: string | null;
}

export interface QcResult {
  answers: AnswerMap;
  notes: string | null;
}

export const HUMANISE_MODES = ['chatgpt', 'voice'] as const;
export type HumaniseMode = (typeof HUMANISE_MODES)[number];

export interface HumaniseItem {
  key: string;
  label: string;
  text: string;
}

export interface HumanisedText {
  key: string;
  text: string;
  score: number;
  rounds: number;
  missing: string[];
  applied: boolean;
}

export interface HumaniseResult {
  items: HumanisedText[];
  failed: Array<{ key: string; error: string }>;
}
