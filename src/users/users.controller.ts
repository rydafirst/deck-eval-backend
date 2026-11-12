import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser, SubStatus, UserDetailDTO, UserDTO } from '../shared';
import { AuditService } from '../audit/audit.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';

const roleSchema = z.enum(['ADMIN', 'REVIEWER', 'RATER']);
const inviteSchema = z.object({ email: z.email(), name: z.string().trim().optional(), role: roleSchema });
const updateSchema = z.object({
  name: z.string().trim().optional(),
  role: roleSchema.optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

const userSelect = { id: true, email: true, name: true, role: true, active: true, createdAt: true } as const;

@Roles('ADMIN')
@Controller('admin/users')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async list(): Promise<UserDTO[]> {
    const users = await this.prisma.user.findMany({ select: userSelect, orderBy: { createdAt: 'asc' } });
    return users.map((u) => ({ ...u, createdAt: u.createdAt.toISOString() }));
  }

  @Get(':id')
  async detail(@Param('id') id: string): Promise<UserDetailDTO> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!user) throw new NotFoundException('User not found');

    const submissions = await this.prisma.submission.findMany({
      where: { task: { assignments: { some: { userId: id, claimedAt: { not: null } } } } },
      include: { task: { select: { title: true, priority: true, project: { select: { name: true } } } } },
      orderBy: { updatedAt: 'desc' },
    });

    const counts: Record<SubStatus, number> = { DRAFT: 0, SUBMITTED: 0, RETURNED: 0, APPROVED: 0 };
    submissions.forEach((s) => (counts[s.status] += 1));

    return {
      user: { ...user, createdAt: user.createdAt.toISOString() },
      counts,
      totalActiveSeconds: submissions.reduce((sum, s) => sum + s.activeSeconds, 0),
      tasks: submissions.map((s) => ({
        submissionId: s.id,
        taskId: s.taskId,
        taskTitle: s.task.title,
        projectName: s.task.project.name,
        priority: s.task.priority,
        status: s.status,
        submittedAt: s.submittedAt?.toISOString() ?? null,
        updatedAt: s.updatedAt.toISOString(),
        activeSeconds: s.activeSeconds,
      })),
    };
  }

  @Post()
  async invite(@CurrentUser() admin: SessionUser, @Body(new ZodPipe(inviteSchema)) body: z.infer<typeof inviteSchema>) {
    const email = body.email.toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name: body.name || null, role: body.role },
      update: { role: body.role, active: true },
      select: userSelect,
    });
    await this.auth.sendMagicLink(email, true);
    await this.audit.log(admin.id, 'invite', 'User', user.id, { role: body.role });
    return user;
  }

  @Patch(':id')
  async update(
    @CurrentUser() admin: SessionUser,
    @Param('id') id: string,
    @Body(new ZodPipe(updateSchema)) body: z.infer<typeof updateSchema>,
  ) {
    const { password, ...rest } = body;
    const passwordHash = password ? await this.auth.hashPassword(password) : undefined;
    const user = await this.prisma.user.update({ where: { id }, data: { ...rest, passwordHash }, select: userSelect });
    await this.audit.log(admin.id, 'update', 'User', id, { ...rest, passwordChanged: Boolean(password) });
    return user;
  }
}
