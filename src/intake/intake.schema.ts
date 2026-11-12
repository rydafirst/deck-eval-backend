import { z } from 'zod';
import { RESPONSE_LABELS } from '../shared';

export const draftFileSchema = z.object({
  fileId: z.string().min(1),
  role: z.enum(['response', 'input', 'ignore']),
  label: z.enum(RESPONSE_LABELS).nullable(),
});

export const taskDraftSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().min(1),
  priority: z.number().int().min(1).max(3),
  tagNames: z.array(z.string().trim().min(1).max(40)).max(10),
  dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  ratersNeeded: z.number().int().min(1).max(50),
  instructionsHtml: z.string().max(100_000),
  userRequestHtml: z.string().max(100_000),
  files: z.array(draftFileSchema).max(60),
  notes: z.string().max(2000).nullable(),
});

export const intakeTurnSchema = z.object({
  role: z.enum(['user', 'assistant']),
  text: z.string().max(200_000),
  fileIds: z.array(z.string()).max(40),
  draft: taskDraftSchema.nullable(),
});

export const chatSchema = z.object({ turns: z.array(intakeTurnSchema).min(1).max(60) });
