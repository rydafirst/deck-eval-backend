import { z } from 'zod';

export const basicsSchema = z.object({
  title: z.string().trim().min(1).max(200),
  projectId: z.string().min(1),
  priority: z.number().int().min(1).max(3),
  tagIds: z.array(z.string()).default([]),
  dueAt: z.string().datetime({ offset: true }).nullish(),
  ratersNeeded: z.number().int().min(1).max(50),
});

export const briefSchema = z.object({
  instructions: z.string().max(100_000),
  userRequest: z.string().max(100_000),
});

export const assignmentSchema = z.object({
  openQueue: z.boolean(),
  sharedSheet: z.boolean().default(false),
  assigneeIds: z.array(z.string()),
  ratersNeeded: z.number().int().min(1).max(50),
});

export const slideOrderSchema = z.object({ slideIds: z.array(z.string()).min(1) });
export const slideMoveSchema = z.object({
  slideIds: z.array(z.string()).min(1).max(500),
  responseId: z.string().min(1),
  index: z.number().int().min(0).optional(),
});
export type SlideMoveInput = z.infer<typeof slideMoveSchema>;
export const slideCaptionSchema = z.object({ caption: z.string().max(60).nullable() });
export const statusSchema = z.object({ status: z.enum(['DRAFT', 'PUBLISHED', 'ARCHIVED']) });

export type BasicsInput = z.infer<typeof basicsSchema>;
export type BriefInput = z.infer<typeof briefSchema>;
export type AssignmentInput = z.infer<typeof assignmentSchema>;
