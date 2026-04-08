import { z } from 'zod';
import { AgentSchema } from './agent.js';
import { CommandSchema } from './command.js';
import { PreambleTierSchema } from './preamble.js';
import { RuleSchema } from './rule.js';
import { SkillSchema } from './skill.js';

export const ManifestSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string().datetime(),
  rules: z.array(RuleSchema),
  commands: z.array(CommandSchema),
  agents: z.array(AgentSchema),
  skills: z.array(SkillSchema),
  preambles: z.array(PreambleTierSchema),
});

export type Manifest = z.infer<typeof ManifestSchema>;
