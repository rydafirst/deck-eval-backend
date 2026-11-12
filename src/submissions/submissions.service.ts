import { BadRequestException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { TASK_SCOPE, validateAnswers, type SessionUser } from '../shared';
import { AuditService } from '../audit/audit.service';
import { toJson } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { WorkspaceService } from './workspace.service';

export interface AnswerInput {
  fieldId: string;
  responseId: string | null;
  value: unknown;
}

const MAX_TICK_SECONDS = 120;

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspace: WorkspaceService,
    private readonly templates: TemplatesService,
    private readonly audit: AuditService,
  ) {}

  async saveAnswers(user: SessionUser, submissionId: string, answers: AnswerInput[]) {
    const submission = await this.editable(submissionId, user.id);
    const fields = await this.templates.fields(submission.templateVersionId);
    const responses = await this.prisma.response.findMany({ where: { taskId: submission.taskId }, select: { id: true } });
    const fieldScope = new Map(fields.map((f) => [f.id, f.scope]));
    const responseIds = new Set(responses.map((r) => r.id));

    for (const answer of answers) {
      const scope = fieldScope.get(answer.fieldId);
      if (!scope) throw new BadRequestException('Unknown field');
      if (scope === 'PER_RESPONSE' && !responseIds.has(answer.responseId ?? '')) throw new BadRequestException('Unknown response');
      if (scope === 'PER_TASK' && answer.responseId) throw new BadRequestException('Field is per task');
    }

    await this.prisma.$transaction(
      answers.map((a) => {
        const scope = a.responseId ?? TASK_SCOPE;
        const value = toJson(a.value ?? null);
        return this.prisma.answer.upsert({
          where: { submissionId_fieldId_scope: { submissionId, fieldId: a.fieldId, scope } },
          create: { submissionId, fieldId: a.fieldId, responseId: a.responseId, scope, value, updatedById: user.id },
          update: { value, updatedById: user.id },
        });
      }),
    );
    await this.prisma.submission.update({ where: { id: submissionId }, data: { updatedAt: new Date() } });
    return { savedAt: new Date().toISOString() };
  }

  async addTime(user: SessionUser, submissionId: string, seconds: number) {
    await this.editable(submissionId, user.id);
    const increment = Math.max(0, Math.min(MAX_TICK_SECONDS, Math.round(seconds)));
    const updated = await this.prisma.submission.update({
      where: { id: submissionId },
      data: { activeSeconds: { increment } },
      select: { activeSeconds: true },
    });
    return updated;
  }

  async submit(user: SessionUser, submissionId: string) {
    const submission = await this.editable(submissionId, user.id);
    const [fields, responses, answers] = await Promise.all([
      this.templates.fields(submission.templateVersionId),
      this.prisma.response.findMany({ where: { taskId: submission.taskId }, orderBy: { order: 'asc' }, select: { id: true, label: true } }),
      this.workspace.answers(submissionId),
    ]);
    const issues = validateAnswers(fields, responses, answers);
    if (issues.length) throw new UnprocessableEntityException({ message: 'Some required fields are incomplete', issues });

    await this.prisma.submission.update({ where: { id: submissionId }, data: { status: 'SUBMITTED', submittedAt: new Date() } });
    await this.audit.log(user.id, submission.status === 'RETURNED' ? 'resubmit' : 'submit', 'Submission', submissionId);
    return this.workspace.submission(submissionId, false);
  }

  private async editable(submissionId: string, userId: string) {
    const submission = await this.workspace.memberSubmission(submissionId, userId);
    if (submission.status !== 'DRAFT' && submission.status !== 'RETURNED') {
      throw new BadRequestException('This submission can no longer be edited');
    }
    return submission;
  }
}
