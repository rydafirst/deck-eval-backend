import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../common/json';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(userId: string, action: string, entity: string, entityId: string, meta?: Record<string, unknown>) {
    await this.prisma.auditLog.create({
      data: { userId, action, entity, entityId, meta: meta ? toJson(meta) : undefined },
    });
  }

  list(entity?: string, entityId?: string, take = 100) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
      take,
    });
  }
}
