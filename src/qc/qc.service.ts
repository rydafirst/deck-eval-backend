import { BadRequestException, Injectable } from '@nestjs/common';
import type { JobDTO, QcResult } from '../shared';
import { AuditService } from '../audit/audit.service';
import { JobsService } from '../jobs/jobs.service';
import { WorkspaceService } from '../submissions/workspace.service';
import { TemplatesService } from '../templates/templates.service';
import { QcGraderService } from './qc-grader.service';

const EDITABLE = ['DRAFT', 'RETURNED'];

@Injectable()
export class QcService {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly templates: TemplatesService,
    private readonly grader: QcGraderService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  async start(userId: string, submissionId: string): Promise<JobDTO<QcResult>> {
    const submission = await this.workspace.memberSubmission(submissionId, userId);
    if (!EDITABLE.includes(submission.status)) throw new BadRequestException('This submission can no longer be edited');
    this.grader.ensureReady();

    const fields = await this.templates.fields(submission.templateVersionId);
    await this.audit.log(userId, 'qc', 'Submission', submissionId);
    return this.jobs.start(userId, `qc:${submissionId}`, () => this.grader.grade(submission.taskId, fields));
  }
}
