import { z } from 'zod';

export const RuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  scope: z.enum(['global', 'project']),
  preambleTier: z.number().int().min(1).max(4).default(2),
  tier: z.enum(['oss', 'pro']).default('oss'),
  tags: z.array(z.string()).default([]),
  content: z.string().min(1),
});

export type Rule = z.infer<typeof RuleSchema>;
