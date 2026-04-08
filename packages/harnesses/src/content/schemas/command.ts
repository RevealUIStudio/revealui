import { z } from 'zod';

export const CommandSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tier: z.enum(['oss', 'pro']).default('oss'),
  disableModelInvocation: z.boolean().default(false),
  argumentHint: z.string().optional(),
  content: z.string().min(1),
});

export type Command = z.infer<typeof CommandSchema>;
