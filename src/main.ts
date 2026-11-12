import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import type { NextFunction, Request, Response } from 'express';
import { AiErrorFilter } from './ai/ai-error.filter';
import { AppModule } from './app.module';
import { config } from './config';

function noStore(req: Request, res: Response, next: NextFunction) {
  if (!req.path.startsWith('/files')) res.setHeader('Cache-Control', 'no-store');
  next();
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(cookieParser());
  app.use(noStore);
  app.useGlobalFilters(new AiErrorFilter());
  app.enableCors({ origin: config.webUrl, credentials: true });
  app.enableShutdownHooks();
  await app.listen(config.port);
}

void bootstrap();
