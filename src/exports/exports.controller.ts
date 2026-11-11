import { Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import type { SessionUser, SubStatus } from '../shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles } from '../common/decorators';
import { ExportsService } from './exports.service';

@Roles('ADMIN')
@Controller('admin/exports')
export class ExportsController {
  constructor(
    private readonly exports: ExportsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  async export(
    @CurrentUser() user: SessionUser,
    @Res() res: Response,
    @Query('format') format: 'csv' | 'json' = 'csv',
    @Query('projectId') projectId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: SubStatus,
  ) {
    const stamp = new Date().toISOString().slice(0, 10);
    const filters = { projectId, from, to, status: status || undefined };
    await this.audit.log(user.id, 'export', 'Submission', 'all', { format, ...filters });
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="deck-eval-${stamp}.json"`);
      await this.exports.writeJson(filters, res);
    } else {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="deck-eval-${stamp}.csv"`);
      await this.exports.writeCsv(filters, res);
    }
    res.end();
  }
}
