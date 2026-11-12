import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import OpenAI from 'openai';
import { config } from '../config';

@Injectable()
export class OpenAiClient {
  private readonly client = config.openai.apiKey
    ? new OpenAI({ apiKey: config.openai.apiKey, baseURL: config.openai.baseUrl, timeout: 5 * 60 * 1000 })
    : null;

  get enabled(): boolean {
    return this.client !== null;
  }

  require(): OpenAI {
    if (!this.client) throw new ServiceUnavailableException('ChatGPT is not set up yet. Add OPENAI_API_KEY to the API server.');
    return this.client;
  }

  async complete(instructions: string, prompt: string): Promise<string> {
    const response = await this.require().responses.create({ model: config.openai.model, instructions, input: prompt });
    return response.output_text.trim();
  }
}
