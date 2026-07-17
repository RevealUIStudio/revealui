import {
  type MarketingBlock,
  type MarketingValidationReport,
  type MarketingVoiceRules,
  type Tier3Judge,
  type Violation,
  validateMarketingBlock,
} from '@revealui/contracts/marketing-voice';
import type { ZodType } from 'zod/v4';

// The marketing-content generation pipeline (spec §7.2). GAP-332 ships the pure
// helper, the shared validation seam, and the retry-loop STRUCTURE with its
// dependencies injected so it is unit-testable with a fake client. The LIVE
// wiring (the real @revealui/ai provider, `getSite`, the block Zod schemas, the
// `POST /api/marketing/generate` route) is Phase B.

export type {
  MarketingValidationReport,
  MarketingVoiceRules,
} from '@revealui/contracts/marketing-voice';
/** Re-export the shared validation seam so callers can `import` it from `lib/`. */
export { validateMarketingBlock } from '@revealui/contracts/marketing-voice';

/**
 * Parse an LLM JSON response and validate it against the requested block's Zod
 * schema in one step. Returns `null` on EITHER failure so the retry loop treats
 * "malformed JSON" and "well-formed but schema-invalid" identically. Never
 * throws. Verbatim from spec §7.2.
 */
export function parseAndValidate<T>(text: string, schema: ZodType<T>): T | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null; // malformed JSON — retry
  }
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null; // schema-invalid — retry
}

export interface LLMMessage {
  role: 'system' | 'user';
  content: string;
}

export interface LLMClient {
  chat(
    messages: LLMMessage[],
    opts: { maxTokens: number; temperature: number },
  ): Promise<{ content: string }>;
}

/** Injected dependencies — the real providers are supplied by the Phase-B route. */
export interface GenerateBlockDeps {
  blockSchema: ZodType<MarketingBlock>;
  voiceRules: MarketingVoiceRules;
  renderSystemPrompt: (ctx: { voiceRules: MarketingVoiceRules }) => string;
  renderUserPrompt: (ctx: {
    prompt: string;
    lastBlock: MarketingBlock | null;
    tier2Violations: Violation[];
  }) => string;
}

export type GenerateOutcome = 'ok' | 'tier1-blocked' | 'exhausted';

export interface GenerateBlockResult {
  block: MarketingBlock | null;
  validation: MarketingValidationReport | null;
  outcome: GenerateOutcome;
  attempts: number;
}

/**
 * Retry-loop orchestrator (spec §7.2). Tier-1 failures are structural and NOT
 * regenerable — return the block for the author to fix. Tier-2 failures are
 * re-prompted with the violations as feedback until `maxRetries`, then the best
 * attempt is returned with violations attached.
 */
export async function generateBlock(
  client: LLMClient,
  deps: GenerateBlockDeps,
  prompt: string,
  opts: { maxRetries: number; tier3?: Tier3Judge },
): Promise<GenerateBlockResult> {
  let attempts = 0;
  let lastBlock: MarketingBlock | null = null;
  let tier2Violations: Violation[] = [];

  while (attempts < opts.maxRetries) {
    attempts++;
    const messages: LLMMessage[] = [
      { role: 'system', content: deps.renderSystemPrompt({ voiceRules: deps.voiceRules }) },
      { role: 'user', content: deps.renderUserPrompt({ prompt, lastBlock, tier2Violations }) },
    ];
    const response = await client.chat(messages, { maxTokens: 1500, temperature: 0.4 });

    const block = parseAndValidate(response.content, deps.blockSchema);
    if (!block) continue; // malformed JSON or schema-invalid — retry

    const report = validateMarketingBlock(block, deps.voiceRules);
    if (!report.tier1.passed) {
      return { block, validation: report, outcome: 'tier1-blocked', attempts };
    }
    if (!report.tier2.passed) {
      tier2Violations = report.tier2.violations;
      lastBlock = block;
      continue;
    }
    const validation = opts.tier3
      ? validateMarketingBlock(block, deps.voiceRules, { tier3: opts.tier3 })
      : report;
    return { block, validation, outcome: 'ok', attempts };
  }

  const validation = lastBlock ? validateMarketingBlock(lastBlock, deps.voiceRules) : null;
  return { block: lastBlock, validation, outcome: 'exhausted', attempts };
}
