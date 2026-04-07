import { z } from 'zod';

export const saveAiSettingsSchema = z.object({
  enabled: z.boolean(),
  provider: z.enum(['anthropic', 'openai', 'openrouter', 'local']),
  baseUrl: z.string().optional().default(''),
  apiKey: z.string().optional(), // undefined → keep existing; '' → clear; string → new key
  model: z.string().optional().default(''),
});

export type SaveAiSettingsInput = z.infer<typeof saveAiSettingsSchema>;
