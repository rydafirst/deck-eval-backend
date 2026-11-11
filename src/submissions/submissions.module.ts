import { Module } from '@nestjs/common';
import { TemplatesModule } from '../templates/templates.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { WorkspaceService } from './workspace.service';

@Module({
  imports: [TemplatesModule],
  controllers: [SubmissionsController],
  providers: [WorkspaceService, SubmissionsService],
  exports: [WorkspaceService],
})
export class SubmissionsModule {}
