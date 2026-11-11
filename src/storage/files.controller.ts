import { Controller, ForbiddenException, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { lookup } from './mime';
import { Public } from '../common/decorators';
import { LocalStorageDriver } from './local.driver';
import { StorageService } from './storage.service';

@Controller('files')
export class FilesController {
  constructor(private readonly storage: StorageService) {}

  @Public()
  @Get()
  async serve(
    @Query('key') key: string,
    @Query('exp') exp: string,
    @Query('sig') sig: string,
    @Query('name') name: string | undefined,
    @Res() res: Response,
  ) {
    if (!key || !LocalStorageDriver.verify(key, Number(exp), sig ?? '')) throw new ForbiddenException('Link expired');
    const body = await this.storage.getObject(key);
    res.setHeader('Content-Type', lookup(key));
    res.setHeader('Cache-Control', 'private, max-age=3600');
    if (name) res.setHeader('Content-Disposition', `attachment; filename="${name.replace(/"/g, '')}"`);
    res.send(body);
  }
}
