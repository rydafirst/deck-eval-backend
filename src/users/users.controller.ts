import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { z } from 'zod';
import type { SessionUser, UserDTO } from '../shared';
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
