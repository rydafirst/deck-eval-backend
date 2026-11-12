import { Global, Module } from '@nestjs/common';
import { TaskPresenter } from './task.presenter';
import { TaskStatusService } from './task-status.service';
import { TasksController } from './tasks.controller';
import { TasksRepository } from './tasks.repository';
import { TasksService } from './tasks.service';

@Global()
@Module({
  controllers: [TasksController],
  providers: [TasksRepository, TaskPresenter, TaskStatusService, TasksService],
  exports: [TasksRepository, TaskPresenter, TaskStatusService, TasksService],
})
export class TasksModule {}
