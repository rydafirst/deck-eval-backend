import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { JobDTO } from '../shared';
import { describeAiError } from '../ai/ai-error';

interface Job extends JobDTO<unknown> {
  userId: string;
  key: string;
  createdAt: number;
}

const KEEP_MS = 60 * 60 * 1000;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobs = new Map<string, Job>();

  start<T>(userId: string, key: string, work: () => Promise<T>): JobDTO<T> {
    this.prune();
    const running = [...this.jobs.values()].find((j) => j.key === key && j.status === 'running');
    if (running) return this.toDTO(running) as JobDTO<T>;

    const job: Job = { id: randomUUID(), userId, key, status: 'running', result: null, error: null, createdAt: Date.now() };
    this.jobs.set(job.id, job);
    work()
      .then((result) => Object.assign(job, { status: 'done', result }))
      .catch((error: Error) => {
        this.logger.error(`${key} failed: ${error.message}`);
        Object.assign(job, { status: 'failed', error: describeAiError(error) ?? (error.message || 'Something went wrong') });
      });
    return this.toDTO(job) as JobDTO<T>;
  }

  get(id: string, userId: string): JobDTO<unknown> {
    const job = this.jobs.get(id);
    if (!job || job.userId !== userId) throw new NotFoundException('This run has expired. Try again.');
    return this.toDTO(job);
  }

  private prune() {
    const cutoff = Date.now() - KEEP_MS;
    for (const [id, job] of this.jobs) if (job.createdAt < cutoff) this.jobs.delete(id);
  }

  private toDTO({ id, status, result, error }: Job): JobDTO<unknown> {
    return { id, status, result, error };
  }
}
