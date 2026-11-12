import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { HumaniseItem, HumaniseMode, HumaniseResult, HumanisedText, JobDTO } from '../shared';
import { TextAi, type AiProvider } from '../ai/text-ai.service';
import { AuditService } from '../audit/audit.service';
import { GuidesService } from '../guides/guides.service';
import { JobsService } from '../jobs/jobs.service';
import { describeAiError } from '../ai/ai-error';
import { missingKeyPoints, stripEchoedLabel } from './key-points';
import { parseReview, REVIEW_PROTOCOL, type Review } from './review';

const MAX_ROUNDS = 5;
const TARGET_SCORE = 10;
const CONCURRENCY = 4;

interface Prompts {
  writer: string;
  refiner: string;
  checker: string;
  styleNote: string;
}

interface Run {
  mode: HumaniseMode;
  prompts: Prompts;
  switched: Set<AiProvider>;
}

function writePrompt(item: HumaniseItem, previous?: string, problems: string[] = []): string {
  const base = `The text is written in this answer box (for context only; do not write the box name in your text): ${item.label}\n\nOriginal text:\n${item.text}`;
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
    private readonly ai: TextAi,
    private readonly guides: GuidesService,
    private readonly jobs: JobsService,
    private readonly audit: AuditService,
  ) {}

  async start(userId: string, mode: HumaniseMode, items: HumaniseItem[]): Promise<JobDTO<HumaniseResult>> {
    this.ai.require();
    await this.audit.log(userId, 'humanise', 'Answers', mode, { fields: items.length });
    return this.jobs.start(userId, `humanise:${randomUUID()}`, () => this.run(mode, items));
  }

  private async run(mode: HumaniseMode, items: HumaniseItem[]): Promise<HumaniseResult> {
    const run: Run = { mode, prompts: await this.prompts(mode), switched: new Set() };
    const settled = await mapLimited(items, CONCURRENCY, (item) => this.humanise(run, item));
    const result: HumaniseResult = { items: [], failed: [], notice: this.notice(run) };
    settled.forEach((outcome, i) => {
      if (outcome.status === 'fulfilled') result.items.push(outcome.value);
      else result.failed.push({ key: items[i].key, error: describeAiError(outcome.reason) ?? ((outcome.reason as Error).message || 'Rewrite failed') });
    });
    return result;
  }

  private async prompts(mode: HumaniseMode): Promise<Prompts> {
    const checker = await this.guides.body('humanise-check');
    if (mode === 'chatgpt') {
      const writer = await this.guides.body('humanise-chatgpt');
      return { writer, refiner: writer, checker: `${checker}\n\n${REVIEW_PROTOCOL}`, styleNote: 'Style asked for: plain writing by a careful human grader, as described in the instructions.' };
    }
    const [voice, sample] = await Promise.all([this.guides.body('write-like-me'), this.guides.body('writing-sample')]);
    const writer = `${voice}\n\n# Writing sample\n\n${sample}`;
    return {
      writer,
      refiner: `${writer}\n\n# Your job\n\nYou are given the original text and a draft rewrite by another writer. Produce the final version. Put back any key point from the original that the draft lost or changed, remove anything it added, make the voice match the writing sample more closely, and make sure the small slips follow the rules above. Return only the final text.`,
      checker: `${checker}\n\n# Writing sample\n\nThe rewrite should sound like the person who wrote this sample, including a few small slips like theirs. Small slips that follow that pattern are wanted and must not lower the score.\n\n${sample}\n\n${REVIEW_PROTOCOL}`,
      styleNote: "Style asked for: the writer's own voice, as shown in the writing sample.",
    };
  }

  private async ask(run: Run, preferred: AiProvider, system: string, prompt: string): Promise<string> {
    const reply = await this.ai.complete(preferred, system, prompt);
    if (reply.provider !== preferred) run.switched.add(preferred);
    return reply.text;
  }

  private notice(run: Run): string | null {
    const lines = [...run.switched].map((provider) => {
      const other = this.ai.name(provider === 'claude' ? 'chatgpt' : 'claude');
      return `${this.ai.name(provider)} was not available, so ${other} did its part. ${this.ai.unavailableReason(provider) ?? ''}`.trim();
    });
    return lines.length ? lines.join('\n') : null;
  }

  private async write(run: Run, item: HumaniseItem, previous?: string, problems?: string[]): Promise<string> {
    const { prompts } = run;
    const draft = stripEchoedLabel(await this.ask(run, 'chatgpt', prompts.writer, writePrompt(item, previous, problems)), item.label);
    if (run.mode === 'chatgpt') return draft;
    const refined = await this.ask(run, 'claude', prompts.refiner, `${writePrompt(item, previous, problems)}\n\nDraft rewrite from the other writer:\n${draft}`);
    return stripEchoedLabel(refined, item.label);
  }

  private async review(run: Run, item: HumaniseItem, rewrite: string): Promise<Review> {
    const prompt = `${run.prompts.styleNote}\n\nAnswer box: ${item.label}\n\nOriginal:\n${item.text}\n\nRewrite:\n${rewrite}`;
    const raw = await this.ask(run, run.mode === 'chatgpt' ? 'chatgpt' : 'claude', run.prompts.checker, prompt);
    return parseReview(raw, item.text, rewrite);
  }

  private async humanise(run: Run, item: HumaniseItem): Promise<HumanisedText> {
    const current = await this.review(run, item, item.text);
    if (current.score >= TARGET_SCORE) return { key: item.key, text: item.text, score: current.score, rounds: 0, missing: [], applied: true };

    let text = await this.write(run, item);
    let best: HumanisedText | null = null;
    for (let round = 1; round <= MAX_ROUNDS; round++) {
      const review = await this.review(run, item, text);
      const missing = [...missingKeyPoints(item.text, text).map((point) => `Put back ${point} exactly as in the original.`), ...review.missing];
      const attempt: HumanisedText = { key: item.key, text, score: review.score, rounds: round, missing, applied: missing.length === 0 };
      if (attempt.applied && attempt.score >= TARGET_SCORE) return attempt;
      if (!best || this.better(attempt, best)) best = attempt;
      if (round < MAX_ROUNDS) text = await this.write(run, item, text, [...missing, ...review.fixes]);
    }
    return { ...best!, text: item.text, applied: false };
  }

  private better(a: HumanisedText, b: HumanisedText): boolean {
    if (a.applied !== b.applied) return a.applied;
    return a.score > b.score;
  }
}
