import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { GuidesService } from './guides.service';

const guideSchema = z.object({ body: z.string().trim().min(1).max(100_000) });

@Roles('ADMIN')
@Controller('admin/guides')
export class GuidesController {
  constructor(private readonly guides: GuidesService) {}

  @Get()
  list() {
    return this.guides.list();
  }

  @Put(':key')
  update(@CurrentUser() user: SessionUser, @Param('key') key: string, @Body(new ZodPipe(guideSchema)) body: { body: string }) {
    return this.guides.update(user.id, key, body.body);
  }

  @Post(':key/reset')
  reset(@CurrentUser() user: SessionUser, @Param('key') key: string) {
    return this.guides.reset(user.id, key);
  }
}
