import { describe, expect, it } from 'vitest';

import { A2ATaskStateSchema } from '../a2a/index.js';
import { AgentDefinitionSchema } from '../agents/index.js';

/**
 * Schema-only PR for GAP-149 (x402 A2A wiring). Adds:
 *   - `pending-payment` state to A2ATaskStateSchema
 *   - optional `pricing: { usdc, rvui? }` field to AgentDefinitionSchema
 *
 * Pinned here so the schema contracts are exercised in isolation. PR 2 of
 * the gap will exercise the runtime wiring (handler emission + proof
 * verification + HTTP 402 response).
 */

const VALID_AGENT = {
  id: 'agt_priced',
  name: 'Priced Agent',
  description: 'Charges per call',
  model: 'gpt-4',
  systemPrompt: 'You are a paid agent.',
  tools: [],
  capabilities: [],
};

describe('A2ATaskStateSchema — pending-payment state (GAP-149 PR 1)', () => {
  it('accepts the new pending-payment state', () => {
    const result = A2ATaskStateSchema.safeParse('pending-payment');
    expect(result.success).toBe(true);
  });

  it('still accepts every pre-existing state (additive change)', () => {
    for (const state of [
      'submitted',
      'working',
      'input-required',
      'completed',
      'canceled',
      'failed',
      'unknown',
    ] as const) {
      expect(A2ATaskStateSchema.safeParse(state).success).toBe(true);
    }
  });

  it('rejects an unknown state string', () => {
    expect(A2ATaskStateSchema.safeParse('payment-required').success).toBe(false);
    expect(A2ATaskStateSchema.safeParse('paid').success).toBe(false);
    expect(A2ATaskStateSchema.safeParse('').success).toBe(false);
  });
});

describe('AgentDefinitionSchema — pricing field (GAP-149 PR 1)', () => {
  it('parses an agent with no pricing (free / quota-or-license-gated)', () => {
    const result = AgentDefinitionSchema.safeParse(VALID_AGENT);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing).toBeUndefined();
    }
  });

  it('parses an agent with USDC-only pricing', () => {
    const result = AgentDefinitionSchema.safeParse({
      ...VALID_AGENT,
      pricing: { usdc: '0.05' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing?.usdc).toBe('0.05');
      expect(result.data.pricing?.rvui).toBeUndefined();
    }
  });

  it('parses an agent with USDC + RVUI pricing (dual-currency advertisement)', () => {
    const result = AgentDefinitionSchema.safeParse({
      ...VALID_AGENT,
      pricing: { usdc: '0.10', rvui: '0.08' },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricing).toEqual({ usdc: '0.10', rvui: '0.08' });
    }
  });

  it('rejects pricing with no usdc field (RVUI alone is not a valid configuration)', () => {
    // USDC is the mandatory settlement currency per Phase 1 decision #1
    // (currency negotiation: USDC always available, RVUI is the optional
    // discount alternative).
    const result = AgentDefinitionSchema.safeParse({
      ...VALID_AGENT,
      pricing: { rvui: '0.08' },
    });
    expect(result.success).toBe(false);
  });

  it('rejects pricing with non-string numeric values (string-only by design)', () => {
    // Strings prevent float precision loss; the x402 emission boundary
    // converts to atomic units. Numeric input would silently lose
    // precision on values like "0.000001".
    const result = AgentDefinitionSchema.safeParse({
      ...VALID_AGENT,
      pricing: { usdc: 0.05 },
    });
    expect(result.success).toBe(false);
  });

  it('preserves backward compatibility: existing agent fixtures parse unchanged', () => {
    // Pre-GAP-149 agent definitions (no pricing field) must remain valid.
    const legacyAgent = {
      id: 'agt_legacy',
      name: 'Legacy Agent',
      description: 'No pricing',
      model: 'gpt-4',
      systemPrompt: 'You are a legacy agent.',
      tools: [],
      capabilities: [],
      temperature: 0.7,
      maxTokens: 4096,
    };
    const result = AgentDefinitionSchema.safeParse(legacyAgent);
    expect(result.success).toBe(true);
  });
});
