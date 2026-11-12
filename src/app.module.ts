import { Module } from '@nestjs/common';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BootstrapModule } from './bootstrap/bootstrap.module';
import { ExportsModule } from './exports/exports.module';
import { HealthController } from './health.controller';
import { GuidesModule } from './guides/guides.module';
import { HumaniseModule } from './humanise/humanise.module';
import { IntakeModule } from './intake/intake.module';
import { JobsModule } from './jobs/jobs.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProjectsModule } from './projects/projects.module';
import { QcModule } from './qc/qc.module';
import { QueueModule } from './queue/queue.module';
import { ReviewsModule } from './reviews/reviews.module';
import { StatsModule } from './stats/stats.module';
import { StorageModule } from './storage/storage.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TagsModule } from './tags/tags.module';
import { TasksModule } from './tasks/tasks.module';
import { TemplatesModule } from './templates/templates.module';
import { UploadsModule } from './uploads/uploads.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    StorageModule,
    UploadsModule,
    AuthModule,
    UsersModule,
    TagsModule,
    TemplatesModule,
    ProjectsModule,
    TasksModule,
    SubmissionsModule,
    QueueModule,
    ReviewsModule,
    ExportsModule,
    StatsModule,
    BootstrapModule,
    IntakeModule,
    QcModule,
    GuidesModule,
    JobsModule,
    HumaniseModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
