import { Controller, Get, Param } from '@nestjs/common';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { JobsService } from './jobs.service';

@Roles('ADMIN')
@Controller('admin/jobs')
export class JobsController {
  constructor(private readonly jobs: JobsService) {}

  @Get(':id')
  get(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.jobs.get(id, user.id);
  }
}
