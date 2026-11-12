import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';
import { config } from '../config';
import { StorageService } from '../storage/storage.service';

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
const DOC_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/csv',
  'text/plain',
];

export interface StoredImage {
  name: string;
  storageKey: string;
  webKey: string;
  width: number;
  height: number;
}

export interface StoredFile {
  name: string;
  storageKey: string;
  mime: string;
  size: number;
}

@Injectable()
export class UploadsService {
  constructor(private readonly storage: StorageService) {}

  isImage(file: Express.Multer.File) {
    return IMAGE_TYPES.includes(file.mimetype);
  }

  async storeImage(folder: string, file: Express.Multer.File): Promise<StoredImage> {
    if (!this.isImage(file)) throw new BadRequestException(`${file.originalname} is not a supported image`);
    if (file.size > config.limits.imageBytes) throw new BadRequestException(`${file.originalname} is larger than 15MB`);
    return this.storeImageBuffer(folder, file.originalname, file.buffer, file.mimetype);
  }

  async storeImageBuffer(folder: string, name: string, buffer: Buffer, mime: string): Promise<StoredImage> {
    const image = sharp(buffer, { animated: false });
    const meta = await image.metadata();
    const web = await image
      .rotate()
      .resize({ width: config.limits.webImageWidth, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();

    const storageKey = this.storage.newKey(folder, name);
    const webKey = this.storage.newKey(folder, 'web.webp', '-web');
    await Promise.all([this.storage.putObject(storageKey, buffer, mime), this.storage.putObject(webKey, web, 'image/webp')]);
    return { name, storageKey, webKey, width: meta.width ?? 0, height: meta.height ?? 0 };
  }

  async storeFile(folder: string, file: Express.Multer.File): Promise<StoredFile> {
    const allowed = this.isImage(file) || DOC_TYPES.includes(file.mimetype);
    if (!allowed) throw new BadRequestException(`${file.originalname} is not a supported file type`);
    const limit = this.isImage(file) ? config.limits.imageBytes : config.limits.docBytes;
    if (file.size > limit) throw new BadRequestException(`${file.originalname} is too large`);

    const storageKey = this.storage.newKey(folder, file.originalname);
    await this.storage.putObject(storageKey, file.buffer, file.mimetype);
    return { name: file.originalname, storageKey, mime: file.mimetype, size: file.size };
  }
}
