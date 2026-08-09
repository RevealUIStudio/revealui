import type { Rule } from '../../schemas/rule.js';

/**
 * Always-on diagnosis vocabulary (progressive disclosure).
 * Full glossary is fleet-private research; this rule is the load-bearing one-liner only.
 * Source: docs/research/2026-08-09-ai-mechanics-glossary-and-ax-checklist.md (.jv).
 */
export const aiMechanicsRule: Rule = {
  id: 'ai-mechanics',
  tier: 'oss',
  name: 'AI Mechanics',
  description:
    'Diagnose agent failures as model / harness / context / smart zone / primary source, not "the AI"',
  scope: 'global',
  preambleTier: 1,
  tags: ['agents', 'harness', 'context', 'sdlc', 'diagnosis'],
  content: `# AI Mechanics (diagnosis)

Diagnose agent failures as **model / harness / context / smart zone / primary source**, not "the AI."

| Term | Means |
|------|--------|
| **Model** | Frozen weights; next-token prediction only |
| **Harness** | Tools, system prompt, permissions, hooks, context assembly |
| **Context** | Task-relevant knowledge the agent actually has (quality, not window size) |
| **Smart zone** | Early-session quality; later bloat is dumb zone  -  clear or hand off |
| **Primary source** | Code and tests; handoffs and docs are secondary |

## Progressive disclosure

- **Always-on:** this rule only.
- **Full 20-term glossary + AX checklist (fleet):** \`~/revfleet/.jv/docs/research/2026-08-09-ai-mechanics-glossary-and-ax-checklist.md\`
- **Domain / RevFleet names** stay in \`~/revfleet/.jv/docs/glossary.md\`  -  do not mix.

## Related

- **code-over-docs**  -  primary source wins on behavior claims
- **token-economy**  -  context and session cost
- **quality-over-speed**  -  do not skip proof to save tokens
`,
};
