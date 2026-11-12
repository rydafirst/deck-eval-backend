import { Injectable } from '@nestjs/common';
import { type AnswerValue, type LiveSyncDTO, type LiveSyncInput, type SessionUser } from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceService } from '../submissions/workspace.service';
import { PresenceStore } from './presence.store';

const OVERLAP_MS = 3000;

@Injectable()
export class LiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceService,
    private readonly presence: PresenceStore,
  ) {}

  async sync(user: SessionUser, submissionId: string, input: LiveSyncInput): Promise<LiveSyncDTO> {
    const submission = await this.workspace.memberSubmission(submissionId, user.id);
    const now = new Date();
    this.presence.update(submissionId, {
      userId: user.id,
      name: user.name ?? user.email,
      viewing: input.viewing,
      focus: input.focus,
      typing: input.typing,
      seenAt: now.toISOString(),
    });

    const since = input.since ? new Date(Date.parse(input.since) - OVERLAP_MS) : null;
    const [rows, team] = await Promise.all([
      this.prisma.answer.findMany({
        where: { submissionId, ...(since ? { updatedAt: { gt: since } } : {}) },
        orderBy: { updatedAt: 'asc' },
      }),
      this.workspace.team(submission.taskId),
    ]);
    return {
      now: now.toISOString(),
      status: submission.status,
      answers: rows.map((a) => ({
        fieldId: a.fieldId,
        responseId: a.responseId,
        value: a.value as AnswerValue,
        updatedAt: a.updatedAt.toISOString(),
        byId: a.updatedById,
      })),
      presence: this.presence.others(submissionId, user.id, now.getTime()),
      team,
    };
  }

  leave(user: SessionUser, submissionId: string) {
    this.presence.leave(submissionId, user.id);
  }
}
