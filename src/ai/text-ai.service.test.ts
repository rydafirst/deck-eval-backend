import { describe, expect, it, vi } from 'vitest';
import OpenAI from 'openai';
import { TextAi } from './text-ai.service';
import type { ClaudeClient } from './claude-client';
import type { OpenAiClient } from './openai-client';

const quotaError = () => new OpenAI.APIError(429, { error: { message: 'You exceeded your current quota' } }, 'You exceeded your current quota', new Headers());

function setup(openaiComplete: () => Promise<string>) {
  const claude = { enabled: true, complete: vi.fn(async () => 'from claude') } as unknown as ClaudeClient;
  const openai = { enabled: true, complete: vi.fn(openaiComplete) } as unknown as OpenAiClient;
  return { ai: new TextAi(claude, openai), claude, openai };
}

describe('TextAi', () => {
  it('uses the preferred AI when it works', async () => {
    const { ai } = setup(async () => 'from chatgpt');
    expect(await ai.complete('chatgpt', 's', 'p')).toEqual({ text: 'from chatgpt', provider: 'chatgpt' });
  });

  it('switches to the other AI when the preferred one is out of credit, and skips it next time', async () => {
    const { ai, openai } = setup(async () => {
      throw quotaError();
    });
    expect(await ai.complete('chatgpt', 's', 'p')).toEqual({ text: 'from claude', provider: 'claude' });
    expect(ai.unavailableReason('chatgpt')).toMatch(/ChatGPT/);
    await ai.complete('chatgpt', 's', 'p');
    expect(openai.complete).toHaveBeenCalledTimes(1);
  });

  it('does not switch on ordinary errors', async () => {
    const { ai } = setup(async () => {
      throw new Error('bad input');
    });
    await expect(ai.complete('chatgpt', 's', 'p')).rejects.toThrow('bad input');
  });
});
