import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { GuidesModule } from '../guides/guides.module';
import { JobsModule } from '../jobs/jobs.module';
import { SubmissionsModule } from '../submissions/submissions.module';
import { TemplatesModule } from '../templates/templates.module';
import { QcGraderService } from './qc-grader.service';
import { QcController } from './qc.controller';
import { QcService } from './qc.service';

@Module({
  imports: [AiModule, DocumentsModule, GuidesModule, JobsModule, SubmissionsModule, TemplatesModule],
  controllers: [QcController],
  providers: [QcGraderService, QcService],
})
export class QcModule {}
