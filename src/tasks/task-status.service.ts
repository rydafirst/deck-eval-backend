import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async refresh(taskId: string): Promise<void> {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      select: { status: true, submissions: { select: { status: true } } },
    });
    if (!task || task.status === 'DRAFT' || task.status === 'ARCHIVED') return;

    const approved = task.submissions.some((s) => s.status === 'APPROVED');
    const next = approved ? 'COMPLETED' : task.submissions.length > 0 ? 'IN_PROGRESS' : 'PUBLISHED';
    if (next !== task.status) await this.prisma.task.update({ where: { id: taskId }, data: { status: next } });
  }
}
