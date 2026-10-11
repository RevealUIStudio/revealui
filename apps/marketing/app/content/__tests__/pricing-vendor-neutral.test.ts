import { describe, expect, it } from 'vitest';
import * as pricing from '../pricing';
import { PRICING_FAQS } from '../pricing-faq';

/**
 * D-09 (2026-10-08): the public pricing page names tool categories, not
 * vendor or competitor companies, and makes no machine-readable claim.
 * Exact-substring checks only (no authored regex).
 */
const BANNED_ON_PRICING = [
  'Stripe',
  'Neon',
  'Vercel',
  'Cloudflare',
  'Fly.io',
  'Hetzner',
  'Playwright',
  'Next.js',
  'Cursor',
  'Claude',
  'Copilot',
  'Zed',
  'Coinbase',
  'Sentry',
  'GitButler',
  'Keygen',
  'Ollama',
  'Inference Snaps',
  'Gmail',
  'GitHub',
  'machine-readable',
  'RevMarket',
  'Stage B',
] as const;

function pricingCopy(): string {
  return JSON.stringify({ pricing, faqs: PRICING_FAQS });
}

describe('pricing page vendor-neutral copy', () => {
  it('names no vendor or competitor company and makes no machine-readable claim', () => {
    const copy = pricingCopy();
    for (const banned of BANNED_ON_PRICING) {
      expect(copy.includes(banned), banned).toBe(false);
    }
  });

  it('keeps the honest MCP and x402 hedges', () => {
    expect(
      pricing.PRICING_AGENT_MCP.body.includes('any MCP-capable editor or coding assistant'),
    ).toBe(true);
    expect(pricing.PRICING_AGENT_MCP.body.includes('charging, and payouts are not open')).toBe(
      true,
    );
    expect(pricing.PRICING_AGENT_X402.body.includes('Built on the open x402 standard.')).toBe(true);
    expect(pricing.PRICING_AGENT_A2A.body.suffix).toBe('. The card lists capabilities and skills.');
  });
});
