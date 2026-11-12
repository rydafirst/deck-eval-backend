import { Module } from '@nestjs/common';
import { DocumentConverter } from './document-converter';
import { IntakeAiService } from './intake-ai.service';
import { IntakeController } from './intake.controller';
import { IntakeFilesService } from './intake-files.service';
import { IntakeService } from './intake.service';

@Module({
  controllers: [IntakeController],
  providers: [DocumentConverter, IntakeFilesService, IntakeAiService, IntakeService],
})
export class IntakeModule {}
