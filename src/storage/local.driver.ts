import { createHmac, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve } from 'node:path';
import { config } from '../config';
import type { StorageDriver } from './storage.driver';

export class LocalStorageDriver implements StorageDriver {
  private readonly root = resolve(config.storage.localDir);

  private pathFor(key: string): string {
    const full = normalize(join(this.root, key));
    if (!full.startsWith(this.root)) throw new Error('Invalid storage key');
    return full;
  }

  async put(key: string, body: Buffer): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, body);
  }

  get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async signedUrl(key: string, filename?: string): Promise<string> {
    const expires = Math.floor(Date.now() / 1000) + config.storage.signedUrlSeconds;
    const params = new URLSearchParams({ key, exp: String(expires), sig: LocalStorageDriver.sign(key, expires) });
    if (filename) params.set('name', filename);
    return `${config.storage.filesBaseUrl}?${params.toString()}`;
  }

  static sign(key: string, expires: number): string {
    return createHmac('sha256', config.authSecret).update(`${key}:${expires}`).digest('hex');
  }

  static verify(key: string, expires: number, signature: string): boolean {
    if (expires < Date.now() / 1000) return false;
    const expected = Buffer.from(LocalStorageDriver.sign(key, expires));
    const given = Buffer.from(signature);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}
