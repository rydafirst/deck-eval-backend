import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { describeAiError } from './ai-error';
import { ClaudeClient } from './claude-client';
import { OpenAiClient } from './openai-client';

export type AiProvider = 'claude' | 'chatgpt';

export interface TextReply {
  text: string;
  provider: AiProvider;
}

const NAMES: Record<AiProvider, string> = { claude: 'Claude', chatgpt: 'ChatGPT' };
const RETRY_AFTER_MS = 10 * 60 * 1000;

function canSwitch(error: unknown): boolean {
  if (!(error instanceof Anthropic.APIError) && !(error instanceof OpenAI.APIError)) return false;
  const status = error.status;
  if (status === undefined || status === 401 || status === 402 || status === 403 || status === 404 || status === 429 || status >= 500) return true;
  return /credit|billing|quota|balance/i.test(error.message);
}

@Injectable()
export class TextAi {
  private readonly down = new Map<AiProvider, { until: number; reason: string }>();

  constructor(
    private readonly claude: ClaudeClient,
    private readonly openai: OpenAiClient,
  ) {}

  require() {
    if (!this.claude.enabled && !this.openai.enabled) {
      throw new ServiceUnavailableException('AI is not set up yet. Add ANTHROPIC_API_KEY or OPENAI_API_KEY to the API server.');
    }
  }

  name(provider: AiProvider): string {
    return NAMES[provider];
  }

  unavailableReason(provider: AiProvider): string | null {
    const entry = this.down.get(provider);
    return entry && entry.until > Date.now() ? entry.reason : null;
  }

  async complete(preferred: AiProvider, system: string, prompt: string): Promise<TextReply> {
    this.require();
    let lastError: unknown = null;
    for (const provider of this.order(preferred)) {
      try {
        const text = provider === 'claude' ? await this.claude.complete(system, prompt) : await this.openai.complete(system, prompt);
        this.down.delete(provider);
        return { text, provider };
      } catch (error) {
        if (!canSwitch(error)) throw error;
        this.down.set(provider, { until: Date.now() + RETRY_AFTER_MS, reason: describeAiError(error) ?? `${NAMES[provider]} failed.` });
        lastError = error;
      }
    }
    throw lastError;
  }

  private order(preferred: AiProvider): AiProvider[] {
    const other: AiProvider = preferred === 'claude' ? 'chatgpt' : 'claude';
    const enabled = [preferred, other].filter((p) => (p === 'claude' ? this.claude.enabled : this.openai.enabled));
    return [...enabled.filter((p) => !this.unavailableReason(p)), ...enabled.filter((p) => this.unavailableReason(p))];
  }
}
