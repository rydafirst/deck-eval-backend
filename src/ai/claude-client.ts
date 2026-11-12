import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config';

const TEXT_MAX_TOKENS = 8000;

@Injectable()
export class ClaudeClient {
  private readonly client = config.anthropic.apiKey
    ? new Anthropic({ apiKey: config.anthropic.apiKey, baseURL: config.anthropic.baseUrl, timeout: 10 * 60 * 1000 })
    : null;

  get enabled(): boolean {
    return this.client !== null;
  }

  require(unavailableMessage = 'Claude is not set up yet. Add ANTHROPIC_API_KEY to the API server.'): Anthropic {
    if (!this.client) throw new ServiceUnavailableException(unavailableMessage);
    return this.client;
  }

  async complete(system: string, prompt: string): Promise<string> {
    const message = await this.require().messages.create({
      model: config.anthropic.model,
      max_tokens: TEXT_MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }],
    });
    return message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('')
      .trim();
  }
}
