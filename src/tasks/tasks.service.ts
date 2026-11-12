import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { responseLabel, sortByFilename, type TaskDetailDTO } from '../shared';
import { AuditService } from '../audit/audit.service';
import { sanitizeRichText } from '../common/html';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UploadsService } from '../uploads/uploads.service';
import { TaskPresenter } from './task.presenter';
import type { AssignmentInput, BasicsInput, BriefInput, SlideMoveInput } from './task.schema';
import { TaskStatusService } from './task-status.service';
import { TasksRepository, type TaskFilters } from './tasks.repository';

const MAX_RESPONSES = 4;

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: TasksRepository,
    private readonly presenter: TaskPresenter,
    private readonly uploads: UploadsService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
    private readonly status: TaskStatusService,
  ) {}

  async list(filters: TaskFilters) {
    const tasks = await this.repo.findMany(filters);
    return tasks.map((t) => this.presenter.summary(t));
  }

  async get(id: string): Promise<TaskDetailDTO> {
    const task = await this.repo.findDetail(id);
    if (!task) throw new NotFoundException('Task not found');
    return this.presenter.detail(task);
  }

  async create(userId: string, input: BasicsInput) {
    const project = await this.prisma.project.findUnique({ where: { id: input.projectId } });
    if (!project) throw new BadRequestException('Project not found');
    const task = await this.prisma.task.create({
      data: {
        title: input.title,
        projectId: project.id,
        priority: input.priority,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        ratersNeeded: input.ratersNeeded,
        templateVersionId: project.templateId,
        createdById: userId,
        tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
      },
    });
    await this.audit.log(userId, 'create', 'Task', task.id);
    return this.get(task.id);
  }

  async updateBasics(userId: string, id: string, input: BasicsInput) {
    const existing = await this.prisma.task.findUnique({
      where: { id },
      include: { project: true, _count: { select: { submissions: true } } },
    });
    if (!existing) throw new NotFoundException('Task not found');

    let templateVersionId = existing.templateVersionId;
    if (input.projectId !== existing.projectId) {
      if (existing._count.submissions > 0) throw new BadRequestException('Cannot move a task that already has submissions');
      const project = await this.prisma.project.findUniqueOrThrow({ where: { id: input.projectId } });
      templateVersionId = project.templateId;
    }

    await this.prisma.$transaction([
      this.prisma.taskTag.deleteMany({ where: { taskId: id } }),
      this.prisma.task.update({
        where: { id },
        data: {
          title: input.title,
          projectId: input.projectId,
          priority: input.priority,
          dueAt: input.dueAt ? new Date(input.dueAt) : null,
          ratersNeeded: input.ratersNeeded,
          templateVersionId,
          tags: { create: input.tagIds.map((tagId) => ({ tagId })) },
        },
      }),
    ]);
    await this.audit.log(userId, 'update', 'Task', id, { step: 'basics' });
    return this.get(id);
  }

  async updateBrief(userId: string, id: string, input: BriefInput) {
    await this.prisma.task.update({
      where: { id },
      data: { instructions: sanitizeRichText(input.instructions), userRequest: sanitizeRichText(input.userRequest) },
    });
    await this.audit.log(userId, 'update', 'Task', id, { step: 'brief' });
    return this.get(id);
  }

  async addInputFiles(userId: string, id: string, files: Express.Multer.File[]) {
    for (const file of files) {
      const stored = await this.uploads.storeFile(`tasks/${id}/inputs`, file);
      await this.prisma.inputFile.create({ data: { taskId: id, ...stored } });
    }
    await this.audit.log(userId, 'upload', 'Task', id, { inputFiles: files.map((f) => f.originalname) });
    return this.get(id);
  }

  async deleteInputFile(userId: string, id: string, fileId: string) {
    const file = await this.prisma.inputFile.delete({ where: { id: fileId, taskId: id } });
    await this.releaseKeys([file.storageKey]);
    await this.audit.log(userId, 'delete', 'InputFile', fileId, { taskId: id });
    return this.get(id);
  }

  async addResponse(userId: string, id: string) {
    const count = await this.prisma.response.count({ where: { taskId: id } });
    if (count >= MAX_RESPONSES) throw new BadRequestException(`A task can have at most ${MAX_RESPONSES} responses`);
    const response = await this.prisma.response.create({ data: { taskId: id, label: responseLabel(count), order: count } });
    await this.audit.log(userId, 'create', 'Response', response.id, { taskId: id });
    return this.get(id);
  }

  async deleteResponse(userId: string, id: string, responseId: string) {
    await this.assertNoSubmissions(id);
    const response = await this.prisma.response.findUniqueOrThrow({
      where: { id: responseId, taskId: id },
      include: { slides: true, files: true },
    });
    await this.prisma.response.delete({ where: { id: responseId } });
    await this.releaseKeys([
      ...response.slides.flatMap((s) => [s.storageKey, s.webKey]),
      ...response.files.map((f) => f.storageKey),
    ]);
    const remaining = await this.prisma.response.findMany({ where: { taskId: id }, orderBy: { order: 'asc' } });
    await this.prisma.$transaction(
      remaining.map((r, i) => this.prisma.response.update({ where: { id: r.id }, data: { order: i, label: responseLabel(i) } })),
    );
    await this.audit.log(userId, 'delete', 'Response', responseId, { taskId: id });
    return this.get(id);
  }

  async addSlides(userId: string, id: string, responseId: string, files: Express.Multer.File[]) {
    const last = await this.prisma.slide.aggregate({ where: { responseId }, _max: { order: true } });
    let order = (last._max.order ?? -1) + 1;
    const sorted = sortByFilename(files.map((file) => ({ name: file.originalname, file })));
    for (const { file } of sorted) {
      const stored = await this.uploads.storeImage(`tasks/${id}/responses/${responseId}`, file);
      await this.prisma.slide.create({
        data: {
          responseId,
          order: order++,
          storageKey: stored.storageKey,
          webKey: stored.webKey,
          width: stored.width,
          height: stored.height,
        },
      });
    }
    await this.audit.log(userId, 'upload', 'Response', responseId, { slides: files.length });
    return this.get(id);
  }

  async moveSlides(userId: string, id: string, input: SlideMoveInput) {
    const task = await this.get(id);
    if (task.submissionCount > 0) throw new BadRequestException('Slides cannot move between responses once the task has submissions');
    if (!task.responses.some((r) => r.id === input.responseId)) throw new BadRequestException('That response is not part of this task');

    const moving = [...new Set(input.slideIds)];
    const slides = await this.prisma.slide.findMany({ where: { id: { in: moving }, response: { taskId: id } }, select: { id: true, responseId: true } });
    if (slides.length !== moving.length) throw new BadRequestException('Some slides are not part of this task');

    const ordered = await this.prisma.slide.findMany({
      where: { responseId: { in: [...new Set([input.responseId, ...slides.map((s) => s.responseId)])] } },
      orderBy: { order: 'asc' },
      select: { id: true, responseId: true },
    });
    const staying = ordered.filter((s) => s.responseId === input.responseId && !moving.includes(s.id)).map((s) => s.id);
    const at = Math.min(input.index ?? staying.length, staying.length);
    const target = [...staying.slice(0, at), ...moving, ...staying.slice(at)];
    const sources = [...new Set(slides.map((s) => s.responseId))].filter((r) => r !== input.responseId);

    await this.prisma.$transaction([
      ...target.map((slideId, order) => this.prisma.slide.update({ where: { id: slideId }, data: { responseId: input.responseId, order } })),
      ...sources.flatMap((responseId) =>
        ordered
          .filter((s) => s.responseId === responseId && !moving.includes(s.id))
          .map((s, order) => this.prisma.slide.update({ where: { id: s.id }, data: { order } })),
      ),
    ]);
    await this.audit.log(userId, 'move', 'Slide', input.responseId, { slides: moving.length, taskId: id });
    return this.get(id);
  }

  async reorderSlides(userId: string, id: string, responseId: string, slideIds: string[]) {
    const existing = await this.prisma.slide.findMany({ where: { responseId }, select: { id: true } });
    const known = new Set(existing.map((s) => s.id));
    if (slideIds.length !== known.size || slideIds.some((s) => !known.has(s))) {
      throw new BadRequestException('Slide list does not match this response');
    }
    await this.prisma.$transaction(slideIds.map((slideId, order) => this.prisma.slide.update({ where: { id: slideId }, data: { order } })));
    await this.audit.log(userId, 'reorder', 'Response', responseId);
    return this.get(id);
  }

  async captionSlide(userId: string, id: string, slideId: string, caption: string | null) {
    await this.prisma.slide.update({ where: { id: slideId }, data: { caption: caption?.trim() || null } });
    await this.audit.log(userId, 'update', 'Slide', slideId, { caption });
    return this.get(id);
  }

  async replaceSlide(userId: string, id: string, slideId: string, file: Express.Multer.File) {
    const slide = await this.prisma.slide.findUniqueOrThrow({ where: { id: slideId } });
    const stored = await this.uploads.storeImage(`tasks/${id}/responses/${slide.responseId}`, file);
    await this.prisma.slide.update({
      where: { id: slideId },
      data: { storageKey: stored.storageKey, webKey: stored.webKey, width: stored.width, height: stored.height },
    });
    await this.releaseKeys([slide.storageKey, slide.webKey]);
    await this.audit.log(userId, 'replace', 'Slide', slideId);
    return this.get(id);
  }

  async deleteSlide(userId: string, id: string, slideId: string) {
    const slide = await this.prisma.slide.delete({ where: { id: slideId } });
    await this.releaseKeys([slide.storageKey, slide.webKey]);
    const remaining = await this.prisma.slide.findMany({ where: { responseId: slide.responseId }, orderBy: { order: 'asc' } });
    await this.prisma.$transaction(remaining.map((s, order) => this.prisma.slide.update({ where: { id: s.id }, data: { order } })));
    await this.audit.log(userId, 'delete', 'Slide', slideId);
    return this.get(id);
  }

  async addResponseFiles(userId: string, id: string, responseId: string, files: Express.Multer.File[]) {
    for (const file of files) {
      const stored = await this.uploads.storeFile(`tasks/${id}/responses/${responseId}/files`, file);
      await this.prisma.responseFile.create({ data: { responseId, ...stored } });
    }
    await this.audit.log(userId, 'upload', 'Response', responseId, { files: files.map((f) => f.originalname) });
    return this.get(id);
  }

  async deleteResponseFile(userId: string, id: string, fileId: string) {
    const file = await this.prisma.responseFile.delete({ where: { id: fileId } });
    await this.releaseKeys([file.storageKey]);
    await this.audit.log(userId, 'delete', 'ResponseFile', fileId);
    return this.get(id);
  }

  async setAssignment(userId: string, id: string, input: AssignmentInput) {
    await this.prisma.$transaction([
      this.prisma.assignment.deleteMany({ where: { taskId: id, claimedAt: null, userId: { notIn: input.assigneeIds } } }),
      ...input.assigneeIds.map((assigneeId) =>
        this.prisma.assignment.upsert({
          where: { taskId_userId: { taskId: id, userId: assigneeId } },
          create: { taskId: id, userId: assigneeId },
          update: {},
        }),
      ),
      this.prisma.task.update({ where: { id }, data: { openQueue: input.sharedSheet ? false : input.openQueue, sharedSheet: input.sharedSheet, ratersNeeded: input.sharedSheet ? 1 : input.ratersNeeded } }),
    ]);
    await this.audit.log(userId, 'assign', 'Task', id, { ...input });
    await this.status.refresh(id);
    return this.get(id);
  }

  async setStatus(userId: string, id: string, status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED') {
    const task = await this.get(id);
    if (status === 'PUBLISHED') this.assertPublishable(task);
    if (status === 'DRAFT' && task.submissionCount > 0) throw new BadRequestException('Task already has submissions');
    await this.prisma.task.update({ where: { id }, data: { status } });
    if (status === 'PUBLISHED') await this.status.refresh(id);
    await this.audit.log(userId, status === 'PUBLISHED' ? 'publish' : status.toLowerCase(), 'Task', id);
    return this.get(id);
  }

  async duplicate(userId: string, id: string) {
    const source = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: { tags: true, inputFiles: true, responses: { orderBy: { order: 'asc' } }, project: true },
    });
    const copy = await this.prisma.task.create({
      data: {
        title: `${source.title} (copy)`,
        projectId: source.projectId,
        priority: source.priority,
        instructions: source.instructions,
        userRequest: source.userRequest,
        ratersNeeded: source.ratersNeeded,
        openQueue: source.openQueue,
        sharedSheet: source.sharedSheet,
        templateVersionId: source.project.templateId,
        createdById: userId,
        tags: { create: source.tags.map((t) => ({ tagId: t.tagId })) },
        inputFiles: {
          create: source.inputFiles.map((f) => ({ name: f.name, storageKey: f.storageKey, mime: f.mime, size: f.size })),
        },
        responses: { create: source.responses.map((r) => ({ label: r.label, order: r.order })) },
      },
    });
    await this.audit.log(userId, 'duplicate', 'Task', copy.id, { from: id });
    return this.get(copy.id);
  }

  async remove(userId: string, id: string) {
    const task = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: { inputFiles: true, responses: { include: { slides: true, files: true } }, _count: { select: { submissions: true } } },
    });
    await this.prisma.task.delete({ where: { id } });
    await this.releaseKeys([
      ...task.inputFiles.map((f) => f.storageKey),
      ...task.responses.flatMap((r) => [...r.slides.flatMap((s) => [s.storageKey, s.webKey]), ...r.files.map((f) => f.storageKey)]),
    ]);
    await this.audit.log(userId, 'delete', 'Task', id, { title: task.title, submissions: task._count.submissions });
  }

  private assertPublishable(task: TaskDetailDTO) {
    if (task.responses.length < 2) throw new BadRequestException('Add at least two responses before publishing');
    const empty = task.responses.find((r) => r.slides.length === 0);
    if (empty) throw new BadRequestException(`Response ${empty.label} has no slides`);
  }

  private async assertNoSubmissions(taskId: string) {
    const count = await this.prisma.submission.count({ where: { taskId } });
    if (count > 0) throw new BadRequestException('This task already has submissions');
  }

  private async releaseKeys(keys: string[]) {
    for (const key of keys) {
      const [inputs, slides, files] = await Promise.all([
        this.prisma.inputFile.count({ where: { storageKey: key } }),
        this.prisma.slide.count({ where: { OR: [{ storageKey: key }, { webKey: key }] } }),
        this.prisma.responseFile.count({ where: { storageKey: key } }),
      ]);
      if (inputs + slides + files === 0) await this.storage.deleteObject(key).catch(() => undefined);
    }
  }
}
