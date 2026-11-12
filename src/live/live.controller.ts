import { Body, Controller, HttpCode, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import type { LiveSyncInput, SessionUser } from '../shared';
import { CurrentUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { LiveService } from './live.service';

const fieldRef = z.object({ fieldId: z.string().min(1), responseId: z.string().nullable() });
const syncSchema = z.object({
  since: z.string().datetime().nullable(),
  viewing: z.string().max(100).nullable(),
  focus: fieldRef.nullable(),
  typing: z.boolean(),
});

@Controller('submissions/:id/live')
export class LiveController {
  constructor(private readonly live: LiveService) {}

  @Post()
  @HttpCode(200)
  sync(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(syncSchema)) body: LiveSyncInput) {
    return this.live.sync(user, id, body);
  }

  @Post('leave')
  @HttpCode(204)
  leave(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    this.live.leave(user, id);
  }
}
