import { Module } from '@nestjs/common';
import { DocumentConverter } from './document-converter';

@Module({ providers: [DocumentConverter], exports: [DocumentConverter] })
export class DocumentsModule {}
