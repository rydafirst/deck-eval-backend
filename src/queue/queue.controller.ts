import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { QueueService } from './queue.service';

const escalateSchema = z.object({ note: z.string().trim().min(1).max(2000) });

@Controller()
export class QueueController {
  constructor(private readonly queue: QueueService) {}

  @Get('dashboard')
  dashboard(@CurrentUser() user: SessionUser) {
    return this.queue.dashboard(user);
  }

  @Post('queue/next')
  @HttpCode(200)
  claimNext(@CurrentUser() user: SessionUser) {
    return this.queue.claimNext(user);
  }

  @Post('tasks/:id/claim')
  @HttpCode(200)
  claim(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.queue.claim(user, id);
  }

  @Post('tasks/:id/unclaim')
  @HttpCode(204)
  unclaim(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.queue.unclaim(user, id);
  }

  @Post('tasks/:id/escalate')
  escalate(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(escalateSchema)) body: { note: string }) {
    return this.queue.escalate(user, id, body.note);
  }

  @Roles('ADMIN')
  @Get('admin/escalations')
  escalations() {
    return this.queue.escalations();
  }

  @Roles('ADMIN')
  @Post('admin/escalations/:id/resolve')
  @HttpCode(204)
  resolve(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.queue.resolveEscalation(user, id);
  }
}
