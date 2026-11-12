import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { JobDTO, QcResult } from '../shared';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { PrismaService } from '../prisma/prisma.service';
import { TemplatesService } from '../templates/templates.service';
import { QcGraderService } from './qc-grader.service';

const EDITABLE = ['DRAFT', 'RETURNED'];

@Injectable()
export class QcService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly templates: TemplatesService,
    private readonly grader: QcGraderService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  async start(userId: string, submissionId: string): Promise<JobDTO<QcResult>> {
    const submission = await this.prisma.submission.findUnique({ where: { id: submissionId } });
    if (!submission) throw new NotFoundException('Submission not found');
    if (submission.userId !== userId) throw new ForbiddenException();
    if (!EDITABLE.includes(submission.status)) throw new BadRequestException('This submission can no longer be edited');
    this.grader.ensureReady();

    const fields = await this.templates.fields(submission.templateVersionId);
    await this.audit.log(userId, 'qc', 'Submission', submissionId);
    return this.jobs.start(userId, `qc:${submissionId}`, () => this.grader.grade(submission.taskId, fields));
  }
}
