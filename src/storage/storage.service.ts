import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { STORAGE_DRIVER, type StorageDriver } from './storage.driver';

@Injectable()
export class StorageService {
  constructor(@Inject(STORAGE_DRIVER) private readonly driver: StorageDriver) {}

  newKey(folder: string, filename: string, suffix = ''): string {
    const ext = extname(filename).toLowerCase();
    return `${folder}/${randomUUID()}${suffix}${ext}`;
  }

  putObject(key: string, body: Buffer, contentType: string) {
    return this.driver.put(key, body, contentType);
  }

  getObject(key: string) {
    return this.driver.get(key);
  }

  deleteObject(key: string) {
    return this.driver.remove(key);
  }

  getSignedUrl(key: string, filename?: string) {
    return this.driver.signedUrl(key, filename);
  }
}
