import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  answerKey, type AnswerMap, type AnswerValue, type ReviewCommentDTO, type SessionUser, type SubmissionDTO, type TeamMemberDTO, type WorkspaceDTO,
} from '../shared';
import { PrismaService } from '../prisma/prisma.service';
import { TaskPresenter } from '../tasks/task.presenter';
import { TasksRepository } from '../tasks/tasks.repository';
import { TemplatesService } from '../templates/templates.service';

const VISIBLE_TO_RATERS = ['PUBLISHED', 'IN_PROGRESS', 'COMPLETED'];

@Injectable()
export class WorkspaceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksRepository,
    private readonly presenter: TaskPresenter,
    private readonly templates: TemplatesService,
  ) {}

  async forRater(taskId: string, user: SessionUser): Promise<WorkspaceDTO> {
    const task = await this.tasks.findDetail(taskId);
    if (!task) throw new NotFoundException('Task not found');
    if (!VISIBLE_TO_RATERS.includes(task.status) && user.role !== 'ADMIN') throw new NotFoundException('Task not found');

    const submission = await this.sheetFor(taskId, task.sharedSheet, user.id);
    const editable = submission && (submission.status === 'DRAFT' || submission.status === 'RETURNED');
    return {
      task: await this.presenter.detail(task),
      fields: await this.templates.fields(submission?.templateVersionId ?? task.templateVersionId),
      submission: submission ? await this.submission(submission.id, false) : null,
      readOnly: !editable,
    };
  }

  async forPreview(taskId: string): Promise<WorkspaceDTO> {
    const task = await this.tasks.findDetail(taskId);
    if (!task) throw new NotFoundException('Task not found');
    return {
      task: await this.presenter.detail(task),
      fields: await this.templates.fields(task.templateVersionId),
      submission: null,
      readOnly: true,
    };
  }

  async forReviewer(submissionId: string): Promise<WorkspaceDTO> {
    const submission = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');
    const task = await this.tasks.findDetail(submission.taskId);
    if (!task) throw new NotFoundException('Task not found');
    return {
      task: await this.presenter.detail(task),
      fields: await this.templates.fields(submission.templateVersionId),
      submission: await this.submission(submissionId, true),
      readOnly: true,
    };
  }

  async sheetFor(taskId: string, sharedSheet: boolean, userId: string) {
    const own = await this.prisma.submission.findUnique({ where: { taskId_userId: { taskId, userId } } });
    if (own || !sharedSheet || !(await this.joined(taskId, userId))) return own;
    return this.prisma.submission.findFirst({ where: { taskId }, orderBy: { createdAt: 'asc' } });
  }

  async memberSubmission(submissionId: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({ where: { id: submissionId }, include: { task: { select: { sharedSheet: true } } } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.userId === userId) return submission;
    if (submission.task.sharedSheet && (await this.joined(submission.taskId, userId))) return submission;
    throw new ForbiddenException();
  }

  async team(taskId: string): Promise<TeamMemberDTO[]> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { sharedSheet: true, assignments: { include: { user: { select: { name: true, email: true } } }, orderBy: { claimedAt: 'asc' } } },
    });
    if (!task?.sharedSheet) return [];
    return task.assignments.map((a) => ({ id: a.userId, name: a.user.name ?? a.user.email, joined: a.claimedAt !== null }));
  }

  private async joined(taskId: string, userId: string) {
    const assignment = await this.prisma.assignment.findUnique({ where: { taskId_userId: { taskId, userId } } });
    return assignment?.claimedAt != null;
  }

  async answers(submissionId: string): Promise<AnswerMap> {
    const rows = await this.prisma.answer.findMany({ where: { submissionId } });
    return Object.fromEntries(rows.map((a) => [answerKey(a.fieldId, a.responseId), a.value as AnswerValue]));
  }

  async submission(submissionId: string, includeDraftComments: boolean): Promise<SubmissionDTO> {
    const submission = await this.prisma.submission.findUniqueOrThrow({
      where: { id: submissionId },
      include: {
        user: { select: { name: true, email: true } },
        reviews: {
          where: includeDraftComments ? {} : { verdict: { in: ['RETURNED', 'APPROVED'] } },
          include: { comments: { orderBy: { createdAt: 'asc' } }, reviewer: { select: { name: true, email: true } } },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    const comments: ReviewCommentDTO[] = submission.reviews.flatMap((review) =>
      review.comments.map((c) => ({
        id: c.id,
        fieldId: c.fieldId,
        responseId: c.responseId,
        body: c.body,
        suggestedValue: c.suggestedValue,
        reviewerName: review.reviewer.name ?? review.reviewer.email,
        createdAt: c.createdAt.toISOString(),
        draft: review.verdict === 'SUBMITTED',
      })),
    );
    return {
      id: submission.id,
      status: submission.status,
      activeSeconds: submission.activeSeconds,
      submittedAt: submission.submittedAt?.toISOString() ?? null,
      answers: await this.answers(submissionId),
      comments,
      raterName: submission.user.name,
      raterEmail: submission.user.email,
      team: await this.team(submission.taskId),
    };
  }
}
