import { z } from 'zod/v4';
import type { MarketingBlock } from './blocks.js';

// Tier 3 — LLM judge (spec §5.4). GAP-332 declares the typed injection seam and
// the output schema only; the judge implementation + @revealui/ai wiring are
// Phase C. Kept in its own module (the only zod dependency in marketing-voice)
// so the rule engine + rule data stay dependency-light for the CI gate.

export const Tier3FindingSchema = z.object({
  rule: z.string(),
  field: z.string(),
  message: z.string(),
  severity: z.enum(['high', 'low']),
});

export const Tier3OutputSchema = z.object({
  scores: z.record(z.string(), z.union([z.literal(0), z.literal(1)])),
  findings: z.array(Tier3FindingSchema),
  verdict: z.enum(['pass', 'warn', 'fail']),
});

export type AdvisoryFinding = z.infer<typeof Tier3FindingSchema>;
export type Tier3Report = z.infer<typeof Tier3OutputSchema>;

/** Injection seam for the Phase-C LLM judge. Absent = Tier 3 skipped. */
export type Tier3Judge = (block: MarketingBlock) => Tier3Report;
