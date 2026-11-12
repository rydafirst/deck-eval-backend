import {
  Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Put, Query, UploadedFile, UploadedFiles, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import {
  assignmentSchema, basicsSchema, briefSchema, slideCaptionSchema, slideMoveSchema, slideOrderSchema, statusSchema,
  type AssignmentInput, type BasicsInput, type BriefInput, type SlideMoveInput,
} from './task.schema';
import { TasksService } from './tasks.service';

const MAX_FILES = 200;
const uploadLimits = { limits: { fileSize: 25 * 1024 * 1024 } };

@Roles('ADMIN')
@Controller('admin/tasks')
export class TasksController {
  constructor(private readonly tasks: TasksService) {}

  @Get()
  list(
    @Query('status') status?: string,
    @Query('projectId') projectId?: string,
    @Query('tagId') tagId?: string,
    @Query('priority') priority?: string,
    @Query('q') q?: string,
  ) {
    return this.tasks.list({ status, projectId, tagId, priority: priority ? Number(priority) : undefined, q });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.tasks.get(id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body(new ZodPipe(basicsSchema)) body: BasicsInput) {
    return this.tasks.create(user.id, body);
  }

  @Put(':id/basics')
  basics(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(basicsSchema)) body: BasicsInput) {
    return this.tasks.updateBasics(user.id, id, body);
  }

  @Put(':id/brief')
  brief(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(briefSchema)) body: BriefInput) {
    return this.tasks.updateBrief(user.id, id, body);
  }

  @Put(':id/assignment')
  assignment(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(assignmentSchema)) body: AssignmentInput) {
    return this.tasks.setAssignment(user.id, id, body);
  }

  @Put(':id/status')
  status(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(statusSchema)) body: { status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) {
    return this.tasks.setStatus(user.id, id, body.status);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.tasks.duplicate(user.id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.tasks.remove(user.id, id);
  }

  @Post(':id/input-files')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, uploadLimits))
  inputFiles(@CurrentUser() user: SessionUser, @Param('id') id: string, @UploadedFiles() files: Express.Multer.File[]) {
    return this.tasks.addInputFiles(user.id, id, files ?? []);
  }

  @Delete(':id/input-files/:fileId')
  deleteInputFile(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.tasks.deleteInputFile(user.id, id, fileId);
  }

  @Post(':id/responses')
  addResponse(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    return this.tasks.addResponse(user.id, id);
  }

  @Delete(':id/responses/:responseId')
  deleteResponse(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('responseId') responseId: string) {
    return this.tasks.deleteResponse(user.id, id, responseId);
  }

  @Post(':id/responses/:responseId/slides')
  @UseInterceptors(FilesInterceptor('files', MAX_FILES, uploadLimits))
  slides(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.tasks.addSlides(user.id, id, responseId, files ?? []);
  }

  @Put(':id/responses/:responseId/slides/order')
  reorder(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @Body(new ZodPipe(slideOrderSchema)) body: { slideIds: string[] },
  ) {
    return this.tasks.reorderSlides(user.id, id, responseId, body.slideIds);
  }

  @Put(':id/slides/move')
  move(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(slideMoveSchema)) body: SlideMoveInput) {
    return this.tasks.moveSlides(user.id, id, body);
  }

  @Patch(':id/slides/:slideId')
  caption(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('slideId') slideId: string,
    @Body(new ZodPipe(slideCaptionSchema)) body: { caption: string | null },
  ) {
    return this.tasks.captionSlide(user.id, id, slideId, body.caption);
  }

  @Put(':id/slides/:slideId/image')
  @UseInterceptors(FileInterceptor('file', uploadLimits))
  replace(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('slideId') slideId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.tasks.replaceSlide(user.id, id, slideId, file);
  }

  @Delete(':id/slides/:slideId')
  deleteSlide(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('slideId') slideId: string) {
    return this.tasks.deleteSlide(user.id, id, slideId);
  }

  @Post(':id/responses/:responseId/files')
  @UseInterceptors(FilesInterceptor('files', 10, uploadLimits))
  responseFiles(
    @CurrentUser() user: SessionUser,
    @Param('id') id: string,
    @Param('responseId') responseId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.tasks.addResponseFiles(user.id, id, responseId, files ?? []);
  }

  @Delete(':id/response-files/:fileId')
  deleteResponseFile(@CurrentUser() user: SessionUser, @Param('id') id: string, @Param('fileId') fileId: string) {
    return this.tasks.deleteResponseFile(user.id, id, fileId);
  }
}
