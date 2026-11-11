import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  answerKey, type AnswerMap, type AnswerValue, type ReviewCommentDTO, type SessionUser, type SubmissionDTO, type WorkspaceDTO,
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

    const submission = await this.prisma.submission.findUnique({ where: { taskId_userId: { taskId, userId: user.id } } });
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

  async ownedSubmission(submissionId: string, userId: string) {
    const submission = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.userId !== userId) throw new ForbiddenException();
    return submission;
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
    };
  }
}
