import type { PreambleTier } from '../../schemas/preamble.js';

export const preambles: PreambleTier[] = [
  {
    tier: 1,
    name: 'Identity',
    description: 'Always injected  -  core project identity and structure',
    ruleIds: ['monorepo'],
  },
  {
    tier: 2,
    name: 'Architecture',
    description:
      'Project-wide technical context  -  database, styling, formatting, config patterns',
    ruleIds: ['database', 'biome', 'tailwind', 'parameterization'],
  },
  {
    tier: 3,
    name: 'Domain',
    description: 'Feature-area specific policies  -  analysis standards, code hygiene',
    ruleIds: ['code-analysis-policy', 'unused-declarations'],
  },
  {
    tier: 4,
    name: 'Task',
    description: 'Injected per-operation  -  skill routing, agent dispatch',
    ruleIds: ['skills-usage', 'agent-dispatch'],
  },
];
