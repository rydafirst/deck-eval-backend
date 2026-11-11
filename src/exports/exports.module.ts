import { Module } from '@nestjs/common';
import { TemplatesModule } from '../templates/templates.module';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({ imports: [TemplatesModule], controllers: [ExportsController], providers: [ExportsService] })
export class ExportsModule {}
