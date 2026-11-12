import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { IntakeFileDTO, IntakeFileKind, IntakeFileStatus } from '../shared';
import { config } from '../config';
import { StorageService } from '../storage/storage.service';
import { UploadsService, type StoredImage } from '../uploads/uploads.service';
import { DocumentConverter } from '../documents/document-converter';

const FILE_TYPES: Record<string, { kind: IntakeFileKind; mime: string }> = {
  '.pdf': { kind: 'pdf', mime: 'application/pdf' },
  '.pptx': { kind: 'presentation', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' },
  '.ppt': { kind: 'presentation', mime: 'application/vnd.ms-powerpoint' },
  '.key': { kind: 'presentation', mime: 'application/vnd.apple.keynote' },
  '.odp': { kind: 'presentation', mime: 'application/vnd.oasis.opendocument.presentation' },
  '.png': { kind: 'image', mime: 'image/png' },
  '.jpg': { kind: 'image', mime: 'image/jpeg' },
  '.jpeg': { kind: 'image', mime: 'image/jpeg' },
  '.webp': { kind: 'image', mime: 'image/webp' },
  '.gif': { kind: 'image', mime: 'image/gif' },
  '.docx': { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  '.doc': { kind: 'document', mime: 'application/msword' },
  '.xlsx': { kind: 'document', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  '.xls': { kind: 'document', mime: 'application/vnd.ms-excel' },
  '.csv': { kind: 'document', mime: 'text/csv' },
  '.txt': { kind: 'document', mime: 'text/plain' },
  '.md': { kind: 'document', mime: 'text/markdown' },
};

const PLAIN_TEXT = ['.csv', '.txt', '.md'];
const MAX_TEXT_CHARS = 15_000;
const STALE_AFTER_MS = 15 * 60_000;

export interface IntakeManifest {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: IntakeFileKind;
  status: IntakeFileStatus;
  error: string | null;
  originalKey: string;
  pages: StoredImage[];
  text: string;
  createdAt: string;
}

const manifestKey = (id: string) => `intake/${id}/manifest.json`;

@Injectable()
export class IntakeFilesService {
  private readonly logger = new Logger(IntakeFilesService.name);

  constructor(
    private readonly storage: StorageService,
    private readonly uploads: UploadsService,
    private readonly converter: DocumentConverter,
  ) {}

  async upload(file: Express.Multer.File): Promise<IntakeFileDTO> {
    const extension = extname(file.originalname).toLowerCase();
    const type = FILE_TYPES[extension];
    if (!type) throw new BadRequestException(`${file.originalname}: this file type isn't supported`);
    if (file.size > config.limits.intakeBytes) throw new BadRequestException(`${file.originalname} is larger than 80MB`);

    const id = randomUUID();
    const manifest: IntakeManifest = {
      id,
      name: file.originalname,
      mime: type.mime,
      size: file.size,
      kind: type.kind,
      status: 'processing',
      error: null,
      originalKey: `intake/${id}/original${extension}`,
      pages: [],
      text: '',
      createdAt: new Date().toISOString(),
    };
    await this.storage.putObject(manifest.originalKey, file.buffer, type.mime);
    await this.save(manifest);
    void this.process(manifest, file.buffer, extension);
    return this.toDTO(manifest);
  }

  async manifest(id: string): Promise<IntakeManifest> {
    let manifest: IntakeManifest;
    try {
      manifest = JSON.parse((await this.storage.getObject(manifestKey(id))).toString('utf8'));
    } catch {
      throw new NotFoundException('File not found');
    }
    if (manifest.status === 'processing' && Date.now() - Date.parse(manifest.createdAt) > STALE_AFTER_MS) {
      return { ...manifest, status: 'failed', error: 'Processing did not finish. Upload the file again.' };
    }
    return manifest;
  }

  async manifests(ids: string[]): Promise<IntakeManifest[]> {
    return Promise.all(ids.map((id) => this.manifest(id)));
  }

  async existing(ids: string[]): Promise<IntakeManifest[]> {
    const found = await Promise.all(ids.map((id) => this.manifest(id).catch(() => null)));
    return found.filter((m): m is IntakeManifest => m !== null);
  }

  async toDTO(manifest: IntakeManifest): Promise<IntakeFileDTO> {
    const first = manifest.pages[0];
    return {
      id: manifest.id,
      name: manifest.name,
      mime: manifest.mime,
      size: manifest.size,
      kind: manifest.kind,
      status: manifest.status,
      error: manifest.error,
      pageCount: manifest.pages.length,
      thumbnailUrl: first ? await this.storage.getSignedUrl(first.webKey) : null,
    };
  }

  private async process(manifest: IntakeManifest, buffer: Buffer, extension: string) {
    try {
      const result = await this.extract(manifest, buffer, extension);
      await this.save({ ...manifest, ...result, status: 'ready' });
    } catch (error) {
      this.logger.error(`Could not process ${manifest.name}`, error as Error);
      await this.save({ ...manifest, status: 'failed', error: this.describe(manifest.kind) });
    }
  }

  private async extract(manifest: IntakeManifest, buffer: Buffer, extension: string): Promise<Pick<IntakeManifest, 'pages' | 'text'>> {
    const folder = `intake/${manifest.id}/pages`;
    if (manifest.kind === 'image') {
      return { pages: [await this.uploads.storeImageBuffer(folder, manifest.name, buffer, manifest.mime)], text: '' };
    }
    if (manifest.kind === 'document') {
      const text = PLAIN_TEXT.includes(extension)
        ? buffer.toString('utf8')
        : await this.converter.pdfText(await this.converter.toPdf(buffer, extension.slice(1)));
      return { pages: [], text: text.slice(0, MAX_TEXT_CHARS) };
    }
    const pdf = manifest.kind === 'presentation' ? await this.converter.toPdf(buffer, extension.slice(1)) : buffer;
    const [pngs, text] = await Promise.all([this.converter.pdfToPngs(pdf), this.converter.pdfText(pdf)]);
    const pages: StoredImage[] = [];
    for (const [index, png] of pngs.entries()) {
      pages.push(await this.uploads.storeImageBuffer(folder, `page-${index + 1}.png`, png, 'image/png'));
    }
    return { pages, text: text.slice(0, MAX_TEXT_CHARS) };
  }

  private describe(kind: IntakeFileKind) {
    if (kind === 'presentation') return 'Could not convert this presentation. Try exporting it as PDF.';
    if (kind === 'pdf') return 'Could not read this PDF.';
    if (kind === 'image') return 'Could not read this image.';
    return 'Could not read this document.';
  }

  private save(manifest: IntakeManifest) {
    return this.storage.putObject(manifestKey(manifest.id), Buffer.from(JSON.stringify(manifest)), 'application/json');
  }
}
