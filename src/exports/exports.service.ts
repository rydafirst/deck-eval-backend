import { Injectable } from '@nestjs/common';
import type { Writable } from 'node:stream';
import { rankSlots, TASK_SCOPE, type RubricFieldDef, type SubStatus } from '../shared';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { CSV_BOM, csvRow } from './csv';

export interface ExportFilters {
  projectId?: string;
  from?: string;
  to?: string;
  status?: SubStatus;
}

const BATCH = 200;
const META_COLUMNS = ['task_id', 'task_title', 'project', 'rater_email', 'rater_name', 'status', 'submitted_at', 'active_seconds', 'response'];

const submissionInclude = {
  user: { select: { email: true, name: true } },
  answers: true,
  task: { select: { id: true, title: true, project: { select: { name: true } }, responses: { orderBy: { order: 'asc' as const } } } },
  reviews: { where: { verdict: { not: 'SUBMITTED' as const } }, include: { comments: true } },
} satisfies Prisma.SubmissionInclude;

type SubmissionRow = Prisma.SubmissionGetPayload<{ include: typeof submissionInclude }>;

@Injectable()
export class ExportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
  ) {}

  async writeCsv(filters: ExportFilters, out: Writable) {
    const where = this.where(filters);
    const fieldsByTemplate = await this.fieldsFor(where);
    const { perResponse, perTask, maxResponses } = this.columns([...fieldsByTemplate.values()].flat(), await this.maxResponses(where));
    const rankColumns = (key: string) => rankSlots(Array.from({ length: maxResponses }, (_, i) => ({ id: String(i), label: '' }))).map((r) => `${key}_${r}`);
    const taskColumns = perTask.flatMap((f) => (f.type === 'RANKING' ? rankColumns(f.key) : [f.key]));

    out.write(CSV_BOM + csvRow([...META_COLUMNS, ...perResponse.map((f) => f.key), ...taskColumns]));

    await this.eachBatch(where, (submission) => {
      const fields = fieldsByTemplate.get(submission.templateVersionId) ?? [];
      const byKey = new Map(fields.map((f) => [f.key, f]));
      const labelOf = new Map(submission.task.responses.map((r) => [r.id, r.label]));
      const answer = (fieldId: string | undefined, scope: string) =>
        submission.answers.find((a) => a.fieldId === fieldId && a.scope === scope)?.value;

      const taskValues = perTask.flatMap((column) => {
        const value = answer(byKey.get(column.key)?.id, TASK_SCOPE);
        if (column.type !== 'RANKING') return [value];
        const ranking = (value ?? {}) as Record<string, string>;
        return rankColumns(column.key).map((_, i) => labelOf.get(ranking[`rank${i + 1}`]) ?? '');
      });

      for (const response of submission.task.responses) {
        out.write(
          csvRow([
            submission.task.id,
            submission.task.title,
            submission.task.project.name,
            submission.user.email,
            submission.user.name,
            submission.status,
            submission.submittedAt?.toISOString(),
            submission.activeSeconds,
            response.label,
            ...perResponse.map((column) => answer(byKey.get(column.key)?.id, response.id)),
            ...taskValues,
          ]),
        );
      }
    });
  }

  async writeJson(filters: ExportFilters, out: Writable) {
    const where = this.where(filters);
    const fieldsByTemplate = await this.fieldsFor(where);
    let first = true;
    out.write('[');
    await this.eachBatch(where, (submission) => {
      const fields = fieldsByTemplate.get(submission.templateVersionId) ?? [];
      const byId = new Map(fields.map((f) => [f.id, f]));
      const valueFor = (fieldId: string, scope: string) =>
        submission.answers.find((a) => a.fieldId === fieldId && a.scope === scope)?.value ?? null;
      const record = {
        submissionId: submission.id,
        status: submission.status,
        submittedAt: submission.submittedAt,
        activeSeconds: submission.activeSeconds,
        templateVersionId: submission.templateVersionId,
        rater: submission.user,
        task: { id: submission.task.id, title: submission.task.title, project: submission.task.project.name },
        responses: submission.task.responses.map((r) => ({
          label: r.label,
          answers: Object.fromEntries(fields.filter((f) => f.scope === 'PER_RESPONSE' && f.type !== 'SECTION').map((f) => [f.key, valueFor(f.id, r.id)])),
        })),
        taskAnswers: Object.fromEntries(fields.filter((f) => f.scope === 'PER_TASK').map((f) => [f.key, valueFor(f.id, TASK_SCOPE)])),
        reviews: submission.reviews.map((review) => ({
          verdict: review.verdict,
          summary: review.summary,
          createdAt: review.createdAt,
          comments: review.comments.map((c) => ({
            field: byId.get(c.fieldId)?.key ?? c.fieldId,
            response: submission.task.responses.find((r) => r.id === c.responseId)?.label ?? null,
            body: c.body,
            suggestedValue: c.suggestedValue,
          })),
        })),
      };
      out.write(`${first ? '' : ','}\n${JSON.stringify(record)}`);
      first = false;
    });
    out.write('\n]\n');
  }

  private where(filters: ExportFilters): Prisma.SubmissionWhereInput {
    return {
      status: filters.status ?? { not: 'DRAFT' },
      task: filters.projectId ? { projectId: filters.projectId } : undefined,
      submittedAt: filters.from || filters.to
        ? { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(`${filters.to}T23:59:59.999Z`) : undefined }
        : undefined,
    };
  }

  private async fieldsFor(where: Prisma.SubmissionWhereInput) {
    const versions = await this.prisma.submission.findMany({ where, distinct: ['templateVersionId'], select: { templateVersionId: true } });
    const entries = await Promise.all(versions.map(async (v) => [v.templateVersionId, await this.templates.fields(v.templateVersionId)] as const));
    return new Map<string, RubricFieldDef[]>(entries);
  }

  private async maxResponses(where: Prisma.SubmissionWhereInput) {
    const tasks = await this.prisma.task.findMany({
      where: { submissions: { some: where } },
      select: { _count: { select: { responses: true } } },
    });
    return Math.max(0, ...tasks.map((t) => t._count.responses));
  }

  private columns(fields: RubricFieldDef[], maxResponses: number) {
    const seen = new Set<string>();
    const unique = [...fields].sort((a, b) => a.order - b.order).filter((f) => f.type !== 'SECTION' && !seen.has(f.key) && seen.add(f.key));
    return {
      perResponse: unique.filter((f) => f.scope === 'PER_RESPONSE'),
      perTask: unique.filter((f) => f.scope === 'PER_TASK'),
      maxResponses,
    };
  }

  private async eachBatch(where: Prisma.SubmissionWhereInput, handle: (s: SubmissionRow) => void) {
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.prisma.submission.findMany({
        where,
        include: submissionInclude,
        orderBy: { id: 'asc' },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      });
      batch.forEach(handle);
      if (batch.length < BATCH) return;
      cursor = batch[batch.length - 1].id;
    }
  }
}
