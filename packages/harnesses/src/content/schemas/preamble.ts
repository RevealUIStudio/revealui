import { z } from 'zod';

export const PreambleTierSchema = z.object({
  tier: z.number().int().min(1).max(4),
  name: z.string().min(1),
  description: z.string().min(1),
  ruleIds: z.array(z.string()),
});

export type PreambleTier = z.infer<typeof PreambleTierSchema>;
