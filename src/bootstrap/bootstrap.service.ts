import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AuthService } from '../auth/auth.service';
import { toJson } from '../common/json';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { DEFAULT_PROJECT_NAME, DEFAULT_RUBRIC, DEFAULT_RUBRIC_NAME } from './default-rubric';

@Injectable()
export class BootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  async onApplicationBootstrap() {
    await this.ensureAdmin();
    await this.ensureDefaultProject();
  }

  private async ensureAdmin() {
    const { email, password } = config.bootstrapAdmin;
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (!existing) {
      await this.prisma.user.create({
        data: { email, name: 'Admin', role: 'ADMIN', passwordHash: await this.auth.hashPassword(password) },
      });
      this.logger.log(`Created admin account ${email}`);
      return;
    }
    if (existing.role !== 'ADMIN' || !existing.active) {
      await this.prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN', active: true } });
      this.logger.log(`Made ${email} an admin`);
    }
  }

  private async ensureDefaultProject() {
    if ((await this.prisma.project.count()) > 0) return;

    const template =
      (await this.prisma.rubricTemplate.findFirst({ orderBy: { createdAt: 'asc' } })) ??
      (await this.prisma.rubricTemplate.create({
        data: {
          name: DEFAULT_RUBRIC_NAME,
          fields: { create: DEFAULT_RUBRIC.map((field, order) => ({ ...field, order, config: toJson(field.config) })) },
        },
      }));
    await this.prisma.project.create({ data: { name: DEFAULT_PROJECT_NAME, templateId: template.id } });
    this.logger.log(`Created the "${DEFAULT_PROJECT_NAME}" project with the default rubric`);
  }
}
