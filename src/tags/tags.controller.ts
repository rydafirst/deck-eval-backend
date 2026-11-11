import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser, TagDTO } from '../shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

const tagSchema = z.object({ name: z.string().trim().min(1).max(40), color: z.string().regex(/^#[0-9a-fA-F]{6}$/) });
type TagInput = z.infer<typeof tagSchema>;

@Controller('tags')
export class TagsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(): Promise<TagDTO[]> {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  @Roles('ADMIN')
  @Post()
  async create(@CurrentUser() user: SessionUser, @Body(new ZodPipe(tagSchema)) body: TagInput) {
    const tag = await this.prisma.tag.upsert({ where: { name: body.name }, create: body, update: {} });
    await this.audit.log(user.id, 'create', 'Tag', tag.id);
    return tag;
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(tagSchema)) body: TagInput) {
    const tag = await this.prisma.tag.update({ where: { id }, data: body });
    await this.audit.log(user.id, 'update', 'Tag', id);
    return tag;
  }

  @Roles('ADMIN')
  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: SessionUser, @Param('id') id: string) {
    await this.prisma.tag.delete({ where: { id } });
    await this.audit.log(user.id, 'delete', 'Tag', id);
  }
}
