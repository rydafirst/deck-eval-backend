import { Injectable } from '@nestjs/common';
import type { FileDTO, ResponseDTO, TaskDetailDTO, TaskSummaryDTO } from '../shared';
import { StorageService } from '../storage/storage.service';
import type { TaskDetailRow, TaskSummaryRow } from './tasks.repository';

interface FileRow {
  id: string;
  name: string;
  storageKey: string;
  mime: string;
  size: number;
}

@Injectable()
export class TaskPresenter {
  constructor(private readonly storage: StorageService) {}

  summary(task: TaskSummaryRow): TaskSummaryDTO {
    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueAt: task.dueAt?.toISOString() ?? null,
      projectId: task.projectId,
      projectName: task.project.name,
      tags: task.tags.map(({ tag }) => ({ id: tag.id, name: tag.name, color: tag.color })),
      responseCount: task._count.responses,
      ratersNeeded: task.ratersNeeded,
      submissionCount: task._count.submissions,
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  async detail(task: TaskDetailRow): Promise<TaskDetailDTO> {
    const [inputFiles, responses] = await Promise.all([
      Promise.all(task.inputFiles.map((f) => this.file(f))),
      Promise.all(task.responses.map((r) => this.response(r))),
    ]);
    return {
      ...this.summary(task),
      instructions: task.instructions,
      userRequest: task.userRequest,
      templateVersionId: task.templateVersionId,
      openQueue: task.openQueue,
      sharedSheet: task.sharedSheet,
      assigneeIds: task.assignments.map((a) => a.userId),
      inputFiles,
      responses,
    };
  }

  private async response(response: TaskDetailRow['responses'][number]): Promise<ResponseDTO> {
    const slides = await Promise.all(
      response.slides.map(async (s) => ({
        id: s.id,
        order: s.order,
        caption: s.caption,
        width: s.width,
        height: s.height,
        url: await this.storage.getSignedUrl(s.webKey),
        originalUrl: await this.storage.getSignedUrl(s.storageKey),
      })),
    );
    const files = await Promise.all(response.files.map((f) => this.file(f)));
    return { id: response.id, label: response.label, order: response.order, slides, files };
  }

  private async file(file: FileRow): Promise<FileDTO> {
    return {
      id: file.id,
      name: file.name,
      mime: file.mime,
      size: file.size,
      url: await this.storage.getSignedUrl(file.storageKey, file.name),
    };
  }
}
