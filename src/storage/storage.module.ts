import { Global, Module } from '@nestjs/common';
import { config } from '../config';
import { FilesController } from './files.controller';
import { LocalStorageDriver } from './local.driver';
import { S3StorageDriver } from './s3.driver';
import { STORAGE_DRIVER } from './storage.driver';
import { StorageService } from './storage.service';

@Global()
@Module({
  controllers: config.storage.driver === 'local' ? [FilesController] : [],
  providers: [
    { provide: STORAGE_DRIVER, useFactory: () => (config.storage.driver === 's3' ? new S3StorageDriver() : new LocalStorageDriver()) },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
