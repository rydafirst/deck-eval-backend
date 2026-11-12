import { Controller, Param, Post } from '@nestjs/common';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { QcService } from './qc.service';

@Roles('ADMIN')
@Controller('submissions/:id/qc')
export class QcController {
  constructor(private readonly qc: QcService) {}

  @Post()
  start(@CurrentUser() user: SessionUser, @Param('id') submissionId: string) {
    return this.qc.start(user.id, submissionId);
  }
}
