import { Controller, Get, Query } from '@nestjs/common';
import type { StatsDTO, TaskStatus } from '../shared';
import { AuditService } from '../audit/audit.service';
import { Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

const STATUSES: TaskStatus[] = ['DRAFT', 'PUBLISHED', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

@Roles('ADMIN')
@Controller('admin')
export class StatsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get('stats')
  async stats(): Promise<StatsDTO> {
    const [byStatus, awaitingReview, avg, perRater, users] = await Promise.all([
      this.prisma.task.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.submission.count({ where: { status: 'SUBMITTED' } }),
      this.prisma.submission.aggregate({ where: { status: { not: 'DRAFT' } }, _avg: { activeSeconds: true } }),
      this.prisma.submission.groupBy({ by: ['userId', 'status'], _count: { _all: true } }),
      this.prisma.user.findMany({ where: { role: 'RATER' }, select: { id: true, name: true, email: true } }),
    ]);

    const tasksByStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<TaskStatus, number>;
    byStatus.forEach((row) => (tasksByStatus[row.status] = row._count._all));
    const countFor = (userId: string, status: string) =>
      perRater.find((r) => r.userId === userId && r.status === status)?._count._all ?? 0;

    return {
      tasksByStatus,
      awaitingReview,
      avgActiveSeconds: Math.round(avg._avg.activeSeconds ?? 0),
      perRater: users.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        submitted: countFor(u.id, 'SUBMITTED'),
        approved: countFor(u.id, 'APPROVED'),
        returned: countFor(u.id, 'RETURNED'),
      })),
    };
  }

  @Get('audit')
  auditLog(@Query('entity') entity?: string, @Query('entityId') entityId?: string) {
    return this.audit.list(entity, entityId);
  }
}
