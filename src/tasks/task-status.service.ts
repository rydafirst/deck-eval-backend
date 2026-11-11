import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async refresh(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, ratersNeeded: true, submissions: { select: { status: true } } },
    });
    if (!task || task.status === 'DRAFT' || task.status === 'ARCHIVED') return;

    const approved = task.submissions.filter((s) => s.status === 'APPROVED').length;
    const next =
      approved >= task.ratersNeeded ? 'COMPLETED' : task.submissions.length > 0 ? 'IN_PROGRESS' : 'PUBLISHED';
    if (next !== task.status) await this.prisma.task.update({ where: { id: taskId }, data: { status: next } });
  }
}
