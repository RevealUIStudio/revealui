import type { PreambleTier } from '../../schemas/preamble.js';

export const preambles: PreambleTier[] = [
  {
    tier: 1,
    name: 'Identity',
    description: 'Always injected  -  core project identity and structure',
    ruleIds: [
      'monorepo',
      'tracker-first',
      'quality-over-speed',
      'code-over-docs',
      'durable-solutions',
      'disposition-actions',
      'adapter-only',
      // HARDLINE every session: no underscore-silence of unused (owner 2026-07-29)
      'unused-declarations',
      // HARDLINE: stream-safe revvault (GAP-468 / ADR 2026-08-05)
      'stream-safe-secrets',
      'token-economy',
    ],
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
    ruleIds: ['code-analysis-policy'],
  },
  {
    tier: 4,
    name: 'Task',
    description: 'Injected per-operation  -  skill routing, agent dispatch',
    ruleIds: ['skills-usage', 'agent-dispatch'],
  },
];
