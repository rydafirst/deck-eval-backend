import { z } from 'zod';
import { FIELD_SCOPES, FIELD_TYPES } from '../shared';

export const fieldConfigSchema = z.object({
  min: z.number().int().optional(),
  max: z.number().int().optional(),
  labels: z.record(z.string(), z.string()).optional(),
  minChars: z.number().int().min(0).optional(),
  maxChars: z.number().int().min(1).optional(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
});

export const fieldInputSchema = z.object({
  key: z.string().min(1).regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  label: z.string().min(1),
  helpText: z.string().nullish(),
  type: z.enum(FIELD_TYPES),
  scope: z.enum(FIELD_SCOPES),
  required: z.boolean(),
  config: fieldConfigSchema.default({}),
});

export const templateInputSchema = z
  .object({ name: z.string().min(1), fields: z.array(fieldInputSchema) })
  .refine((t) => new Set(t.fields.map((f) => f.key)).size === t.fields.length, {
    message: 'Field keys must be unique',
    path: ['fields'],
  });

export type FieldInput = z.infer<typeof fieldInputSchema>;
export type TemplateInput = z.infer<typeof templateInputSchema>;
