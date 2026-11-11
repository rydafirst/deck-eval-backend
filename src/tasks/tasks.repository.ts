import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export const taskSummaryInclude = {
  project: { select: { name: true } },
  tags: { include: { tag: true } },
  _count: { select: { responses: true, submissions: true } },
} satisfies Prisma.TaskInclude;

export const taskDetailInclude = {
  ...taskSummaryInclude,
  inputFiles: { orderBy: { name: 'asc' } },
  responses: {
    orderBy: { order: 'asc' },
    include: { slides: { orderBy: { order: 'asc' } }, files: { orderBy: { name: 'asc' } } },
  },
  assignments: { select: { userId: true } },
} satisfies Prisma.TaskInclude;

export type TaskSummaryRow = Prisma.TaskGetPayload<{ include: typeof taskSummaryInclude }>;
export type TaskDetailRow = Prisma.TaskGetPayload<{ include: typeof taskDetailInclude }>;

export interface TaskFilters {
  status?: string;
  projectId?: string;
  tagId?: string;
  priority?: number;
  q?: string;
}

@Injectable()
export class TasksRepository {
  constructor(private readonly prisma: PrismaService) {}

  findMany(filters: TaskFilters) {
    const where: Prisma.TaskWhereInput = {
      status: filters.status ? (filters.status as Prisma.TaskWhereInput['status']) : undefined,
      projectId: filters.projectId || undefined,
      priority: filters.priority || undefined,
      tags: filters.tagId ? { some: { tagId: filters.tagId } } : undefined,
      title: filters.q ? { contains: filters.q, mode: 'insensitive' } : undefined,
    };
    return this.prisma.task.findMany({
      where,
      include: taskSummaryInclude,
      orderBy: [{ updatedAt: 'desc' }],
      take: 500,
    });
  }

  findDetail(id: string) {
    return this.prisma.task.findUnique({ where: { id }, include: taskDetailInclude });
  }

  findResponse(id: string) {
    return this.prisma.response.findUnique({ where: { id }, include: { slides: { orderBy: { order: 'asc' } } } });
  }
}
