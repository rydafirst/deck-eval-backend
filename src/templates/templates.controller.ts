import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';
import type { SessionUser } from '../shared';
import { CurrentUser, Roles } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { templateInputSchema, type TemplateInput } from './template.schema';
import { TemplatesService } from './templates.service';

@Roles('ADMIN')
@Controller('admin/templates')
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.templates.get(id);
  }

  @Post()
  create(@CurrentUser() user: SessionUser, @Body(new ZodPipe(templateInputSchema)) body: TemplateInput) {
    return this.templates.create(user.id, body);
  }

  @Put(':id')
  update(@CurrentUser() user: SessionUser, @Param('id') id: string, @Body(new ZodPipe(templateInputSchema)) body: TemplateInput) {
    return this.templates.update(user.id, id, body);
  }
}
