import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { DocumentsModule } from '../documents/documents.module';
import { IntakeAiService } from './intake-ai.service';
import { IntakeController } from './intake.controller';
import { IntakeFilesService } from './intake-files.service';
import { IntakeService } from './intake.service';

@Module({
  imports: [AiModule, DocumentsModule],
  controllers: [IntakeController],
  providers: [IntakeFilesService, IntakeAiService, IntakeService],
})
export class IntakeModule {}
