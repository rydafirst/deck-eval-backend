import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { toJson } from '../common/json';
import type { FieldInput } from './template.schema';

const withFields = { fields: { orderBy: { order: 'asc' as const } }, projects: { select: { name: true } } };

@Injectable()
export class TemplatesRepository {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.rubricTemplate.findMany({ include: withFields, orderBy: [{ name: 'asc' }, { version: 'desc' }] });
  }

  findById(id: string) {
    return this.prisma.rubricTemplate.findUnique({ where: { id }, include: withFields });
  }

  submissionCounts(templateIds: string[]) {
    return this.prisma.submission.groupBy({
      by: ['templateVersionId'],
      where: { templateVersionId: { in: templateIds } },
      _count: { _all: true },
    });
  }

  create(name: string, fields: FieldInput[], version = 1, parentId: string | null = null) {
    return this.prisma.rubricTemplate.create({
      data: { name, version, parentId, fields: { create: fields.map((f, order) => ({ ...f, order, config: toJson(f.config) })) } },
      include: withFields,
    });
  }

  replaceFields(id: string, name: string, fields: FieldInput[]) {
    return this.prisma.$transaction(async (tx) => {
      await tx.rubricField.deleteMany({ where: { templateId: id } });
      return tx.rubricTemplate.update({
        where: { id },
        data: { name, fields: { create: fields.map((f, order) => ({ ...f, order, config: toJson(f.config) })) } },
        include: withFields,
      });
    });
  }

  repointProjects(fromId: string, toId: string) {
    return this.prisma.project.updateMany({ where: { templateId: fromId }, data: { templateId: toId } });
  }

  repointUnstartedTasks(fromId: string, toId: string) {
    return this.prisma.task.updateMany({
      where: { templateVersionId: fromId, submissions: { none: {} } },
      data: { templateVersionId: toId },
    });
  }
}
