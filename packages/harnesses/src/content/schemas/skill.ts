import { z } from 'zod';

export const SkillSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  tier: z.enum(['oss', 'pro']).default('oss'),
  disableModelInvocation: z.boolean().default(false),
  /** When true, the generator omits YAML frontmatter — the content IS the entire file. */
  skipFrontmatter: z.boolean().default(false),
  filePatterns: z.array(z.string()).default([]),
  bashPatterns: z.array(z.string()).default([]),
  references: z.record(z.string(), z.string()).default({}),
  content: z.string().min(1),
});

export type Skill = z.infer<typeof SkillSchema>;
