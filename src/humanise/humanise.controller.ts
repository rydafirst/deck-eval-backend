import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { z } from 'zod';
import { HUMANISE_MODES, type HumaniseItem, type HumaniseMode, type SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { HumaniseService } from './humanise.service';

const humaniseSchema = z.object({
  mode: z.enum(HUMANISE_MODES),
  items: z
    .array(z.object({ key: z.string().min(1).max(200), label: z.string().max(300), text: z.string().trim().min(1).max(6000) }))
    .min(1)
    .max(80),
});

@Roles('ADMIN')
@Controller('admin/humanise')
export class HumaniseController {
  constructor(private readonly humanise: HumaniseService) {}

  @Post()
  @HttpCode(200)
  start(@CurrentUser() user: SessionUser, @Body(new ZodPipe(humaniseSchema)) body: { mode: HumaniseMode; items: HumaniseItem[] }) {
    return this.humanise.start(user.id, body.mode, body.items);
  }
}
