import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { ReviewQueueItemDTO, SessionUser, SubStatus } from '../shared';
import type { Prisma } from '../generated/prisma/client';
import { AuditService } from '../audit/audit.service';
import { toJson } from '../common/json';
import { PrismaService } from '../prisma/prisma.service';
import { TaskStatusService } from '../tasks/task-status.service';

export interface ReviewFilters {
  status?: SubStatus;
  projectId?: string;
  tagId?: string;
  raterId?: string;
}

export interface CommentInput {
  fieldId: string;
  responseId: string | null;
  body: string;
  suggestedValue?: unknown;
}

const DRAFT_VERDICT = 'SUBMITTED';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly status: TaskStatusService,
    private readonly audit: AuditService,
  ) {}

  async queue(filters: ReviewFilters): Promise<ReviewQueueItemDTO[]> {
    const where: Prisma.SubmissionWhereInput = {
      status: filters.status ?? 'SUBMITTED',
      userId: filters.raterId || undefined,
      task: {
        projectId: filters.projectId || undefined,
        tags: filters.tagId ? { some: { tagId: filters.tagId } } : undefined,
      },
    };
    const rows = await this.prisma.submission.findMany({
      where,
      include: {
        user: { select: { name: true, email: true } },
        task: { select: { title: true, project: { select: { name: true } }, tags: { include: { tag: true } } } },
      },
      orderBy: { submittedAt: 'asc' },
      take: 500,
    });
    return rows.map((s) => ({
      submissionId: s.id,
      taskId: s.taskId,
      taskTitle: s.task.title,
      projectName: s.task.project.name,
      raterName: s.user.name,
      raterEmail: s.user.email,
      submittedAt: s.submittedAt?.toISOString() ?? null,
      status: s.status,
      tags: s.task.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
    }));
  }

  async addComment(reviewer: SessionUser, submissionId: string, input: CommentInput) {
    await this.reviewable(submissionId);
    const review = await this.draftReview(reviewer.id, submissionId);
    const comment = await this.prisma.reviewComment.create({
      data: {
        reviewId: review.id,
        fieldId: input.fieldId,
        responseId: input.responseId,
        body: input.body,
        suggestedValue: input.suggestedValue === undefined || input.suggestedValue === null ? undefined : toJson(input.suggestedValue),
      },
    });
    await this.audit.log(reviewer.id, 'comment', 'Submission', submissionId, { commentId: comment.id });
    return comment;
  }

  async deleteComment(reviewer: SessionUser, commentId: string) {
    const comment = await this.prisma.reviewComment.findUnique({ where: { id: commentId }, include: { review: true } });
    if (!comment) throw new NotFoundException('Comment not found');
    if (comment.review.verdict !== DRAFT_VERDICT || comment.review.reviewerId !== reviewer.id) {
      throw new BadRequestException('Only your unsent comments can be deleted');
    }
    await this.prisma.reviewComment.delete({ where: { id: commentId } });
  }

  async decide(reviewer: SessionUser, submissionId: string, verdict: 'APPROVED' | 'RETURNED', summary?: string) {
    const submission = await this.reviewable(submissionId);
    const review = await this.draftReview(reviewer.id, submissionId);
    await this.prisma.$transaction([
      this.prisma.review.update({ where: { id: review.id }, data: { verdict, summary: summary?.trim() || null } }),
      this.prisma.submission.update({ where: { id: submissionId }, data: { status: verdict } }),
    ]);
    await this.status.refresh(submission.taskId);
    await this.audit.log(reviewer.id, verdict === 'APPROVED' ? 'approve' : 'return', 'Submission', submissionId, { reviewId: review.id });
    return { status: verdict };
  }

  private async reviewable(submissionId: string) {
    const submission = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.status !== 'SUBMITTED') throw new BadRequestException('Only submitted work can be reviewed');
    return submission;
  }

  private async draftReview(reviewerId: string, submissionId: string) {
    const existing = await this.prisma.review.findFirst({ where: { submissionId, reviewerId, verdict: DRAFT_VERDICT } });
    return existing ?? this.prisma.review.create({ data: { submissionId, reviewerId, verdict: DRAFT_VERDICT } });
  }
}
