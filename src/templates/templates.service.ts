import { Injectable, NotFoundException } from '@nestjs/common';
import type { FieldConfig, RubricFieldDef, TemplateDTO } from '../shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import type { TemplateInput } from './template.schema';
import { TemplatesRepository } from './templates.repository';

type TemplateRow = NonNullable<Awaited<ReturnType<TemplatesRepository['findById']>>>;

export function toFieldDef(field: TemplateRow['fields'][number]): RubricFieldDef {
  return {
    id: field.id,
    key: field.key,
    order: field.order,
    label: field.label,
    helpText: field.helpText,
    type: field.type,
    scope: field.scope,
    required: field.required,
    config: (field.config ?? {}) as FieldConfig,
  };
}

@Injectable()
export class TemplatesService {
  constructor(
    private readonly repo: TemplatesRepository,
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async list(): Promise<TemplateDTO[]> {
    const templates = await this.repo.findAll();
    const counts = await this.countMap(templates.map((t) => t.id));
    return templates.map((t) => this.toDTO(t, counts.get(t.id) ?? 0));
  }

  async get(id: string): Promise<TemplateDTO> {
    const template = await this.repo.findById(id);
    if (!template) throw new NotFoundException('Template not found');
    const counts = await this.countMap([id]);
    return this.toDTO(template, counts.get(id) ?? 0);
  }

  async fields(id: string): Promise<RubricFieldDef[]> {
    const fields = await this.prisma.rubricField.findMany({ where: { templateId: id }, orderBy: { order: 'asc' } });
    return fields.map(toFieldDef);
  }

  async create(userId: string, input: TemplateInput): Promise<TemplateDTO> {
    const template = await this.repo.create(input.name, input.fields);
    await this.audit.log(userId, 'create', 'RubricTemplate', template.id);
    return this.toDTO(template, 0);
  }

  async update(userId: string, id: string, input: TemplateInput): Promise<TemplateDTO> {
    const current = await this.get(id);
    if (current.submissionCount === 0) {
      const updated = await this.repo.replaceFields(id, input.name, input.fields);
      await this.audit.log(userId, 'update', 'RubricTemplate', id);
      return this.toDTO(updated, 0);
    }
    const next = await this.repo.create(input.name, input.fields, current.version + 1, id);
    await this.repo.repointProjects(id, next.id);
    await this.repo.repointUnstartedTasks(id, next.id);
    await this.audit.log(userId, 'version', 'RubricTemplate', next.id, { from: id, version: next.version });
    return this.toDTO(next, 0);
  }

  private async countMap(ids: string[]) {
    const rows = await this.repo.submissionCounts(ids);
    return new Map(rows.map((r) => [r.templateVersionId, r._count._all]));
  }

  private toDTO(t: TemplateRow, submissionCount: number): TemplateDTO {
    return {
      id: t.id,
      name: t.name,
      version: t.version,
      parentId: t.parentId,
      fields: t.fields.map(toFieldDef),
      submissionCount,
      projectNames: t.projects.map((p) => p.name),
    };
  }
}
