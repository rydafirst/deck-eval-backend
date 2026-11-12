import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { naturalCompare } from '../shared';

const run = promisify(execFile);
const OFFICE_TIMEOUT_MS = 180_000;
const SLIDE_WIDTH_PX = '2000';

async function withTempDir<T>(work: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'deck-eval-'));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

@Injectable()
export class DocumentConverter {
  private officeQueue: Promise<unknown> = Promise.resolve();

  toPdf(buffer: Buffer, extension: string): Promise<Buffer> {
    const job = this.officeQueue.then(() =>
      withTempDir(async (dir) => {
        const input = join(dir, `source.${extension}`);
        await writeFile(input, buffer);
        await run(
          'soffice',
          [`-env:UserInstallation=file://${join(dir, 'profile')}`, '--headless', '--convert-to', 'pdf', '--outdir', dir, input],
          { timeout: OFFICE_TIMEOUT_MS },
        );
        return readFile(join(dir, 'source.pdf'));
      }),
    );
    this.officeQueue = job.catch(() => undefined);
    return job;
  }

  pdfToPngs(pdf: Buffer): Promise<Buffer[]> {
    return withTempDir(async (dir) => {
      const input = join(dir, 'source.pdf');
      await writeFile(input, pdf);
      await run('pdftoppm', ['-png', '-scale-to', SLIDE_WIDTH_PX, input, join(dir, 'page')], { timeout: OFFICE_TIMEOUT_MS });
      const pages = (await readdir(dir)).filter((name) => name.startsWith('page') && name.endsWith('.png')).sort(naturalCompare);
      return Promise.all(pages.map((name) => readFile(join(dir, name))));
    });
  }

  pdfText(pdf: Buffer): Promise<string> {
    return withTempDir(async (dir) => {
      const input = join(dir, 'source.pdf');
      await writeFile(input, pdf);
      const { stdout } = await run('pdftotext', ['-layout', input, '-'], { maxBuffer: 50 * 1024 * 1024 });
      return stdout;
    });
  }
}
