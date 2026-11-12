import { Module } from '@nestjs/common';
import { ClaudeClient } from './claude-client';
import { OpenAiClient } from './openai-client';
import { TextAi } from './text-ai.service';

@Module({ providers: [ClaudeClient, OpenAiClient, TextAi], exports: [ClaudeClient, OpenAiClient, TextAi] })
export class AiModule {}
