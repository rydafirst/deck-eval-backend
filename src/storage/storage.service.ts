import { Inject, Injectable, NotFoundException } from '@nestjs/common';
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

  async getObject(key: string): Promise<Buffer> {
    try {
      return await this.driver.get(key);
    } catch (error) {
      const missing = (error as { name?: string; code?: string }).name === 'NoSuchKey' || (error as { code?: string }).code === 'ENOENT';
      if (missing) throw new NotFoundException('A stored file is missing. It was probably uploaded before file storage was set up. Upload it again.');
      throw error;
    }
  }

  deleteObject(key: string) {
    return this.driver.remove(key);
  }

  getSignedUrl(key: string, filename?: string) {
    return this.driver.signedUrl(key, filename);
  }
}
