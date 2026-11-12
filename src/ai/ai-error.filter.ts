import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import type { Response } from 'express';
import { describeAiError } from './ai-error';

@Catch(Anthropic.APIError, OpenAI.APIError)
export class AiErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(AiErrorFilter.name);

  catch(error: Error, host: ArgumentsHost) {
    this.logger.error(`AI request failed: ${error.message}`);
    const message = describeAiError(error) ?? 'The AI request failed. Try again.';
    host.switchToHttp().getResponse<Response>().status(HttpStatus.BAD_GATEWAY).json({ statusCode: HttpStatus.BAD_GATEWAY, message });
  }
}
