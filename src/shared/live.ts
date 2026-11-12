import type { AnswerValue } from './rubric';
import type { SubStatus, TeamMemberDTO } from './types';

export const LIVE_POLL_MS = 1000;
export const LIVE_AWAY_MS = 10_000;

export interface FieldRef {
  fieldId: string;
  responseId: string | null;
}

export interface LiveSyncInput {
  since: string | null;
  viewing: string | null;
  focus: FieldRef | null;
  typing: boolean;
}

export interface LiveAnswer extends FieldRef {
  value: AnswerValue;
  updatedAt: string;
  byId: string | null;
}

export interface PresenceDTO {
  userId: string;
  name: string;
  viewing: string | null;
  focus: FieldRef | null;
  typing: boolean;
  seenAt: string;
}

export interface LiveSyncDTO {
  now: string;
  status: SubStatus;
  answers: LiveAnswer[];
  presence: PresenceDTO[];
  team: TeamMemberDTO[];
}
