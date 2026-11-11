export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  remove(key: string): Promise<void>;
  signedUrl(key: string, filename?: string): Promise<string>;
}

export const STORAGE_DRIVER = Symbol('STORAGE_DRIVER');
