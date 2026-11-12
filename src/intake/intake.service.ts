import { BadRequestException, Injectable } from '@nestjs/common';
import { responseLabel, responseLabelsIn, type TaskDraft } from '../shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from '../tasks/tasks.service';
import { IntakeFilesService, type IntakeManifest } from './intake-files.service';

interface ResponseGroup {
  slides: IntakeManifest[];
  combined: IntakeManifest[];
}

const TAG_COLOURS = ['#4176C5', '#EC905D', '#C4597C', '#8FD1DC', '#F3B2AF', '#DCE88C', '#8DD0FB', '#F8E87D'];

@Injectable()
export class IntakeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tasks: TasksService,
    private readonly files: IntakeFilesService,
    private readonly audit: AuditService,
  ) {}

  async createTask(userId: string, draft: TaskDraft, viaAi: boolean): Promise<{ taskId: string }> {
    const used = draft.files.filter((f) => f.role !== 'ignore');
    const manifests = new Map((await this.files.manifests(used.map((f) => f.fileId))).map((m) => [m.id, m]));
    for (const manifest of manifests.values()) {
      if (manifest.status !== 'ready') throw new BadRequestException(`${manifest.name} is still processing or failed`);
    }
    const responseGroups = this.groupResponses(draft, manifests);

    const task = await this.tasks.create(userId, {
      title: draft.title,
      projectId: draft.projectId,
      priority: draft.priority,
      tagIds: await this.tagIds(draft.tagNames),
      dueAt: draft.dueAt ? new Date(`${draft.dueAt}T23:59:00Z`).toISOString() : null,
      ratersNeeded: draft.ratersNeeded,
    });
    await this.tasks.updateBrief(userId, task.id, { instructions: draft.instructionsHtml, userRequest: draft.userRequestHtml });

    const inputs = used.filter((f) => f.role === 'input').map((f) => manifests.get(f.fileId)!);
    if (inputs.length) {
      await this.prisma.inputFile.createMany({
        data: inputs.map((m) => ({ taskId: task.id, name: m.name, storageKey: m.originalKey, mime: m.mime, size: m.size })),
      });
    }

    for (const [order, group] of responseGroups.entries()) {
      const response = await this.prisma.response.create({ data: { taskId: task.id, label: responseLabel(order), order } });
      const pages = group.slides.flatMap((m) => m.pages);
      await this.prisma.slide.createMany({
        data: pages.map((page, index) => ({
          responseId: response.id,
          order: index,
          storageKey: page.storageKey,
          webKey: page.webKey,
          width: page.width,
          height: page.height,
        })),
      });
      const decks = [...group.slides.filter((m) => m.kind !== 'image'), ...group.combined];
      if (decks.length) {
        await this.prisma.responseFile.createMany({
          data: decks.map((m) => ({ responseId: response.id, name: m.name, storageKey: m.originalKey, mime: m.mime, size: m.size })),
        });
      }
    }

    await this.audit.log(userId, 'create', 'Task', task.id, { via: viaAi ? 'ai_intake' : 'smart_import', files: used.length });
    return { taskId: task.id };
  }

  private groupResponses(draft: TaskDraft, manifests: Map<string, IntakeManifest>): ResponseGroup[] {
    const groups = responseLabelsIn(draft.files).map((label) => ({
      slides: draft.files.filter((f) => f.role === 'response' && f.label === label).map((f) => manifests.get(f.fileId)!),
      combined: draft.files.filter((f) => f.role === 'combined' && f.labels?.includes(label)).map((f) => manifests.get(f.fileId)!),
    }));

    for (const manifest of groups.flatMap((g) => g.slides)) {
      if (manifest.pages.length === 0) throw new BadRequestException(`${manifest.name} has no slides, so it can't be a response`);
    }
    return groups;
  }


  private async tagIds(names: string[]): Promise<string[]> {
    const ids: string[] = [];
    for (const name of [...new Set(names.map((n) => n.trim()).filter(Boolean))]) {
      const existing = await this.prisma.tag.findFirst({ where: { name: { equals: name, mode: 'insensitive' } } });
      if (existing) {
        ids.push(existing.id);
        continue;
      }
      const count = await this.prisma.tag.count();
      const created = await this.prisma.tag.create({ data: { name, color: TAG_COLOURS[count % TAG_COLOURS.length] } });
      ids.push(created.id);
    }
    return ids;
  }
}
