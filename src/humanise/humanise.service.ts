import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { HumaniseItem, HumaniseMode, HumaniseResult, HumanisedText, JobDTO } from '../shared';
import { ClaudeClient } from '../ai/claude-client';
import { OpenAiClient } from '../ai/openai-client';
import { AuditService } from '../audit/audit.service';
import { GuidesService } from '../guides/guides.service';
import { JobsService } from '../jobs/jobs.service';
import { missingKeyPoints } from './key-points';

const MAX_ROUNDS = 3;
const TARGET_SCORE = 10;
const CONCURRENCY = 4;

interface Review {
  score: number;
  missing: string[];
  fixes: string[];
}

interface Prompts {
  writer: string;
  refiner: string;
  checker: string;
  styleNote: string;
}

function parseReview(raw: string): Review {
  try {
    const json = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as Partial<Review>;
    const list = (value: unknown) => (Array.isArray(value) ? value.map(String).filter(Boolean) : []);
    return { score: Math.max(0, Math.min(10, Number(json.score) || 0)), missing: list(json.missing), fixes: list(json.fixes) };
  } catch {
    return { score: 0, missing: [], fixes: ['Rewrite again so it reads as written by a person.'] };
  }
}

function writePrompt(item: HumaniseItem, previous?: string, problems: string[] = []): string {
  const base = `Answer box: ${item.label}\n\nOriginal text:\n${item.text}`;
  if (!previous) return base;
  return `${base}\n\nYour last rewrite:\n${previous}\n\nA reviewer found these problems. Fix every one of them and rewrite again from the original:\n${problems.map((p) => `- ${p}`).join('\n')}`;
}

async function mapLimited<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await fn(items[index]).then(
        (value) => ({ status: 'fulfilled' as const, value }),
        (reason: Error) => ({ status: 'rejected' as const, reason }),
      );
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

@Injectable()
export class HumaniseService {
  constructor(
    private readonly claude: ClaudeClient,
    private readonly openai: OpenAiClient,
    private readonly guides: GuidesService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  async start(userId: string, mode: HumaniseMode, items: HumaniseItem[]): Promise<JobDTO<HumaniseResult>> {
    this.openai.require();
    if (mode === 'voice') this.claude.require();
    await this.audit.log(userId, 'humanise', 'Answers', mode, { fields: items.length });
    return this.jobs.start(userId, `humanise:${randomUUID()}`, () => this.run(mode, items));
  }

  private async run(mode: HumaniseMode, items: HumaniseItem[]): Promise<HumaniseResult> {
    const prompts = await this.prompts(mode);
    const settled = await mapLimited(items, CONCURRENCY, (item) => this.humanise(mode, item, prompts));
    const result: HumaniseResult = { items: [], failed: [] };
    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') result.items.push(outcome.value);
      else result.failed.push({ key: items[i].key, error: (outcome.reason as Error).message || 'Rewrite failed' });
    });
    return result;
  }

  private async prompts(mode: HumaniseMode): Promise<Prompts> {
    const checker = await this.guides.body('humanise-check');
    if (mode === 'chatgpt') {
      const writer = await this.guides.body('humanise-chatgpt');
      return { writer, refiner: writer, checker, styleNote: 'Style asked for: plain writing by a careful human grader, as described in the instructions.' };
    }
    const [voice, sample] = await Promise.all([this.guides.body('write-like-me'), this.guides.body('writing-sample')]);
    const writer = `${voice}\n\n# Writing sample\n\n${sample}`;
    return {
      writer,
      refiner: `${writer}\n\n# Your job\n\nYou are given the original text and a draft rewrite by another writer. Produce the final version. Put back any key point from the original that the draft lost or changed, remove anything it added, make the voice match the writing sample more closely, and make sure the small slips follow the rules above. Return only the final text.`,
      checker: `${checker}\n\n# Writing sample\n\nThe rewrite should sound like the person who wrote this sample, including a few small slips like theirs. Small slips that follow that pattern are wanted and must not lower the score.\n\n${sample}`,
      styleNote: "Style asked for: the writer's own voice, as shown in the writing sample.",
    };
  }

  private async write(mode: HumaniseMode, item: HumaniseItem, prompts: Prompts, previous?: string, problems?: string[]): Promise<string> {
    const draft = await this.openai.complete(prompts.writer, writePrompt(item, previous, problems));
    if (mode === 'chatgpt') return draft;
    return this.claude.complete(prompts.refiner, `${writePrompt(item, previous, problems)}\n\nDraft rewrite from the other writer:\n${draft}`);
  }

  private async review(mode: HumaniseMode, item: HumaniseItem, prompts: Prompts, rewrite: string): Promise<Review> {
    const prompt = `${prompts.styleNote}\n\nAnswer box: ${item.label}\n\nOriginal:\n${item.text}\n\nRewrite:\n${rewrite}`;
    const raw = mode === 'chatgpt' ? await this.openai.complete(prompts.checker, prompt) : await this.claude.complete(prompts.checker, prompt);
    return parseReview(raw);
  }

  private async humanise(mode: HumaniseMode, item: HumaniseItem, prompts: Prompts): Promise<HumanisedText> {
    let text = await this.write(mode, item, prompts);
    let best: HumanisedText | null = null;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const review = await this.review(mode, item, prompts, text);
      const missing = [...missingKeyPoints(item.text, text).map((point) => `Put back ${point} exactly as in the original.`), ...review.missing];
      const attempt: HumanisedText = { key: item.key, text, score: review.score, rounds: round, missing, applied: missing.length === 0 };
      if (!best || this.better(attempt, best)) best = attempt;
      if (attempt.applied && attempt.score >= TARGET_SCORE) break;
      if (round < MAX_ROUNDS) text = await this.write(mode, item, prompts, text, [...missing, ...review.fixes]);
    }

    return best!.applied ? best! : { ...best!, text: item.text };
  }

  private better(a: HumanisedText, b: HumanisedText): boolean {
    if (a.applied !== b.applied) return a.applied;
    return a.score > b.score;
  }
}
