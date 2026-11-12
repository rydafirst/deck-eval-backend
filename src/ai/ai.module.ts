import { Module } from '@nestjs/common';
import { ClaudeClient } from './claude-client';
import { OpenAiClient } from './openai-client';

@Module({ providers: [ClaudeClient, OpenAiClient], exports: [ClaudeClient, OpenAiClient] })
export class AiModule {}
