import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import type { GuideDTO, GuideGroup } from '../shared';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_GUIDES: Array<{ key: string; title: string; group: GuideGroup }> = [
  { key: 'slides-qc-rationale', title: 'Slides QC rationale', group: 'qc' },
  { key: 'deck-axis-judging-criteria', title: 'What each axis checks', group: 'qc' },
  { key: 'slop-detection-taxonomy', title: 'Slop detection', group: 'qc' },
  { key: 'deck-eval-rationale-voice', title: 'Rationale voice', group: 'qc' },
  { key: 'humanise-chatgpt', title: 'ChatGPT humanise', group: 'humanise' },
  { key: 'write-like-me', title: 'Write like me', group: 'humanise' },
  { key: 'writing-sample', title: 'My writing sample', group: 'humanise' },
  { key: 'humanise-check', title: 'Humanise check', group: 'humanise' },
];

function defaultBody(key: string): string {
  return readFileSync(join(__dirname, 'defaults', `${key}.md`), 'utf8');
}

@Injectable()
export class GuidesService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onModuleInit() {
    for (const [position, guide] of DEFAULT_GUIDES.entries()) {
      await this.prisma.guide.upsert({
        where: { key: guide.key },
        create: { ...guide, position, body: defaultBody(guide.key) },
        update: { group: guide.group, position },
      });
    }
  }

  async list(group?: GuideGroup): Promise<GuideDTO[]> {
    const guides = await this.prisma.guide.findMany({ where: group ? { group } : undefined, orderBy: { position: 'asc' } });
    return guides.map((g) => ({
      key: g.key,
      title: g.title,
      group: g.group as GuideGroup,
      body: g.body,
      isDefault: g.body === defaultBody(g.key),
      updatedAt: g.updatedAt.toISOString(),
    }));
  }

  async body(key: string): Promise<string> {
    const guide = await this.prisma.guide.findUnique({ where: { key } });
    if (!guide) throw new NotFoundException(`Guide ${key} not found`);
    return guide.body;
  }

  async update(userId: string, key: string, body: string): Promise<GuideDTO> {
    await this.body(key);
    await this.prisma.guide.update({ where: { key }, data: { body, updatedById: userId } });
    await this.audit.log(userId, 'update', 'Guide', key);
    return (await this.list()).find((g) => g.key === key)!;
  }

  reset(userId: string, key: string): Promise<GuideDTO> {
    return this.update(userId, key, defaultBody(key));
  }
}
