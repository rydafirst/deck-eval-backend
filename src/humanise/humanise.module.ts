import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { GuidesModule } from '../guides/guides.module';
import { JobsModule } from '../jobs/jobs.module';
import { HumaniseController } from './humanise.controller';
import { HumaniseService } from './humanise.service';

@Module({ imports: [AiModule, GuidesModule, JobsModule], controllers: [HumaniseController], providers: [HumaniseService] })
export class HumaniseModule {}
