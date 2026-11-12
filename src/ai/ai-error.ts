import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

interface Provider {
  name: string;
  keyVar: string;
  modelVar: string;
}

const CLAUDE: Provider = { name: 'Claude', keyVar: 'ANTHROPIC_API_KEY', modelVar: 'ANTHROPIC_MODEL' };
const CHATGPT: Provider = { name: 'ChatGPT', keyVar: 'OPENAI_API_KEY', modelVar: 'OPENAI_MODEL' };

const SECRET = /\b(sk-[A-Za-z0-9_-]{4})[A-Za-z0-9_-]+/g;

function detailOf(error: { error?: unknown; message: string }): string {
  const body = error.error as { error?: { message?: string }; message?: string } | undefined;
  return (body?.error?.message ?? body?.message ?? error.message).replace(SECRET, '$1…(hidden)');
}

function explain(provider: Provider, status: number | undefined, detail: string): string {
  if (status === undefined) return `Could not reach ${provider.name}. Check the server's internet access and try again.`;
  if (status === 401 || status === 403) return `${provider.name} rejected the API key. Check ${provider.keyVar} on the server. (${detail})`;
  if (/credit|billing|quota|balance/i.test(detail)) return `The ${provider.name} account has no credit left. Add credit or billing, then try again. (${detail})`;
  if (status === 404) return `${provider.name} could not find the model. Check ${provider.modelVar} on the server. (${detail})`;
  if (status === 413) return `The files are too large to send to ${provider.name} in one go. Try fewer or smaller files.`;
  if (status === 429) return `${provider.name} is rate limiting this account. Wait a minute and try again.`;
  if (status >= 500) return `${provider.name} is busy or having problems right now. Try again in a minute.`;
  return `${provider.name} returned an error (${status}): ${detail}`;
}

export function describeAiError(error: unknown): string | null {
  if (error instanceof Anthropic.APIError) return explain(CLAUDE, error.status, detailOf(error));
  if (error instanceof OpenAI.APIError) return explain(CHATGPT, error.status, detailOf(error));
  return null;
}
