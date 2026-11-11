import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { TemplatesModule } from '../templates/templates.module';
import { QueueController } from './queue.controller';
import { QueueService } from './queue.service';

@Module({ imports: [SubmissionsModule, TemplatesModule], controllers: [QueueController], providers: [QueueService] })
export class QueueModule {}
