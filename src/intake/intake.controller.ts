import { BadRequestException, Body, Controller, Get, HttpCode, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { z } from 'zod';
import type { IntakeTurn, SessionUser, TaskDraft } from '../shared';
import { config } from '../config';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { IntakeAiService } from './intake-ai.service';
import { IntakeFilesService } from './intake-files.service';
import { chatSchema, taskDraftSchema } from './intake.schema';
import { IntakeService } from './intake.service';

const createSchema = z.object({ draft: taskDraftSchema, viaAi: z.boolean() });

@Roles('ADMIN')
@Controller('admin/intake')
export class IntakeController {
  constructor(
    private readonly files: IntakeFilesService,
    private readonly ai: IntakeAiService,
    private readonly intake: IntakeService,
  ) {}

  @Get('status')
  status() {
    return { aiEnabled: this.ai.enabled };
  }

  @Post('files')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: config.limits.intakeBytes } }))
  upload(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file received');
    return this.files.upload(file);
  }

  @Get('files')
  async list(@Query('ids') ids = '') {
    const manifests = await this.files.existing(ids.split(',').filter(Boolean).slice(0, 60));
    return Promise.all(manifests.map((m) => this.files.toDTO(m)));
  }

  @Post('chat')
  @HttpCode(200)
  chat(@Body(new ZodPipe(chatSchema)) body: { turns: IntakeTurn[] }) {
    return this.ai.chat(body.turns);
  }

  @Post('tasks')
  create(@CurrentUser() user: SessionUser, @Body(new ZodPipe(createSchema)) body: { draft: TaskDraft; viaAi: boolean }) {
    return this.intake.createTask(user.id, body.draft, body.viaAi);
  }
}
