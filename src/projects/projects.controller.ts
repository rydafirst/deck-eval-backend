import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import type { ProjectDTO, SessionUser } from '../shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

const projectSchema = z.object({ name: z.string().min(1), templateId: z.string().min(1) });
type ProjectInput = z.infer<typeof projectSchema>;

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  @Roles('ADMIN', 'REVIEWER')
  @Get()
  async list(): Promise<ProjectDTO[]> {
    const projects = await this.prisma.project.findMany({
      include: { template: true, _count: { select: { tasks: true } } },
      orderBy: { name: 'asc' },
    });
    return projects.map((p) => ({
      id: p.id,
      name: p.name,
      templateId: p.templateId,
      templateName: p.template.name,
      templateVersion: p.template.version,
      taskCount: p._count.tasks,
    }));
  }

  @Roles('ADMIN')
  @Post()
  async create(@CurrentUser() user: SessionUser, @Body(new ZodPipe(projectSchema)) body: ProjectInput) {
    const project = await this.prisma.project.create({ data: body });
    await this.audit.log(user.id, 'create', 'Project', project.id);
    return project;
  }

  @Roles('ADMIN')
  @Patch(':id')
  async update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(projectSchema)) body: ProjectInput) {
    const project = await this.prisma.project.update({ where: { id }, data: body });
    await this.audit.log(user.id, 'update', 'Project', id);
    return project;
  }
}
