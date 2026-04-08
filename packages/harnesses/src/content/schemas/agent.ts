import { z } from 'zod';

export const AgentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tier: z.enum(['oss', 'pro']).default('oss'),
  isolation: z.enum(['worktree', 'none']).default('none'),
  tools: z.array(z.string()).default([]),
  content: z.string().min(1),
});

export type Agent = z.infer<typeof AgentSchema>;
