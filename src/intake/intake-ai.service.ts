import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import type { ContentBlockParam, MessageParam, Tool } from '@anthropic-ai/sdk/resources/messages';
import { RESPONSE_LABELS, type IntakeReply, type IntakeTurn, type TaskDraft } from '../shared';
import { config } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { IntakeFilesService, type IntakeManifest } from './intake-files.service';
import { taskDraftSchema } from './intake.schema';

const MAX_OUTPUT_TOKENS = 16_000;
const TOOL_NAME = 'save_task_draft';

interface DraftToolInput {
  title: string;
  project_id: string;
  priority: number;
  tag_names?: string[];
  due_date?: string | null;
  raters_needed?: number;
  instructions_html: string;
  user_request_html: string;
  files: Array<{ file: string; role: 'response' | 'input' | 'ignore'; label?: string | null }>;
  notes?: string | null;
}

@Injectable()
export class IntakeAiService {
  private readonly client = config.anthropic.apiKey
    ? new Anthropic({ apiKey: config.anthropic.apiKey, baseURL: config.anthropic.baseUrl })
    : null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly files: IntakeFilesService,
    private readonly storage: StorageService,
  ) {}

  get enabled() {
    return this.client !== null;
  }

  async chat(turns: IntakeTurn[]): Promise<IntakeReply> {
    if (!this.client) {
      throw new ServiceUnavailableException('AI is not set up yet. Add ANTHROPIC_API_KEY to the API server, or use Smart import.');
    }
    const fileIds = [...new Set(turns.flatMap((t) => [...t.fileIds, ...(t.draft?.files.map((f) => f.fileId) ?? [])]))];
    const manifests = await this.files.manifests(fileIds);
    const notReady = manifests.find((m) => m.status !== 'ready');
    if (notReady) throw new BadRequestException(`${notReady.name} is still processing or failed`);

    const alias = new Map(manifests.map((m, i) => [m.id, `F${i + 1}`]));
    const byAlias = new Map(manifests.map((m, i) => [`F${i + 1}`, m]));
    const [projects, tags] = await Promise.all([
      this.prisma.project.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
      this.prisma.tag.findMany({ select: { name: true }, orderBy: { name: 'asc' } }),
    ]);
    if (projects.length === 0) throw new BadRequestException('Create a project before adding tasks');

    const messages = await this.toMessages(turns, manifests, alias);
    const response = await this.client.messages.create({
      model: config.anthropic.model,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: this.systemPrompt(projects, tags.map((t) => t.name)),
      tools: [this.draftTool(projects.map((p) => p.id), [...byAlias.keys()])],
      messages,
    });

    const reply = response.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n\n')
      .trim();
    const toolUse = response.content.find((block) => block.type === 'tool_use' && block.name === TOOL_NAME);
    const draft = toolUse && toolUse.type === 'tool_use' ? this.toDraft(toolUse.input as DraftToolInput, byAlias) : null;
    return { reply: reply || (draft ? 'I have filled in the draft below. Check it, then create the task.' : ''), draft };
  }

  private async toMessages(turns: IntakeTurn[], manifests: IntakeManifest[], alias: Map<string, string>): Promise<MessageParam[]> {
    const byId = new Map(manifests.map((m) => [m.id, m]));
    const messages: MessageParam[] = [];
    for (const turn of turns) {
      if (turn.role === 'assistant') {
        const draftNote = turn.draft ? `\n\n[Draft saved earlier: ${JSON.stringify(this.toToolInput(turn.draft, alias))}]` : '';
        messages.push({ role: 'assistant', content: `${turn.text}${draftNote}`.trim() || '(no reply)' });
        continue;
      }
      const content: ContentBlockParam[] = [{ type: 'text', text: turn.text.trim() || '(The admin attached files without a message.)' }];
      for (const id of turn.fileIds) {
        const manifest = byId.get(id);
        if (manifest) content.push(...(await this.describeFile(manifest, alias.get(id)!)));
      }
      messages.push({ role: 'user', content });
    }
    const last = messages[messages.length - 1];
    if (last?.role === 'user' && Array.isArray(last.content)) {
      const block = last.content[last.content.length - 1];
      if (block.type === 'text' || block.type === 'image') block.cache_control = { type: 'ephemeral' };
    }
    return messages;
  }

  private async describeFile(manifest: IntakeManifest, ref: string): Promise<ContentBlockParam[]> {
    const pages = manifest.pages.length ? `, ${manifest.pages.length} page${manifest.pages.length === 1 ? '' : 's'}` : '';
    const blocks: ContentBlockParam[] = [{ type: 'text', text: `Attached file ${ref}: "${manifest.name}" (${manifest.kind}${pages})` }];
    if (manifest.text.trim()) {
      blocks.push({ type: 'text', text: `Text extracted from ${ref}:\n${manifest.text}` });
    }
    const preview = manifest.pages[0];
    if (preview) {
      const data = (await this.storage.getObject(preview.webKey)).toString('base64');
      blocks.push({ type: 'image', source: { type: 'base64', media_type: 'image/webp', data } });
      if (manifest.kind !== 'image') blocks.push({ type: 'text', text: `(Above: first page of ${ref}.)` });
    }
    return blocks;
  }

  private systemPrompt(projects: Array<{ id: string; name: string }>, tags: string[]) {
    return `You help an admin set up a slide-deck evaluation task on the Deck Eval platform. The admin pastes everything they have for one task: rating instructions, the user request (the prompt an AI deck generator was given), input files (source material the generator received), response decks labelled A to D, and screenshots. Your job is to turn this into a task draft by calling ${TOOL_NAME}.

How to fill the draft:
- instructions_html: the rating instructions for raters. Keep the admin's wording exactly. Do not summarise, shorten, reword or add anything. If instructions are in a screenshot or PDF, transcribe them word for word.
- user_request_html: the request the deck generator received, word for word.
- Use only these HTML tags: p, br, strong, em, ul, ol, li, h2, h3, blockquote, a.
- files: give every attached file a role. "response" with a label A-D for each response deck or response slide image, "input" for source material the generator was given, "ignore" for screenshots you transcribed or files that are not part of the task. Within one response, list files in slide order.
- Work out response labels from file names and content (for example "response_b.pptx", "Output 2", or a slide titled "Response C"). If two decks could be either label, ask instead of guessing.
- title: a short, specific name for the task, usually the deck topic.
- project_id: one of: ${projects.map((p) => `${p.id} (${p.name})`).join(', ')}. Pick the closest match; use the first if unsure.
- priority: 1 high, 2 normal, 3 low. Use 2 unless the admin says otherwise.
- tag_names: reuse existing tags where they fit (${tags.length ? tags.join(', ') : 'none yet'}); only add new ones if the admin asks.
- due_date: YYYY-MM-DD only if the admin gives one. Today is ${new Date().toISOString().slice(0, 10)}.
- raters_needed: 1 unless the admin says otherwise.
- notes: anything the admin should double-check, such as a missing user request or a guessed label.

How to talk:
- If something important is missing or ambiguous, ask one short question and do not call the tool yet.
- When you have enough, call ${TOOL_NAME}, then say in one or two plain sentences what you filled in and what to check.
- If the admin asks for a change after a draft exists, call ${TOOL_NAME} again with the complete updated draft.
- Be brief and plain. No headings, no lists in your chat replies.`;
  }

  private draftTool(projectIds: string[], fileRefs: string[]): Tool {
    const fileProperty = fileRefs.length ? { type: 'string', enum: fileRefs } : { type: 'string' };
    return {
      name: TOOL_NAME,
      description: 'Save the structured task draft. Always send the complete draft.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          project_id: { type: 'string', enum: projectIds },
          priority: { type: 'integer', enum: [1, 2, 3] },
          tag_names: { type: 'array', items: { type: 'string' } },
          due_date: { type: ['string', 'null'], description: 'YYYY-MM-DD or null' },
          raters_needed: { type: 'integer', minimum: 1 },
          instructions_html: { type: 'string' },
          user_request_html: { type: 'string' },
          files: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                file: fileProperty,
                role: { type: 'string', enum: ['response', 'input', 'ignore'] },
                label: { type: ['string', 'null'], enum: [...RESPONSE_LABELS, null] },
              },
              required: ['file', 'role'],
            },
          },
          notes: { type: ['string', 'null'] },
        },
        required: ['title', 'project_id', 'priority', 'instructions_html', 'user_request_html', 'files'],
      },
    };
  }

  private toDraft(input: DraftToolInput, byAlias: Map<string, IntakeManifest>): TaskDraft | null {
    const files = (input.files ?? [])
      .filter((f) => byAlias.has(f.file))
      .map((f) => {
        const label = f.role === 'response' && RESPONSE_LABELS.includes(f.label as never) ? (f.label as TaskDraft['files'][number]['label']) : null;
        return { fileId: byAlias.get(f.file)!.id, role: f.role === 'response' && !label ? 'input' : f.role, label };
      });
    const assigned = new Set(files.map((f) => f.fileId));
    for (const manifest of byAlias.values()) {
      if (!assigned.has(manifest.id)) files.push({ fileId: manifest.id, role: 'ignore', label: null });
    }
    const parsed = taskDraftSchema.safeParse({
      title: input.title,
      projectId: input.project_id,
      priority: input.priority,
      tagNames: input.tag_names ?? [],
      dueAt: input.due_date ?? null,
      ratersNeeded: input.raters_needed ?? 1,
      instructionsHtml: input.instructions_html ?? '',
      userRequestHtml: input.user_request_html ?? '',
      files,
      notes: input.notes ?? null,
    });
    return parsed.success ? parsed.data : null;
  }

  private toToolInput(draft: TaskDraft, alias: Map<string, string>) {
    return {
      title: draft.title,
      project_id: draft.projectId,
      priority: draft.priority,
      tag_names: draft.tagNames,
      due_date: draft.dueAt,
      raters_needed: draft.ratersNeeded,
      instructions_html: draft.instructionsHtml,
      user_request_html: draft.userRequestHtml,
      files: draft.files.map((f) => ({ file: alias.get(f.fileId) ?? f.fileId, role: f.role, label: f.label })),
      notes: draft.notes,
    };
  }
}
