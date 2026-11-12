import { Module } from '@nestjs/common';
import { SubmissionsModule } from '../submissions/submissions.module';
import { LiveController } from './live.controller';
import { LiveService } from './live.service';
import { PresenceStore } from './presence.store';

@Module({
  imports: [SubmissionsModule],
  controllers: [LiveController],
  providers: [LiveService, PresenceStore],
})
export class LiveModule {}
