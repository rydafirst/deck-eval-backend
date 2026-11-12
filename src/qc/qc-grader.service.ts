import { extname } from 'node:path';
import { BadRequestException, Injectable } from '@nestjs/common';
import type { ContentBlockParam, MessageParam, TextBlockParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import sharp from 'sharp';
import type { QcResult, ResponseRef, RubricFieldDef } from '../shared';
import { ClaudeClient } from '../ai/claude-client';
import { htmlToText } from '../common/html';
import { config } from '../config';
import { DocumentConverter } from '../documents/document-converter';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { GuidesService } from '../guides/guides.service';
import { describeForm, qcInputSchema, toAnswers, type QcToolInput } from './qc-form';

const TOOL_NAME = 'submit_ratings';
const MAX_IMAGES = 95;
const MAX_FILE_CHARS = 30_000;
const SLIDE_WIDTH = 1280;
const MAX_OUTPUT_TOKENS = 32_000;
const MAX_ATTEMPTS = 2;
const IMAGE_FILE = /\.(png|jpe?g|webp|gif)$/i;

type GradingTask = NonNullable<Awaited<ReturnType<QcGraderService['loadTask']>>>;

@Injectable()
export class QcGraderService {
  constructor(
    private readonly ai: ClaudeClient,
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly documents: DocumentConverter,
    private readonly guides: GuidesService,
  ) {}

  ensureReady() {
    this.ai.require('AI is not set up yet. Add ANTHROPIC_API_KEY to the API server to use QC.');
  }

  async grade(taskId: string, fields: RubricFieldDef[]): Promise<QcResult> {
    const client = this.ai.require('AI is not set up yet. Add ANTHROPIC_API_KEY to the API server to use QC.');
    const task = await this.loadTask(taskId);
    if (!task) throw new BadRequestException('Task not found');
    const imageCount = task.responses.reduce((n, r) => n + r.slides.length, 0) + task.inputFiles.filter((f) => IMAGE_FILE.test(f.name)).length;
    if (imageCount > MAX_IMAGES) throw new BadRequestException(`This task has ${imageCount} slides and images. QC can read up to ${MAX_IMAGES} at once.`);

    const responses: ResponseRef[] = task.responses.map((r) => ({ id: r.id, label: r.label }));
    const tool: Tool = {
      name: TOOL_NAME,
      description: 'Submit the completed rating form. Fill every field for every response, then the task fields.',
      input_schema: qcInputSchema(fields, responses) as Tool['input_schema'],
    };

    const system: TextBlockParam[] = [{ type: 'text', text: await this.systemPrompt(), cache_control: { type: 'ephemeral' } }];
    const messages: MessageParam[] = [{ role: 'user', content: await this.taskContent(task, fields) }];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const message = await client.messages
        .stream({ model: config.anthropic.qcModel, max_tokens: MAX_OUTPUT_TOKENS, system, tools: [tool], messages })
        .finalMessage();
      if (message.stop_reason === 'max_tokens') throw new Error('The ratings were cut off before they finished. Try again.');

      const toolUse = message.content.find((block) => block.type === 'tool_use' && block.name === TOOL_NAME);
      if (toolUse && toolUse.type === 'tool_use') {
        const input = toolUse.input as QcToolInput;
        return { answers: toAnswers(input, fields, responses), notes: input.notes?.trim() || null };
      }
      messages.push({ role: 'assistant', content: message.content }, { role: 'user', content: `Call ${TOOL_NAME} now with the whole form filled in.` });
    }
    throw new Error('The AI did not return any ratings. Try again.');
  }

  private loadTask(taskId: string) {
    return this.prisma.task.findUnique({
      where: { id: taskId },
      include: {
        inputFiles: { orderBy: { name: 'asc' } },
        responses: { orderBy: { order: 'asc' }, include: { slides: { orderBy: { order: 'asc' } }, files: true } },
      },
    });
  }

  private async systemPrompt(): Promise<string> {
    const guides = await this.guides.list('qc');
    const intro = `You fill in the rating form for a slide-deck evaluation task on the Deck Eval platform. The admin who runs you will read and edit every answer before submitting, so write each answer exactly as it should appear in its box.

Follow the guides below. They were written for a person rating by hand, so adapt them like this:
- You cannot ask questions. Where a guide says to ask before scoring (an unclear instruction, a missing file, a rendering doubt), make the best judgement from the files and put the question in "notes".
- The slide images were rendered from the original files. If text looks cut off or fonts look wrong in a way that may be a rendering problem, mention it in "notes" instead of scoring it as a defect.
- The form has a separate box for each score and each explanation. Put only the number in a score field. In an explanation box, write the sub-criterion lines for that axis only (for example "Completeness: ..." on its own line, then "Accuracy: ..."), with no axis heading and no "Rating:" line, unless the task instructions ask for them.
- Write plain text with line breaks. No markdown, no bold, no headings, no bullet symbols unless the task instructions use them.
- Where the task instructions or the form differ from the guides, follow the task instructions and the form.
- Rate every response on its own first. Only the ranking fields may compare responses.`;
    return [intro, ...guides.map((g) => `# Guide: ${g.title}\n\n${g.body.trim()}`)].join('\n\n---\n\n');
  }

  private async taskContent(task: GradingTask, fields: RubricFieldDef[]): Promise<ContentBlockParam[]> {
    const blocks: ContentBlockParam[] = [
      {
        type: 'text',
        text: `Task: ${task.title}\n\nInstructions for raters:\n${htmlToText(task.instructions) || '(none given)'}\n\nUser request (what the deck generator was asked):\n${htmlToText(task.userRequest) || '(none given)'}`,
      },
    ];

    if (task.inputFiles.length) {
      blocks.push({ type: 'text', text: `Input files given to the deck generator (${task.inputFiles.length}):` });
      for (const file of task.inputFiles) blocks.push(...(await this.inputFileBlocks(file)));
    } else {
      blocks.push({ type: 'text', text: 'There are no input files for this task.' });
    }

    blocks.push({ type: 'text', text: `Rating form, in order. Use these field keys in ${TOOL_NAME}:\n${describeForm(fields)}` });

    for (const response of task.responses) {
      const fileNames = response.files.map((f) => f.name).join(', ');
      blocks.push({ type: 'text', text: `Response ${response.label}: ${response.slides.length} slides${fileNames ? `. Files: ${fileNames}` : ''}.` });
      const slideText = await this.responseSlideText(response.files);
      for (const [index, slide] of response.slides.entries()) {
        const text = slideText[index]?.trim();
        blocks.push({ type: 'text', text: `Response ${response.label}, slide ${index + 1}${text ? `. Text on this slide:\n${text}` : ''}` });
        blocks.push(await this.imageBlock(slide.webKey).catch(() => {
          throw new BadRequestException(`Response ${response.label}, slide ${index + 1} has no image in storage. Delete it and upload the slide again on the Responses step.`);
        }));
      }
    }

    blocks.push({ type: 'text', text: `Rate every response against the instructions, the user request and the input files, then fill the task fields. Call ${TOOL_NAME} once with the whole form.` });
    return blocks;
  }

  private async inputFileBlocks(file: GradingTask['inputFiles'][number]): Promise<ContentBlockParam[]> {
    if (IMAGE_FILE.test(file.name)) {
      return [{ type: 'text', text: `Input file "${file.name}" (image):` }, await this.imageBlock(file.storageKey)];
    }
    try {
      const text = (await this.documents.textOf(await this.storage.getObject(file.storageKey), extname(file.name))).trim();
      const clipped = text.length > MAX_FILE_CHARS ? `${text.slice(0, MAX_FILE_CHARS)}\n[cut off here]` : text;
      return [{ type: 'text', text: `Input file "${file.name}":\n${clipped || '(no readable text)'}` }];
    } catch {
      return [{ type: 'text', text: `Input file "${file.name}" could not be read. Mention this in notes.` }];
    }
  }

  private async responseSlideText(files: GradingTask['responses'][number]['files']): Promise<string[]> {
    const deck = files.find((f) => /\.(pptx?|odp|key|pdf)$/i.test(f.name));
    if (!deck) return [];
    try {
      const text = await this.documents.textOf(await this.storage.getObject(deck.storageKey), extname(deck.name));
      return text.split('\f');
    } catch {
      return [];
    }
  }

  private async imageBlock(key: string): Promise<ContentBlockParam> {
    const source = await this.storage.getObject(key);
    const data = await sharp(source).resize({ width: SLIDE_WIDTH, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    return { type: 'image', source: { type: 'base64', media_type: 'image/webp', data: data.toString('base64') } };
  }
}
