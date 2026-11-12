import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  progressFor, type DashboardDTO, type DashboardItemDTO, type RubricFieldDef, type SessionUser,
} from '../shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskPresenter } from '../tasks/task.presenter';
import { TaskStatusService } from '../tasks/task-status.service';
import { taskSummaryInclude } from '../tasks/tasks.repository';
import { TemplatesService } from '../templates/templates.service';
import { WorkspaceService } from '../submissions/workspace.service';

const OPEN_STATUSES = ['PUBLISHED', 'IN_PROGRESS'] as const;

@Injectable()
export class QueueService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly presenter: TaskPresenter,
    private readonly status: TaskStatusService,
    private readonly templates: TemplatesService,
    private readonly workspace: WorkspaceService,
    private readonly audit: AuditService,
  ) {}

  async dashboard(user: SessionUser): Promise<DashboardDTO> {
    const [next, submissions] = await Promise.all([
      this.nextEligible(user.id),
      this.prisma.submission.findMany({
        where: { OR: [{ userId: user.id }, { task: { sharedSheet: true, assignments: { some: { userId: user.id, claimedAt: { not: null } } } } }] },
        include: { task: { include: { ...taskSummaryInclude, responses: { select: { id: true, label: true }, orderBy: { order: 'asc' } } } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    const fieldCache = new Map<string, RubricFieldDef[]>();
    const items = await Promise.all(
      submissions.map(async (s): Promise<DashboardItemDTO> => {
        if (!fieldCache.has(s.templateVersionId)) fieldCache.set(s.templateVersionId, await this.templates.fields(s.templateVersionId));
        const fields = fieldCache.get(s.templateVersionId)!;
        const answers = await this.workspace.answers(s.id);
        const scopes = [...s.task.responses.map((r) => r.id), null];
        const progress = scopes
          .map((scope) => progressFor(fields, s.task.responses, answers, scope))
          .reduce((acc, p) => ({ done: acc.done + p.done, total: acc.total + p.total }), { done: 0, total: 0 });
        return { task: this.presenter.summary(s.task), submissionId: s.id, submissionStatus: s.status, progress };
      }),
    );

    return {
      next: next ? this.presenter.summary(next) : null,
      returned: items.filter((i) => i.submissionStatus === 'RETURNED'),
      inProgress: items.filter((i) => i.submissionStatus === 'DRAFT'),
      completed: items.filter((i) => i.submissionStatus === 'SUBMITTED' || i.submissionStatus === 'APPROVED'),
    };
  }

  async claimNext(user: SessionUser) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const next = await this.nextEligible(user.id);
      if (!next) throw new NotFoundException('There are no tasks waiting for you right now');
      try {
        return await this.claim(user, next.id);
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    throw new ConflictException('Tasks are being claimed quickly, please try again');
  }

  async claim(user: SessionUser, taskId: string) {
    const submission = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Task" WHERE id = ${taskId} FOR UPDATE`;
      const task = await tx.task.findUnique({
        where: { id: taskId },
        include: { assignments: { where: { userId: user.id } }, _count: { select: { submissions: true } } },
      });
      if (!task || !OPEN_STATUSES.includes(task.status as (typeof OPEN_STATUSES)[number])) {
        throw new NotFoundException('Task is not available');
      }
      const existing = await tx.submission.findUnique({ where: { taskId_userId: { taskId, userId: user.id } } });
      if (existing) return existing;

      const assigned = task.assignments.length > 0;
      if (task.sharedSheet && !assigned) throw new ConflictException('Only the people an admin adds to this team can join it');
      const hasSlot = task.openQueue && task._count.submissions < task.ratersNeeded;
      if (!assigned && !hasSlot) throw new ConflictException('This task has all the raters it needs');

      await tx.assignment.upsert({
        where: { taskId_userId: { taskId, userId: user.id } },
        create: { taskId, userId: user.id, claimedAt: new Date() },
        update: { claimedAt: new Date() },
      });
      const shared = task.sharedSheet ? await tx.submission.findFirst({ where: { taskId }, orderBy: { createdAt: 'asc' } }) : null;
      return shared ?? tx.submission.create({ data: { taskId, userId: user.id, templateVersionId: task.templateVersionId } });
    });
    await this.status.refresh(taskId);
    await this.audit.log(user.id, 'claim', 'Task', taskId, { submissionId: submission.id });
    return { taskId, submissionId: submission.id };
  }

  async unclaim(user: SessionUser, taskId: string) {
    const task = await this.prisma.task.findUniqueOrThrow({ where: { id: taskId }, select: { openQueue: true, sharedSheet: true } });
    const submission = await this.workspace.sheetFor(taskId, task.sharedSheet, user.id);
    if (!submission) throw new NotFoundException('You have not claimed this task');
    if (submission.status !== 'DRAFT') throw new BadRequestException('Only tasks that have not been submitted can be unclaimed');

    const teammate = task.sharedSheet
      ? await this.prisma.assignment.findFirst({ where: { taskId, userId: { not: user.id }, claimedAt: { not: null } }, orderBy: { claimedAt: 'asc' } })
      : null;
    if (teammate) {
      await this.prisma.$transaction([
        this.prisma.assignment.updateMany({ where: { taskId, userId: user.id }, data: { claimedAt: null } }),
        ...(submission.userId === user.id ? [this.prisma.submission.update({ where: { id: submission.id }, data: { userId: teammate.userId } })] : []),
      ]);
      await this.audit.log(user.id, 'leave', 'Task', taskId, { submissionId: submission.id });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.submission.delete({ where: { id: submission.id } }),
      task.openQueue
        ? this.prisma.assignment.deleteMany({ where: { taskId, userId: user.id } })
        : this.prisma.assignment.updateMany({ where: { taskId, userId: user.id }, data: { claimedAt: null } }),
    ]);
    await this.status.refresh(taskId);
    await this.audit.log(user.id, 'unclaim', 'Task', taskId);
  }

  async escalate(user: SessionUser, taskId: string, note: string) {
    const escalation = await this.prisma.escalation.create({ data: { taskId, userId: user.id, note } });
    await this.audit.log(user.id, 'escalate', 'Task', taskId, { escalationId: escalation.id });
    return escalation;
  }

  async escalations() {
    const rows = await this.prisma.escalation.findMany({
      where: { resolvedAt: null },
      include: { task: { select: { title: true } }, user: { select: { name: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((e) => ({
      id: e.id,
      taskId: e.taskId,
      taskTitle: e.task.title,
      note: e.note,
      raterName: e.user.name ?? e.user.email,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async resolveEscalation(user: SessionUser, id: string) {
    await this.prisma.escalation.update({ where: { id }, data: { resolvedAt: new Date() } });
    await this.audit.log(user.id, 'resolve', 'Escalation', id);
  }

  private async nextEligible(userId: string) {
    const candidates = await this.prisma.task.findMany({
      where: {
        status: { in: [...OPEN_STATUSES] },
        submissions: { none: { userId } },
        assignments: { none: { userId, claimedAt: { not: null } } },
        OR: [{ assignments: { some: { userId } } }, { openQueue: true, sharedSheet: false }],
      },
      include: { ...taskSummaryInclude, assignments: { where: { userId }, select: { id: true } } },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
      take: 50,
    });
    return candidates.find((t) => t.assignments.length > 0 || t._count.submissions < t.ratersNeeded) ?? null;
  }
}
