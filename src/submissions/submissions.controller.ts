import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { SubmissionsService, type AnswerInput } from './submissions.service';
import { WorkspaceService } from './workspace.service';

const answersSchema = z.object({
  answers: z
    .array(z.object({ fieldId: z.string(), responseId: z.string().nullable(), value: z.unknown() }))
    .min(1)
    .max(200),
});
const timeSchema = z.object({ seconds: z.number().min(0).max(600) });

@Controller()
export class SubmissionsController {
  constructor(
    private readonly workspace: WorkspaceService,
    private readonly submissions: SubmissionsService,
  ) {}

  @Get('tasks/:id/workspace')
  forRater(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.workspace.forRater(id, user);
  }

  @Roles('ADMIN')
  @Get('admin/tasks/:id/preview')
  preview(@Param('id') id: string) {
    return this.workspace.forPreview(id);
  }

  @Put('submissions/:id/answers')
  save(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(answersSchema)) body: { answers: AnswerInput[] }) {
    return this.submissions.saveAnswers(user, id, body.answers);
  }

  @Post('submissions/:id/time')
  @HttpCode(200)
  time(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(timeSchema)) body: { seconds: number }) {
    return this.submissions.addTime(user, id, body.seconds);
  }

  @Post('submissions/:id/submit')
  @HttpCode(200)
  submit(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.submissions.submit(user, id);
  }
}
